import concurrent.futures
import sqlite3
import sys
import threading
from types import SimpleNamespace

import pytest

from vector_store import VectorStore, get_vector_store


class FakeEmbeddings:
    def __init__(self):
        self.calls = []
        self.vectors = {
            'Cardiac reference': [2.0, 0.0, 0.0],
            'Respiratory reference': [0.0, 100.0, 0.0],
            'General reference': [1.0, 1.0, 0.0],
            'Updated reference': [0.0, 0.0, 1.0],
            'chest pain': [3.0, 1.0, 0.0],
        }
        self.probe = [1.0, 1.0, 1.0]

    def encode(self, texts):
        self.calls.append(list(texts))
        return [self.vectors.get(text, self.probe) for text in texts]


@pytest.fixture
def local_index(monkeypatch, tmp_path):
    embeddings = FakeEmbeddings()
    model_calls = []

    def model(name, **kwargs):
        assert kwargs.get('trust_remote_code') is False
        model_calls.append((name, kwargs))
        return embeddings

    monkeypatch.setitem(sys.modules, 'sentence_transformers', SimpleNamespace(SentenceTransformer=model))
    monkeypatch.setenv('EMBEDDING_MODEL', 'local-test-model')
    monkeypatch.delenv('EMBEDDING_MODEL_REVISION', raising=False)
    documents = tmp_path / 'references'
    documents.mkdir()
    (documents / 'a.txt').write_text('Cardiac reference', encoding='utf-8')
    (documents / 'b.txt').write_text('Respiratory reference', encoding='utf-8')
    (documents / 'c.txt').write_text('General reference', encoding='utf-8')
    persistence = tmp_path / 'index'

    def open_index():
        return get_vector_store(persist_directory=persistence, docs_dir=documents)

    return SimpleNamespace(embeddings=embeddings, models=model_calls, docs=documents,
                           path=persistence, open=open_index)


def test_cosine_ranking_ignores_vector_magnitude_and_bounds_results(local_index):
    store = local_index.open()
    assert [doc.page_content for doc in store.as_retriever({'k': 20}).invoke('chest pain')] == [
        'Cardiac reference', 'General reference', 'Respiratory reference',
    ]
    assert [doc.page_content for doc in store.as_retriever({'k': 1}).invoke('chest pain')] == [
        'Cardiac reference',
    ]


def test_reopen_reuses_persisted_embeddings_and_supports_worker_threads(local_index):
    local_index.open()
    local_index.embeddings.calls.clear()
    reopened = local_index.open()
    # A model probe is allowed at startup; source documents must use the cached index.
    assert all('Cardiac reference' not in batch for batch in local_index.embeddings.calls)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        result = executor.submit(reopened.invoke, 'chest pain').result(timeout=5)
    assert result[0].page_content == 'Cardiac reference'


def test_concurrent_model_rebuild_cannot_mix_cached_metadata_and_vectors(local_index, monkeypatch):
    local_index.open()
    other_model = FakeEmbeddings()
    other_model.probe = [1.0, 0.0, 1.0]
    other_model.vectors.update({
        'Cardiac reference': [0.0, 2.0, 0.0],
        'Respiratory reference': [100.0, 0.0, 0.0],
        'chest pain': [1.0, 3.0, 0.0],
    })
    thread_state = threading.local()
    monkeypatch.setitem(sys.modules, 'sentence_transformers', SimpleNamespace(
        SentenceTransformer=lambda *args, **kwargs: getattr(thread_state, 'model', local_index.embeddings),
    ))
    metadata_read, writer_finished = threading.Event(), threading.Event()
    original_connect = sqlite3.connect
    paused = False

    class PausingConnection(sqlite3.Connection):
        def execute(self, statement, *args):
            nonlocal paused
            cursor = super().execute(statement, *args)
            if statement.startswith('SELECT value FROM index_metadata') and not hasattr(thread_state, 'model') and not paused:
                # Consume and close the SELECT cursor so only an explicit transaction
                # can prevent the other startup from replacing the associated vectors.
                value = cursor.fetchone()
                cursor.close()
                paused = True
                metadata_read.set()
                assert writer_finished.wait(5), 'Concurrent startup did not finish its lock attempt'
                return SimpleNamespace(fetchone=lambda: value)
            return cursor

    def connect(*args, **kwargs):
        kwargs['factory'] = PausingConnection
        if hasattr(thread_state, 'model'):
            kwargs['timeout'] = 0  # Deterministically report the held lock without a sleep.
        return original_connect(*args, **kwargs)

    monkeypatch.setattr(sqlite3, 'connect', connect)

    def other_startup():
        thread_state.model = other_model
        assert metadata_read.wait(5), 'First startup never reached its cache metadata'
        try:
            return local_index.open(), None
        except sqlite3.OperationalError as error:
            return None, error
        finally:
            writer_finished.set()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        competing = executor.submit(other_startup)
        first = local_index.open()
        second, blocked = competing.result(timeout=5)
        assert first.invoke('chest pain')[0].page_content == 'Cardiac reference'
        assert second is None and 'locked' in str(blocked)
        # Once the first snapshot completes, the second model can rebuild safely.
        second, error = executor.submit(other_startup).result(timeout=5)
        assert error is None
        assert second.invoke('chest pain')[0].page_content == 'Cardiac reference'
        assert first.invoke('chest pain')[0].page_content == 'Cardiac reference'


