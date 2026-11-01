"""Bounded process-local state. Sessions expire after idle TTL or service restart."""
from collections import OrderedDict
from dataclasses import dataclass, field
from threading import RLock
from time import monotonic
from types import SimpleNamespace

MAX_SESSIONS = 1000
SESSION_TTL_SECONDS = 1800
_lock = RLock()
_memories = OrderedDict()

@dataclass
class SessionMemory:
    k: int = 10
    touched: float = field(default_factory=monotonic)
    chat_memory: object = field(default_factory=lambda: SimpleNamespace(messages=[]))
    symptoms: set = field(default_factory=set)
    lock: object = field(default_factory=RLock)

    @property
    def buffer_as_str(self):
        return '\n'.join(f'{m.type}: {m.content}' for m in self.chat_memory.messages)

    def save_context(self, inputs, outputs):
        self.chat_memory.messages.extend([SimpleNamespace(type='human', content=inputs['input']), SimpleNamespace(type='ai', content=outputs['output'])])
        self.chat_memory.messages = self.chat_memory.messages[-self.k * 2:]


def _prune():
    now = monotonic()
    for key in list(_memories):
        if now - _memories[key].touched >= SESSION_TTL_SECONDS:
            del _memories[key]


def get_session_memory(session_id: str, k: int = 10, *, create=True):
    with _lock:
        _prune()
        if session_id not in _memories:
            if not create:
                raise KeyError('Session expired or not initialized')
            while len(_memories) >= MAX_SESSIONS:
                _memories.popitem(last=False)
            _memories[session_id] = SessionMemory(k=k)
        memory = _memories[session_id]
        memory.touched = monotonic()
        _memories.move_to_end(session_id)
        return memory


def clear_session_memory(session_id: str):
    # Symptoms and history share the same lifecycle and are always removed together.
    with _lock:
        _memories.pop(session_id, None)


def get_all_memory_messages(session_id: str) -> str:
    try:
        return get_session_memory(session_id, create=False).buffer_as_str
    except KeyError:
        return ''
