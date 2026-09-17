"""Launcher checks using fake child processes and sockets only."""

import argparse
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
        stack.enter_context(patch.object(dev.Path, "exists", return_value=True))
        self.ports = stack.enter_context(patch.object(dev, "available_port", side_effect=[8001, 5174]))
        self.spawn = stack.enter_context(patch.object(dev.subprocess, "Popen"))
        self.stop = stack.enter_context(patch.object(dev, "stop_process"))
        self.wait = stack.enter_context(patch.object(dev, "wait_for_exit"))
        self.sleep = stack.enter_context(patch.object(dev.time, "sleep"))
        stack.enter_context(patch("builtins.print"))

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
