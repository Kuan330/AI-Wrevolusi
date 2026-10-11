"""Launcher and hosting checks with fake services and isolated command probes."""

import argparse
import json
import os
import signal
from contextlib import ExitStack
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, call, patch

import dev


class LauncherTests(unittest.TestCase):
    def setUp(self):
        stack = self.enterContext(ExitStack())
        # These lifecycle tests exercise the POSIX process-group branch; the
        # dedicated WindowsLauncherLifecycleTests covers Windows Job Objects.
        stack.enter_context(patch.object(dev.os, "name", "posix"))
        stack.enter_context(patch.object(dev, "parse_args", return_value=argparse.Namespace(
            backend_port=8000, frontend_port=5173,
        )))
        stack.enter_context(patch.object(dev, "require_command"))
        self.select_runtime = stack.enter_context(patch.object(dev, "select_frontend_runtime"))
        self.toolchain = stack.enter_context(patch.object(dev, "require_frontend_toolchain"))
        stack.enter_context(patch.object(dev.Path, "exists", return_value=True))
        self.ports = stack.enter_context(patch.object(dev, "available_port", side_effect=[8001, 5174]))
        self.spawn = stack.enter_context(patch.object(dev.subprocess, "Popen"))
        self.stop = stack.enter_context(patch.object(dev, "stop_process"))
        self.wait = stack.enter_context(patch.object(dev, "wait_for_exit"))
        self.sleep = stack.enter_context(patch.object(dev.time, "sleep"))
        stack.enter_context(patch("builtins.print"))

    def test_toolchain_failure_starts_no_services(self):
        self.toolchain.side_effect = RuntimeError("wrong node version")
        with self.assertRaisesRegex(RuntimeError, "wrong node version"):
            dev.main()
        self.spawn.assert_not_called()
        self.ports.assert_not_called()

    def test_frontend_start_failure_cleans_up_backend(self):
        backend = Mock()
        self.spawn.side_effect = [backend, OSError("cannot start frontend")]
        with self.assertRaisesRegex(OSError, "cannot start frontend"):
            dev.main()
        self.stop.assert_called_once_with(backend)
        self.wait.assert_called_once_with(backend)

    def test_first_start_failure_has_no_children_to_stop(self):
        self.spawn.side_effect = OSError("cannot start backend")
        with self.assertRaises(OSError):
            dev.main()
        self.stop.assert_not_called()
        self.wait.assert_not_called()

    def test_child_exit_returns_code_and_cleans_up_both(self):
        backend, frontend = Mock(), Mock()
        backend.poll.return_value = None
        frontend.poll.return_value = 7
        self.spawn.side_effect = [backend, frontend]
        self.assertEqual(dev.main(), 7)
        self.assertEqual(self.stop.call_args_list, [call(backend), call(frontend)])
        self.assertEqual(self.wait.call_args_list, [call(backend), call(frontend)])

        backend_call, frontend_call = self.spawn.call_args_list
        self.assertEqual(
            [Path(part).stem for part in backend_call.args[0][:4]],
            ["uv", "run", "--locked", "uvicorn"],
        )
        self.assertEqual(backend_call.kwargs["env"]["CORS_ORIGINS"], "http://127.0.0.1:5174")
        self.assertEqual(frontend_call.kwargs["env"]["VITE_API_BASE_URL"], "/api/v1")
        self.assertEqual(frontend_call.kwargs["env"]["VITE_API_PROXY_TARGET"], "http://127.0.0.1:8001")
        self.assertEqual(self.ports.call_args_list, [call(8000), call(5173, excluded=frozenset({8001}))])

    def test_interrupt_cleans_up_both(self):
        backend, frontend = Mock(), Mock()
        backend.poll.return_value = frontend.poll.return_value = None
        self.spawn.side_effect = [backend, frontend]
        self.sleep.side_effect = KeyboardInterrupt
        self.assertEqual(dev.main(), 0)
        self.assertEqual(self.stop.call_args_list, [call(backend), call(frontend)])
        self.assertEqual(self.wait.call_args_list, [call(backend), call(frontend)])


