"""Start the backend and frontend on the first available local ports."""

from __future__ import annotations

import argparse
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


def port_number(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "posix":
        os.killpg(process.pid, signal.SIGTERM)
    else:
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
    require_command("npm")
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
    if os.name == "posix":
        common_options["start_new_session"] = True
    elif os.name == "nt":
        common_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    print("Starting AI-Wrevolusi", flush=True)
    print(f"  App:      {frontend_origin}", flush=True)
    print(f"  API docs: {backend_origin}/docs", flush=True)
    print(f"  Health:   {backend_origin}/api/healthz", flush=True)
    print("Press Ctrl+C to stop both services.\n", flush=True)

    processes: list[subprocess.Popen[bytes]] = []
    try:
        processes.append(subprocess.Popen(
            [
                "uv",
                "run",
                "--locked",
                "uvicorn",
                "app.main:app",
                "--reload",
                "--host",
                HOST,
                "--port",
                str(backend_port),
            ],
            cwd=BACKEND_ROOT,
            env=backend_environment,
            **common_options,
        ))
        processes.append(subprocess.Popen(
            [
                "npm",
                "run",
                "dev",
                "--",
                "--host",
                HOST,
                "--port",
                str(frontend_port),
            ],
            cwd=FRONTEND_ROOT,
            env=frontend_environment,
            **common_options,
        ))
        while True:
            for process in processes:
                return_code = process.poll()
                if return_code is not None:
                    return return_code
            time.sleep(0.2)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in processes:
            stop_process(process)
        for process in processes:
            wait_for_exit(process)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
