import importlib
import sys
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

SESSION = '11111111-1111-4111-8111-111111111111'
HEADERS = {'Authorization': 'Bearer test-token'}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('AI_SERVICE_TOKEN', 'test-token')
    monkeypatch.setenv('GROQ_API_KEY', 'offline-test-key')
    monkeypatch.setenv('AI_RAG_ENABLED', 'false')
    import app as service
    monkeypatch.setattr(service, 'init_chatbot', lambda: None)
    monkeypatch.setattr(service, 'process_chat_message', lambda *_: 'How long?')
    with TestClient(service.app) as test_client:
        yield test_client


def test_protected_endpoints_require_service_token(client):
    assert client.post('/chatbot/start', json={'session_id': SESSION}).status_code == 401
    assert client.post('/chatbot/start', headers={'Authorization': 'Bearer wrong'}, json={'session_id': SESSION}).status_code == 401
    assert client.post('/chatbot/start', headers=HEADERS, json={'session_id': SESSION}).status_code == 200


def test_uuid_message_and_body_bounds(client):
    assert client.post('/chatbot/start', headers=HEADERS, json={'session_id': 'bad'}).status_code == 422
    assert client.post('/chatbot/message', headers=HEADERS, json={'session_id': SESSION, 'message': 'x'*4001}).status_code == 422
    assert client.post('/chatbot/message', headers=HEADERS, json={'session_id': SESSION, 'message': ' '}).status_code == 422
    assert client.post('/chatbot/message', headers=HEADERS, content=b'x'*17000).status_code == 413


def test_model_failure_is_503_not_fake_medical_success(client, monkeypatch):
    import app as service
    client.post('/chatbot/start', headers=HEADERS, json={'session_id': SESSION})
    monkeypatch.setattr(service, 'process_chat_message', MagicMock(side_effect=RuntimeError('private details')))
    result = client.post('/chatbot/message', headers=HEADERS, json={'session_id': SESSION, 'message': 'Pain'})
    assert result.status_code == 503
    assert 'reply' not in result.json()
    assert 'private' not in result.text


def test_health_readiness_and_expired_sessions(client):
    assert client.get('/health').status_code == 200
    assert client.get('/ready').status_code == 200
    result = client.post('/chatbot/message', headers=HEADERS, json={'session_id': '22222222-2222-4222-8222-222222222222', 'message': 'Pain'})
    assert result.status_code == 409


def test_reset_clears_both_memory_and_symptoms():
    from memory import clear_session_memory, get_session_memory
    from symptom_tracker import update_symptoms, get_symptoms
    memory = get_session_memory(SESSION)
    memory.save_context({'input': 'Pain'}, {'output': 'Where?'})
    update_symptoms(SESSION, ['pain'])
    clear_session_memory(SESSION)
    assert get_symptoms(SESSION) == []


def test_memory_ttl_capacity_and_history_bounds(monkeypatch):
    import memory
    memory._memories.clear()
    monkeypatch.setattr(memory, 'MAX_SESSIONS', 2)
    monkeypatch.setattr(memory, 'SESSION_TTL_SECONDS', 5)
    monkeypatch.setattr(memory, 'monotonic', lambda: 0)
    first = memory.get_session_memory('first', k=2)
    for _ in range(10):
        first.save_context({'input': 'hello'}, {'output': 'next'})
    assert len(first.chat_memory.messages) == 4
    memory.get_session_memory('second')
    memory.get_session_memory('third')
    assert len(memory._memories) == 2
    assert memory.get_all_memory_messages('first') == ''
    monkeypatch.setattr(memory, 'monotonic', lambda: 10)
    assert memory.get_all_memory_messages('second') == ''
    assert not memory._memories


def test_importing_triage_never_constructs_llm_client(monkeypatch):
    import groq
    monkeypatch.delenv('GROQ_API_KEY', raising=False)
    constructor = MagicMock(side_effect=AssertionError('client created during import'))
    monkeypatch.setattr(groq, 'Groq', constructor)
    import triage_engine
    importlib.reload(triage_engine)
    constructor.assert_not_called()
    with pytest.raises(RuntimeError):
        triage_engine.get_llm_response([{'role': 'user', 'content': 'test'}])


def test_not_configured_or_failed_initialization_is_not_ready(monkeypatch):
    import app as service
    monkeypatch.delenv('AI_SERVICE_TOKEN', raising=False)
    monkeypatch.delenv('GROQ_API_KEY', raising=False)
    with TestClient(service.app) as client:
        assert client.get('/health').status_code == 200
        assert client.get('/ready').status_code == 503
        assert client.post('/chatbot/start', headers=HEADERS, json={'session_id': SESSION}).status_code == 503
    monkeypatch.setenv('AI_SERVICE_TOKEN', 'test-token')
    monkeypatch.setenv('GROQ_API_KEY', 'offline-test-key')
    monkeypatch.setattr(service, 'init_chatbot', MagicMock(side_effect=RuntimeError('private failure')))
    with TestClient(service.app) as client:
        assert client.get('/ready').status_code == 503


def test_successful_message_runs_in_worker_thread(client, monkeypatch):
    import threading
    import app as service
    main_thread = threading.get_ident()
    calls = []
    def process(*_):
        calls.append(threading.get_ident())
        return 'How long?'
    monkeypatch.setattr(service, 'process_chat_message', process)
    client.post('/chatbot/start', headers=HEADERS, json={'session_id': SESSION})
    result = client.post('/chatbot/message', headers=HEADERS, json={'session_id': SESSION, 'message': 'Pain'})
    assert result.status_code == 200
    assert result.json()['reply'] == 'How long?'
    assert calls[0] != main_thread


def test_summary_errors_are_explicit(client, monkeypatch):
    import app as service
    from memory import get_session_memory
    client.post('/chatbot/start', headers=HEADERS, json={'session_id': SESSION})
    assert client.get(f'/chatbot/summary/{SESSION}', headers=HEADERS).status_code == 409
    get_session_memory(SESSION).save_context({'input': 'Pain'}, {'output': 'Where?'})
    monkeypatch.setattr(service, 'generate_soap_summary', MagicMock(side_effect=ValueError('invalid JSON')))
    assert client.get(f'/chatbot/summary/{SESSION}', headers=HEADERS).status_code == 503


def test_chunked_request_limit_does_not_require_content_length(client):
    result = client.post('/chatbot/message', headers=HEADERS, content=(b'x'*9000 for _ in range(2)))
    assert result.status_code == 413


def test_provider_client_is_lazy_bounded_and_retry_free(monkeypatch):
    import groq
    import triage_engine
    monkeypatch.setenv('GROQ_API_KEY', 'offline-test-key')
    monkeypatch.setenv('GROQ_MODEL', 'approved-test-model')
    monkeypatch.setattr(triage_engine, '_client', None)
    factory = MagicMock()
    factory.return_value.chat.completions.create.return_value.choices = [type('Choice', (), {'message': type('Message', (), {'content': 'How long?'})()})()]
    monkeypatch.setattr(groq, 'Groq', factory)
    assert triage_engine.get_llm_response([{'role': 'user', 'content': 'Pain'}]) == 'How long?'
    factory.assert_called_once_with(api_key='offline-test-key', timeout=10.0, max_retries=0)
    assert factory.return_value.chat.completions.create.call_args.kwargs['model'] == 'approved-test-model'