class StopProcessTests(unittest.TestCase):
    @patch.object(dev.os, "name", "posix")
    @patch.object(dev.os, "killpg", create=True)
    def test_posix_stops_the_process_group(self, killpg):
        process = Mock(pid=123)
        process.poll.return_value = None

        dev.stop_process(process)

        killpg.assert_called_once_with(123, signal.SIGTERM)
        process.terminate.assert_not_called()

    @patch.object(dev.os, "name", "nt")
    def test_windows_fallback_stops_the_direct_child(self):
        process = Mock(pid=123)
        process.poll.return_value = None

        dev.stop_process(process)

        process.terminate.assert_called_once_with()


class WindowsLauncherLifecycleTests(unittest.TestCase):
    @patch.object(dev.os, "name", "nt")
    @patch.object(dev, "command_path", side_effect=lambda name: name)
    @patch.object(dev, "WindowsProcessJob")
    def test_windows_launcher_suspends_assigns_and_cleans_up_job(self, job_factory, _command_path):
        backend, frontend = Mock(), Mock()
        backend.poll.return_value = None
        frontend.poll.return_value = 7
        with patch.object(dev, "parse_args", return_value=argparse.Namespace(
            backend_port=8000, frontend_port=5173,
        )), patch.object(dev, "require_command"), \
                patch.object(dev, "select_frontend_runtime"), \
                patch.object(dev, "require_frontend_toolchain"), \
                patch.object(dev.Path, "exists", return_value=True), \
                patch.object(dev, "available_port", side_effect=[8001, 5174]), \
                patch.object(dev.subprocess, "Popen", side_effect=[backend, frontend]) as spawn, \
                patch.object(dev, "wait_for_exit") as wait, \
                patch("builtins.print"):
            self.assertEqual(dev.main(), 7)

        job = job_factory.return_value
        self.assertEqual(job.assign_and_resume.call_args_list, [call(backend), call(frontend)])
        job.close.assert_called_once_with()
        self.assertEqual(wait.call_args_list, [call(backend), call(frontend)])
        for invocation in spawn.call_args_list:
            self.assertEqual(
                invocation.kwargs["creationflags"],
                dev.WINDOWS_CREATE_NEW_PROCESS_GROUP | dev.WINDOWS_CREATE_SUSPENDED,
            )


class RuntimeSelectionTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.dict(dev.os.environ, {"PATH": "/global/bin"}))
        dev.os.environ.pop("AIW_NODE_BIN", None)
        # Native strings so the launcher's str(Path(...)) comparisons round-trip
        # on both POSIX and Windows.
        self.global_node = str(Path("/global/bin/node"))
        self.local_node = str(Path("/local/node24/bin/node"))
        self.enterContext(patch.object(dev.shutil, "which", return_value=self.global_node))
        self.enterContext(patch.object(dev, "installed_node_candidates", return_value=[dev.Path(self.local_node)]))
        self.enterContext(patch.object(dev.Path, "is_file", return_value=True))
        self.run = self.enterContext(patch.object(dev.subprocess, "run"))
        self.enterContext(patch("builtins.print"))

    def test_compatible_path_runtime_is_kept(self):
        self.run.return_value = Mock(stdout="v24.19.0\n")
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")
        self.run.assert_called_once()

    def test_windows_uppercase_executable_extension_is_accepted(self):
        current = str(Path("/global/bin/node.EXE"))
        with patch.object(dev.shutil, "which", return_value=current):
            self.run.return_value = Mock(stdout="v24.19.0\n")
            dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")
        self.run.assert_called_once()

    def test_node_26_falls_back_to_installed_node_24(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), Mock(stdout="v24.19.0\n")]
        dev.select_frontend_runtime()
        self.assertEqual(
            dev.os.environ["PATH"],
            str(Path(self.local_node).parent) + dev.os.pathsep + "/global/bin",
        )
        self.assertEqual(self.run.call_args.args[0], [self.local_node, "--version"])

    def test_node_22_falls_back_to_windows_node_executable(self):
        bundled_node = Path("/bundled/node24/bin/node.exe")
        with patch.object(dev, "installed_node_candidates", return_value=[bundled_node]):
            self.run.side_effect = [Mock(stdout="v22.14.0\n"), Mock(stdout="v24.19.0\n")]
            dev.select_frontend_runtime()
        self.assertEqual(
            dev.os.environ["PATH"],
            str(bundled_node.parent) + dev.os.pathsep + "/global/bin",
        )
        self.assertEqual(self.run.call_args.args[0], [str(bundled_node), "--version"])

    def test_incompatible_fallback_does_not_change_path(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), Mock(stdout="v24.18.0\n")]
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")

    def test_broken_fallback_does_not_change_path(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), OSError("not executable")]
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")

    def test_explicit_runtime_is_selected(self):
        chosen = Path("/chosen/bin/node").expanduser().absolute()
        dev.os.environ["AIW_NODE_BIN"] = "/chosen/bin/node"
        self.run.return_value = Mock(stdout="v24.20.0\n")
        dev.select_frontend_runtime()
        self.assertEqual(
            dev.os.environ["PATH"],
            str(chosen.parent) + dev.os.pathsep + "/global/bin",
        )
        self.assertEqual(self.run.call_args.args[0], [str(chosen), "--version"])

    def test_invalid_override_fails_instead_of_silently_ignoring_it(self):
        dev.os.environ["AIW_NODE_BIN"] = "/chosen/bin/node"
        self.run.return_value = Mock(stdout="v26.6.0\n")
        with self.assertRaisesRegex(RuntimeError, "AIW_NODE_BIN must point"):
            dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")


class ToolchainTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(dev, "require_command"))
        self.run = self.enterContext(patch.object(dev.subprocess, "run"))

    def test_matching_versions_are_accepted(self):
        self.run.side_effect = [Mock(stdout="v24.19.0\n"), Mock(stdout="12.0.2\n")]
        dev.require_frontend_toolchain()
        # command_path keeps bare names on POSIX and resolves npm.cmd on Windows.
        self.assertEqual(
            [(Path(c.args[0][0]).stem, c.args[0][1]) for c in self.run.call_args_list],
            [("node", "--version"), ("npm", "--version")],
        )

    def test_node_mismatch_fails_before_checking_npm(self):
        self.run.return_value = Mock(stdout="v26.6.0\n")
        with self.assertRaisesRegex(RuntimeError, "requires node >=24.19.0 <25, but found 26.6.0"):
            dev.require_frontend_toolchain()
        self.assertEqual(self.run.call_count, 1)

    def test_newer_node_24_patch_is_accepted(self):
        self.run.side_effect = [Mock(stdout="v24.20.0\n"), Mock(stdout="12.0.2\n")]
        dev.require_frontend_toolchain()

    def test_older_node_24_is_rejected(self):
        self.run.return_value = Mock(stdout="v24.18.0\n")
        with self.assertRaisesRegex(RuntimeError, "requires node >=24.19.0 <25"):
            dev.require_frontend_toolchain()

    def test_prerelease_node_is_rejected(self):
        self.run.return_value = Mock(stdout="v24.20.0-rc.1\n")
        with self.assertRaisesRegex(RuntimeError, "requires node >=24.19.0 <25"):
            dev.require_frontend_toolchain()

    def test_npm_mismatch_reports_required_version(self):
        self.run.side_effect = [Mock(stdout="v24.19.0\n"), Mock(stdout="11.6.2\n")]
        with self.assertRaisesRegex(RuntimeError, "requires npm 12.0.2, but found 11.6.2"):
            dev.require_frontend_toolchain()

    def test_broken_version_command_reports_actionable_error(self):
        self.run.side_effect = dev.subprocess.TimeoutExpired("node", 10)
        with self.assertRaisesRegex(RuntimeError, "Could not check node version"):
            dev.require_frontend_toolchain()

    def test_version_probe_allows_slow_windows_cold_start(self):
        self.run.side_effect = [Mock(stdout="v24.19.0\n"), Mock(stdout="12.0.2\n")]
        dev.require_frontend_toolchain()
        self.assertTrue(all(c.kwargs["timeout"] == 60 for c in self.run.call_args_list))

    def test_failed_version_probe_preserves_stderr(self):
        self.run.side_effect = subprocess.CalledProcessError(
            1, "npm", stderr="Cannot find module npm-cli.js"
        )
        with self.assertRaisesRegex(RuntimeError, "Cannot find module npm-cli.js"):
            dev.require_frontend_toolchain()


