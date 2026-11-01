import json
from unittest.mock import MagicMock

import pytest

import chatbot
from memory import clear_session_memory, get_session_memory
from symptom_tracker import get_symptoms

SESSION = 'offline-triage'
SUMMARY = dict(subjective='Pain', objective='Reported', assessment='Needs review', plan='Clinician review', recommended_department='Cardiology', confidence_score=0.8)

@pytest.fixture(autouse=True)
def clean_session(monkeypatch):
    monkeypatch.setenv('AI_RAG_ENABLED', 'false')
    clear_session_memory(SESSION)
    yield
    clear_session_memory(SESSION)


def test_message_uses_history_and_saves_only_successful_output(monkeypatch):
    memory = get_session_memory(SESSION)
    memory.save_context({'input': 'Earlier pain'}, {'output': 'Where?'})
    monkeypatch.setattr(chatbot, 'extract_symptoms_llm', lambda _: ['headache'])
    llm = MagicMock(return_value='For how long?')
    monkeypatch.setattr(chatbot, 'get_llm_response', llm)
    assert chatbot.process_chat_message(SESSION, 'Headache') == 'For how long?'
    assert 'Earlier pain' in llm.call_args.args[0][0]['content']
    assert 'headache' in get_symptoms(SESSION)
    assert 'Headache' in memory.buffer_as_str
    old_history = memory.buffer_as_str
    llm.side_effect = RuntimeError('unavailable')
    monkeypatch.setattr(chatbot, 'extract_symptoms_llm', lambda _: ['new symptom'])
    with pytest.raises(RuntimeError):
        chatbot.process_chat_message(SESSION, 'New input')
    assert memory.buffer_as_str == old_history
    assert 'new symptom' not in get_symptoms(SESSION)


def test_final_message_is_included_in_summary(monkeypatch):
    memory = get_session_memory(SESSION)
    for _ in range(5):
        memory.save_context({'input': 'Pain'}, {'output': 'Where?'})
    llm = MagicMock(return_value=json.dumps(SUMMARY))
    monkeypatch.setattr(chatbot, 'get_llm_response', llm)
    reply = chatbot.process_chat_message(SESSION, 'Now having difficulty breathing')
    assert 'difficulty breathing' in llm.call_args.args[0][1]['content']
    assert 'Cardiology' in reply
    assert 'Clinician Review Required' in reply
    assert 'not a diagnosis or an emergency assessment' in reply
    assert 'difficulty breathing' in memory.buffer_as_str


def test_enabled_rag_passes_references_to_model(monkeypatch):
    monkeypatch.setenv('AI_RAG_ENABLED', 'true')
    get_session_memory(SESSION)
    retriever = MagicMock()
    retriever.invoke.return_value = [type('Doc', (), {'page_content': 'Reviewed reference'})()]
    monkeypatch.setattr(chatbot, 'retriever', retriever)
    monkeypatch.setattr(chatbot, 'extract_symptoms_llm', lambda _: [])
    llm = MagicMock(return_value='How long?')
    monkeypatch.setattr(chatbot, 'get_llm_response', llm)
    chatbot.process_chat_message(SESSION, 'Pain')
    assert 'Reviewed reference' in llm.call_args.args[0][0]['content']


def test_disabled_rag_does_not_load_optional_dependencies(monkeypatch):
    monkeypatch.setenv('AI_RAG_ENABLED', 'false')
    chatbot.init_chatbot()
    assert chatbot.get_retriever() is None


def test_summary_requires_real_conversation():
    get_session_memory(SESSION)
    with pytest.raises(ValueError):
        chatbot.generate_soap_summary(SESSION)
