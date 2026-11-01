import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

from vector_store import get_vector_store


def test_vector_store_initializes_and_retrieves_without_real_models(monkeypatch, tmp_path):
    collection = MagicMock()
    collection.count.side_effect = [0, 1]
    collection.query.return_value = {'documents': [['A local guideline']]}
    chroma = MagicMock()
    chroma.PersistentClient.return_value.get_or_create_collection.return_value = collection
    embeddings = MagicMock()
    embeddings.encode.return_value.tolist.return_value = [[0.1, 0.2]]
    model = MagicMock(return_value=embeddings)
    monkeypatch.setitem(sys.modules, 'chromadb', chroma)
    monkeypatch.setitem(sys.modules, 'sentence_transformers', SimpleNamespace(SentenceTransformer=model))
    (tmp_path / 'guide.txt').write_text('A local guideline', encoding='utf-8')
    db = get_vector_store(persist_directory=str(tmp_path / 'chroma'), docs_dir=tmp_path)
    assert collection.add.call_args.kwargs['documents'] == ['A local guideline']
    result = db.as_retriever(search_kwargs={'k': 2}).invoke('pain')
    assert result[0].page_content == 'A local guideline'
    assert collection.query.call_args.kwargs['n_results'] == 1
    model.assert_called_once()


def test_empty_retriever_does_not_query_or_embed():
    from vector_store import VectorStore
    collection, embeddings = MagicMock(), MagicMock()
    collection.count.return_value = 0
    assert VectorStore(collection, embeddings).invoke('pain') == []
    collection.query.assert_not_called()
    embeddings.encode.assert_not_called()
