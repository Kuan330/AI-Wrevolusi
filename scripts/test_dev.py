"""Launcher checks using fake child processes and sockets only."""

import argparse
import json
from contextlib import ExitStack
import unittest
from unittest.mock import Mock, call, patch

import dev


class LauncherTests(unittest.TestCase):
    def setUp(self):
        stack = self.enterContext(ExitStack())
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
        self.assertEqual(backend_call.args[0][:4], ["uv", "run", "--locked", "uvicorn"])
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


class RuntimeSelectionTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.dict(dev.os.environ, {"PATH": "/global/bin"}))
        dev.os.environ.pop("AIW_NODE_BIN", None)
        self.enterContext(patch.object(dev.shutil, "which", return_value="/global/bin/node"))
        self.enterContext(patch.object(dev, "installed_node_candidates", return_value=[dev.Path("/local/node24/bin/node")]))
        self.enterContext(patch.object(dev.Path, "is_file", return_value=True))
        self.run = self.enterContext(patch.object(dev.subprocess, "run"))
        self.enterContext(patch("builtins.print"))

    def test_compatible_path_runtime_is_kept(self):
        self.run.return_value = Mock(stdout="v24.19.0\n")
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")
        self.run.assert_called_once()

    def test_node_26_falls_back_to_installed_node_24(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), Mock(stdout="v24.19.0\n")]
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/local/node24/bin:/global/bin")
        self.assertEqual(self.run.call_args.args[0], ["/local/node24/bin/node", "--version"])

    def test_incompatible_fallback_does_not_change_path(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), Mock(stdout="v24.18.0\n")]
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")

    def test_broken_fallback_does_not_change_path(self):
        self.run.side_effect = [Mock(stdout="v26.6.0\n"), OSError("not executable")]
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/global/bin")

    def test_explicit_runtime_is_selected(self):
        dev.os.environ["AIW_NODE_BIN"] = "/chosen/bin/node"
        self.run.return_value = Mock(stdout="v24.20.0\n")
        dev.select_frontend_runtime()
        self.assertEqual(dev.os.environ["PATH"], "/chosen/bin:/global/bin")
        self.assertEqual(self.run.call_args.args[0], ["/chosen/bin/node", "--version"])

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
        self.assertEqual([c.args[0] for c in self.run.call_args_list], [["node", "--version"], ["npm", "--version"]])

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


class HostingToolchainTests(unittest.TestCase):
    def test_frontend_service_uses_project_npm_for_install_and_build(self):
        package = json.loads((dev.FRONTEND_ROOT / "package.json").read_text())
        config = json.loads((dev.REPOSITORY_ROOT / "vercel.json").read_text())
        manager = package["packageManager"]
        self.assertEqual(manager, "npm@" + package["devEngines"]["packageManager"]["version"])
        self.assertEqual(config["services"]["frontend"]["installCommand"], f"npx --yes {manager} ci")
        self.assertEqual(config["services"]["frontend"]["buildCommand"], f"npx --yes {manager} run build")


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