def test_changed_and_removed_references_rebuild_the_index(local_index):
    local_index.open()
    (local_index.docs / 'a.txt').write_text('Updated reference', encoding='utf-8')
    (local_index.docs / 'b.txt').unlink()
    local_index.embeddings.calls.clear()
    rebuilt = local_index.open()
    texts = [doc.page_content for doc in rebuilt.as_retriever({'k': 10}).invoke('chest pain')]
    assert set(texts) == {'Updated reference', 'General reference'}
    assert any('Updated reference' in batch for batch in local_index.embeddings.calls)


@pytest.mark.parametrize('changed', ['identifier', 'revision', 'weights'])
def test_model_changes_rebuild_embeddings(local_index, monkeypatch, changed):
    local_index.open()
    local_index.embeddings.calls.clear()
    if changed == 'identifier':
        monkeypatch.setenv('EMBEDDING_MODEL', 'different-local-model')
    elif changed == 'revision':
        monkeypatch.setenv('EMBEDDING_MODEL_REVISION', 'reviewed-revision')
    else:
        local_index.embeddings.probe = [0.0, 1.0, 1.0]
    local_index.open()
    assert any('Cardiac reference' in batch for batch in local_index.embeddings.calls)
    if changed == 'revision':
        assert local_index.models[-1][1] == {'trust_remote_code': False, 'revision': 'reviewed-revision'}


def test_legacy_chroma_directory_is_not_modified(local_index, monkeypatch):
    local_index.path.mkdir()
    old_database = local_index.path / 'chroma.sqlite3'
    old_database.write_bytes(b'legacy database must remain untouched')
    monkeypatch.delenv('VECTOR_INDEX_PATH', raising=False)
    monkeypatch.setenv('CHROMA_PATH', str(local_index.path))
    store = get_vector_store(docs_dir=local_index.docs)
    assert store.invoke('chest pain')[0].page_content == 'Cardiac reference'
    assert old_database.read_bytes() == b'legacy database must remain untouched'
    assert (local_index.path / 'local-vectors.sqlite3').exists()


def test_new_index_path_takes_precedence_over_legacy_setting(local_index, monkeypatch, tmp_path):
    new_path = tmp_path / 'new-index'
    monkeypatch.setenv('VECTOR_INDEX_PATH', str(new_path))
    monkeypatch.setenv('CHROMA_PATH', str(local_index.path))
    get_vector_store(docs_dir=local_index.docs)
    assert (new_path / 'local-vectors.sqlite3').exists()
    assert not local_index.path.exists()


def test_empty_retriever_does_not_embed():
    class NoEmbeddingCalls:
        def encode(self, texts):
            raise AssertionError('Empty index must not embed a query')

    assert VectorStore([], [], NoEmbeddingCalls()).invoke('pain') == []


@pytest.mark.parametrize('vector', [[float('nan'), 0.0, 1.0], [0.0, 0.0, 0.0], [1.0]])
def test_invalid_document_embedding_does_not_replace_persisted_index(local_index, vector):
    local_index.open()
    before = (local_index.path / 'local-vectors.sqlite3').read_bytes()
    (local_index.docs / 'a.txt').write_text('Updated reference', encoding='utf-8')
    local_index.embeddings.vectors['Updated reference'] = vector
    with pytest.raises(ValueError):
        local_index.open()
    assert (local_index.path / 'local-vectors.sqlite3').read_bytes() == before


def test_invalid_cached_vectors_are_rebuilt_from_references(local_index):
    local_index.open()
    with sqlite3.connect(local_index.path / 'local-vectors.sqlite3') as connection:
        connection.execute("UPDATE reference_chunks SET vector = '[0, 0, 0]'")
    local_index.embeddings.calls.clear()
    assert local_index.open().invoke('chest pain')[0].page_content == 'Cardiac reference'
    assert any('Cardiac reference' in batch for batch in local_index.embeddings.calls)


@pytest.mark.parametrize('k', [0, -1, 1.5, True, '2'])
def test_retriever_rejects_invalid_result_limits(k):
    with pytest.raises(ValueError):
        VectorStore([], [], None).as_retriever({'k': k})
