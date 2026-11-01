"""All service tests are offline: no provider calls or embedding downloads."""
import socket
import pytest

@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    original = socket.socket.connect
    def guarded(sock, address):
        # Windows asyncio creates its event-loop wakeup socket over loopback.
        if isinstance(address, tuple) and address[0] in ('127.0.0.1', '::1', 'localhost'):
            return original(sock, address)
        raise AssertionError('External network calls are forbidden in offline AI tests')
    monkeypatch.setattr(socket.socket, 'connect', guarded)