class CommandPathTests(unittest.TestCase):
    def test_posix_keeps_bare_command(self):
        with patch.object(dev.os, "name", "posix"):
            self.assertEqual(dev.command_path("npm"), "npm")

    def test_windows_resolves_the_npm_shim(self):
        with patch.object(dev.os, "name", "nt"), \
                patch.object(dev.shutil, "which", return_value=r"C:\node\npm.CMD"):
            self.assertEqual(dev.command_path("npm"), r"C:\node\npm.CMD")

    def test_windows_missing_command_falls_back_to_bare_name(self):
        with patch.object(dev.os, "name", "nt"), \
                patch.object(dev.shutil, "which", return_value=None):
            self.assertEqual(dev.command_path("npm"), "npm")


class WindowsNodeCandidateTests(unittest.TestCase):
    def test_bundled_runtime_uses_platform_executable_name(self):
        executable = "node.exe" if dev.os.name == "nt" else "node"
        bundled_node = (
            Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime"
            / "dependencies" / "node" / "bin" / executable
        )
        self.assertIn(bundled_node, dev.installed_node_candidates("24.19.0"))

    def test_includes_local_nodejs_install(self):
        self.assertIn(
            Path.home() / ".local" / "nodejs" / "node-v24.19.0-win-x64" / "node.exe",
            dev.windows_node_candidates("24.19.0"),
        )

    def test_uses_nvm_environment_variables(self):
        with patch.dict(dev.os.environ, {"NVM_SYMLINK": r"C:\Program Files\nodejs"}):
            candidates = dev.windows_node_candidates("24.19.0")
        self.assertIn(Path(r"C:\Program Files\nodejs") / "node.exe", candidates)

    def test_installed_candidates_include_windows_entries_only_on_windows(self):
        names = {candidate.name for candidate in dev.installed_node_candidates("24.19.0")}
        self.assertEqual("node.exe" in names, dev.os.name == "nt")


class HostingToolchainTests(unittest.TestCase):
    @unittest.skipUnless(os.name == "posix", "Vercel build commands run under sh")
    def test_frontend_service_uses_project_npm_for_install_and_build(self):
        package = json.loads((dev.FRONTEND_ROOT / "package.json").read_text())
        config = json.loads((dev.REPOSITORY_ROOT / "vercel.json").read_text())
        manager = package["packageManager"]
        self.assertEqual(manager, "npm@" + package["devEngines"]["packageManager"]["version"])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            frontend = root / "frontend"
            frontend.mkdir()
            (frontend / "package.json").write_text(json.dumps(package))
            binaries = root / "bin"
            binaries.mkdir()
            # Vercel's older host npm rejects the guarded package before npx
            # can select the project version. Model that first bootstrap step.
            npx = binaries / "npx"
            npx.write_text(
                "#!/usr/bin/env python3\n"
                "import json, os, sys\n"
                "from pathlib import Path\n"
                "if Path('package.json').exists():\n"
                "    sys.exit('Host npm encountered project devEngines before bootstrap')\n"
                "print(json.dumps({'cwd': os.getcwd(), 'args': sys.argv[1:]}))\n"
            )
            npx.chmod(0o755)
            env = {**os.environ, "PATH": str(binaries) + os.pathsep + os.environ["PATH"]}
            for key, action in (("installCommand", ["ci"]), ("buildCommand", ["run", "build"])):
                with self.subTest(command=key):
                    result = subprocess.run(
                        ["sh", "-c", config["services"]["frontend"][key]],
                        cwd=frontend, env=env, capture_output=True, text=True,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    invocation = json.loads(result.stdout)
                    self.assertEqual(Path(invocation["cwd"]).resolve(), root.resolve())
                    self.assertEqual(invocation["args"], ["--yes", manager, "--prefix", "frontend", *action])


class PortTests(unittest.TestCase):
    @patch.object(dev.socket, "socket")
    def test_skips_excluded_and_occupied_ports(self, socket):
        candidate = socket.return_value.__enter__.return_value
        candidate.bind.side_effect = [OSError("occupied"), None]
        self.assertEqual(dev.available_port(8000, excluded=frozenset({8001})), 8002)
        self.assertEqual(candidate.bind.call_args_list, [call((dev.HOST, 8000)), call((dev.HOST, 8002))])

    @patch.object(dev.socket, "socket")
    def test_exhaustion_stops_at_maximum_port(self, socket):
        socket.return_value.__enter__.return_value.bind.side_effect = OSError("occupied")
        with self.assertRaisesRegex(RuntimeError, "65535 and 65535"):
            dev.available_port(65535)
        self.assertEqual(socket.call_count, 1)


if __name__ == "__main__":
    unittest.main()
