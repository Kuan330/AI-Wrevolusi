"""Start the backend and frontend on the first available local ports."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time


HOST = "127.0.0.1"
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
FRONTEND_ROOT = REPOSITORY_ROOT / "frontend"


def available_port(
    preferred: int,
    attempts: int = 100,
    excluded: frozenset[int] = frozenset(),
) -> int:
    final_port = min(preferred + attempts - 1, 65535)
    for port in range(preferred, final_port + 1):
        if port in excluded:
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
            try:
                candidate.bind((HOST, port))
            except OSError:
                continue
            return port
    raise RuntimeError(
        f"No available port found between {preferred} and {final_port}."
    )


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Required command is not installed: {name}")


def command_path(name: str) -> str:
    """Return a command string that subprocess can launch on this platform.

    POSIX subprocess searches PATH itself, so the bare name is used and
    behaviour is unchanged. Windows CreateProcess does not apply PATHEXT, so a
    bare ``npm`` fails with FileNotFoundError; resolve the real npm.cmd shim.
    """
    if os.name == "nt":
        return shutil.which(name) or name
    return name


def compatible_node(version: str, minimum: tuple[int, ...]) -> bool:
    try:
        installed = tuple(int(part) for part in version.removeprefix("v").split("."))
    except ValueError:
        return False
    return len(installed) == 3 and installed[0] == minimum[0] and installed >= minimum


def windows_node_candidates(version: str) -> list[Path]:
    """Known Windows Node locations, including nvm-windows and local installs."""
    candidates: list[Path] = []
    for variable in ("NVM_SYMLINK", "NVM_HOME"):
        base = os.environ.get(variable)
        if base:
            candidates.append(Path(base) / "node.exe")
            candidates.append(Path(base) / f"v{version}" / "node.exe")
    for variable in ("APPDATA", "LOCALAPPDATA"):
        base = os.environ.get(variable)
        if base:
            candidates.append(Path(base) / "nvm" / f"v{version}" / "node.exe")
    program_files = os.environ.get("ProgramFiles")
    if program_files:
        candidates.append(Path(program_files) / "nodejs" / "node.exe")
    candidates.append(
        Path.home() / ".local" / "nodejs" / f"node-v{version}-win-x64" / "node.exe"
    )
    return candidates


def installed_node_candidates(version: str) -> list[Path]:
    """Known existing installations only. Never download a runtime."""
    major = version.split(".")[0]
    candidates = [
        Path.home() / ".nvm" / "versions" / "node" / f"v{version}" / "bin" / "node",
        Path(f"/opt/homebrew/opt/node@{major}/bin/node"),
        Path(f"/usr/local/opt/node@{major}/bin/node"),
        Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node",
    ]
    if os.name == "nt":
        candidates.extend(windows_node_candidates(version))
    return candidates


def select_frontend_runtime() -> None:
    """Select an installed compatible Node for this launcher and its children."""
    version = (FRONTEND_ROOT / ".nvmrc").read_text().strip()
    minimum = tuple(int(part) for part in version.split("."))
    override = os.environ.get("AIW_NODE_BIN")
    current = shutil.which("node")
    candidates = ([Path(override).expanduser().absolute()] if override else
                  ([Path(current)] if current else []) + installed_node_candidates(version))
    for binary in candidates:
        if binary.name not in {"node", "node.exe"} or not binary.is_file():
            continue
        try:
            result = subprocess.run(
                [str(binary), "--version"], check=True, capture_output=True,
                text=True, timeout=10,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        actual = result.stdout.strip()
        if compatible_node(actual, minimum):
            if override or str(binary) != current:
                os.environ["PATH"] = str(binary.parent) + os.pathsep + os.environ.get("PATH", "")
                print(f"Using Node {actual.removeprefix('v')} from {binary}", flush=True)
            return
    if override:
        raise RuntimeError(f"AIW_NODE_BIN must point to a working Node {minimum[0]} executable, version {version} or newer.")
    # The normal preflight supplies the missing/mismatched-version explanation.


def require_frontend_toolchain() -> None:
    """Fail before starting either service when the local toolchain differs."""
    engines = json.loads((FRONTEND_ROOT / "package.json").read_text())["devEngines"]
    for kind in ("runtime", "packageManager"):
        command = engines[kind]["name"]
        expected = engines[kind]["version"]
        require_command(command)
        try:
            result = subprocess.run(
                [command_path(command), "--version"], check=True, capture_output=True,
                text=True, timeout=10,
            )
        except (OSError, subprocess.SubprocessError) as error:
            raise RuntimeError(f"Could not check {command} version. Check your PATH and retry.") from error
        actual = result.stdout.strip().removeprefix("v")
        if kind == "runtime":
            minimum = tuple(int(part) for part in (FRONTEND_ROOT / ".nvmrc").read_text().strip().split("."))
            matches = compatible_node(actual, minimum)
        else:
            matches = actual == expected
        if not matches:
            raise RuntimeError(
                f"This project requires {command} {expected}, but found {actual}. "
                "Select the versions in frontend/.nvmrc and frontend/package.json, then retry. "
                "You can set AIW_NODE_BIN to an installed compatible node executable."
            )


def port_number(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


WINDOWS_CREATE_SUSPENDED = 0x00000004
WINDOWS_CREATE_NEW_PROCESS_GROUP = 0x00000200


class WindowsProcessJob:
    """Own service processes and their descendants as one Windows job."""

    def __init__(self) -> None:
        import ctypes
        from ctypes import wintypes

        class IoCounters(ctypes.Structure):
            _fields_ = [
                ("ReadOperationCount", ctypes.c_ulonglong),
                ("WriteOperationCount", ctypes.c_ulonglong),
                ("OtherOperationCount", ctypes.c_ulonglong),
                ("ReadTransferCount", ctypes.c_ulonglong),
                ("WriteTransferCount", ctypes.c_ulonglong),
                ("OtherTransferCount", ctypes.c_ulonglong),
            ]

        class BasicLimitInformation(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_longlong),
                ("PerJobUserTimeLimit", ctypes.c_longlong),
                ("LimitFlags", wintypes.DWORD),
                ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t),
                ("ActiveProcessLimit", wintypes.DWORD),
                ("Affinity", ctypes.c_size_t),
                ("PriorityClass", wintypes.DWORD),
                ("SchedulingClass", wintypes.DWORD),
            ]

        class ExtendedLimitInformation(ctypes.Structure):
            _fields_ = [
                ("BasicLimitInformation", BasicLimitInformation),
                ("IoInfo", IoCounters),
                ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t),
                ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t),
            ]

        self._ctypes = ctypes
        self._kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self._ntdll = ctypes.WinDLL("ntdll", use_last_error=True)
        self._kernel32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
        self._kernel32.CreateJobObjectW.restype = wintypes.HANDLE
        self._kernel32.SetInformationJobObject.argtypes = [
            wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD,
        ]
        self._kernel32.SetInformationJobObject.restype = wintypes.BOOL
        self._kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        self._kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
        self._kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        self._kernel32.CloseHandle.restype = wintypes.BOOL
        # Resume the suspended launcher only after it is in the job. This closes
        # the race where uv/npm could spawn a child before job assignment.
        self._ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]
        self._ntdll.NtResumeProcess.restype = ctypes.c_long

        self._handle = self._kernel32.CreateJobObjectW(None, None)
        if not self._handle:
            error = ctypes.WinError(ctypes.get_last_error())
            raise RuntimeError(f"Could not create the Windows service cleanup job: {error}") from error
        limits = ExtendedLimitInformation()
        # Closing the owning Python process also closes this handle, which makes
        # Windows terminate every service descendant even if the batch shell is
        # interrupted before Python can run its cleanup block.
        limits.BasicLimitInformation.LimitFlags = 0x00002000  # KILL_ON_JOB_CLOSE
        if not self._kernel32.SetInformationJobObject(
            self._handle, 9, ctypes.byref(limits), ctypes.sizeof(limits),
        ):
            error = ctypes.WinError(ctypes.get_last_error())
            self.close()
            raise RuntimeError(f"Could not configure the Windows service cleanup job: {error}") from error

    def assign_and_resume(self, process: subprocess.Popen[bytes]) -> None:
        process_handle = self._ctypes.c_void_p(int(process._handle))
        if not self._kernel32.AssignProcessToJobObject(self._handle, process_handle):
            error = self._ctypes.WinError(self._ctypes.get_last_error())
            process.kill()
            process.wait()
            raise RuntimeError(
                "Windows could not place a service in the cleanup job. "
                f"The launcher will not start services that it cannot reliably stop: {error}"
            ) from error
        status = self._ntdll.NtResumeProcess(process_handle)
        if status < 0:
            self.close()
            process.wait()
            raise RuntimeError(
                f"Could not resume a service in the Windows cleanup job "
                f"(NTSTATUS 0x{status & 0xFFFFFFFF:08X})."
            )

    def close(self) -> None:
        if self._handle:
            handle, self._handle = self._handle, None
            self._kernel32.CloseHandle(handle)


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "posix":
        os.killpg(process.pid, signal.SIGTERM)
    else:
        # The Windows launcher normally stops the shared Job Object instead.
        # Keep this direct-child fallback for callers outside main().
        process.terminate()


def wait_for_exit(process: subprocess.Popen[bytes]) -> None:
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        process.wait()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start AI-Wrevolusi locally with automatic port selection."
    )
    parser.add_argument(
        "--frontend-port",
        type=port_number,
        default=5173,
        help="Preferred frontend port. The next free port is used when occupied.",
    )
    parser.add_argument(
        "--backend-port",
        type=port_number,
        default=8000,
        help="Preferred backend port. The next free port is used when occupied.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    require_command("uv")
    select_frontend_runtime()
    require_frontend_toolchain()
    if not (FRONTEND_ROOT / "node_modules" / ".bin" / "vite").exists():
        raise RuntimeError("Frontend packages are missing. Run: cd frontend && npm ci")
    if not (BACKEND_ROOT / ".env").exists():
        raise RuntimeError(
            "Backend configuration is missing. Copy backend/.env.example to backend/.env first."
        )

    backend_port = available_port(args.backend_port)
    frontend_port = available_port(
        args.frontend_port,
        excluded=frozenset({backend_port}),
    )
    frontend_origin = f"http://{HOST}:{frontend_port}"
    backend_origin = f"http://{HOST}:{backend_port}"

    backend_environment = os.environ.copy()
    backend_environment["CORS_ORIGINS"] = frontend_origin
    frontend_environment = os.environ.copy()
    frontend_environment["VITE_API_BASE_URL"] = "/api/v1"
    frontend_environment["VITE_API_PROXY_TARGET"] = backend_origin

    common_options: dict[str, object] = {}
    process_job: WindowsProcessJob | None = None
    if os.name == "posix":
        common_options["start_new_session"] = True
    elif os.name == "nt":
        process_job = WindowsProcessJob()
        common_options["creationflags"] = (
            WINDOWS_CREATE_NEW_PROCESS_GROUP | WINDOWS_CREATE_SUSPENDED
        )

    print("Starting AI-Wrevolusi", flush=True)
    print(f"  App:      {frontend_origin}", flush=True)
    print(f"  API docs: {backend_origin}/docs", flush=True)
    print(f"  Health:   {backend_origin}/api/healthz", flush=True)
    print("Press Ctrl+C to stop both services.\n", flush=True)

    processes: list[subprocess.Popen[bytes]] = []
    try:
        for command, cwd, environment in (
            (
                [
                    command_path("uv"), "run", "--locked", "uvicorn",
                    "app.main:app", "--reload", "--host", HOST,
                    "--port", str(backend_port),
                ],
                BACKEND_ROOT,
                backend_environment,
            ),
            (
                [
                    command_path("npm"), "run", "dev", "--", "--host", HOST,
                    "--port", str(frontend_port),
                ],
                FRONTEND_ROOT,
                frontend_environment,
            ),
        ):
            process = subprocess.Popen(
                command,
                cwd=cwd,
                env=environment,
                **common_options,
            )
            if process_job is not None:
                process_job.assign_and_resume(process)
            processes.append(process)
        while True:
            for process in processes:
                return_code = process.poll()
                if return_code is not None:
                    return return_code
            time.sleep(0.2)
    except KeyboardInterrupt:
        return 0
    finally:
        try:
            if process_job is not None:
                # Closing a KILL_ON_JOB_CLOSE job terminates each wrapper and
                # descendant, even if this launcher is exiting after Ctrl+C.
                process_job.close()
            else:
                for process in processes:
                    stop_process(process)
        finally:
            for process in processes:
                wait_for_exit(process)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
