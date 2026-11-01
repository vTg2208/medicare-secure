"""Optional RAG adapter. Imports and model downloads occur only when RAG is enabled."""
import os
from pathlib import Path
from types import SimpleNamespace


class VectorStore:
    def __init__(self, collection, embeddings):
        self.collection, self.embeddings = collection, embeddings
        self.k = 2

    def as_retriever(self, search_kwargs=None):
        self.k = (search_kwargs or {}).get('k', 2)
        return self

    def invoke(self, text):
        count = self.collection.count()
        if not count:
            return []
        result = self.collection.query(query_embeddings=self.embeddings.encode([text]).tolist(), n_results=min(count, self.k))
        return [SimpleNamespace(page_content=text) for text in result['documents'][0]]


def get_vector_store(persist_directory=None, docs_dir=None):
    import chromadb
    from sentence_transformers import SentenceTransformer
    from document_loader import load_and_split_documents

    root = Path(__file__).resolve().parent
    persist_directory = persist_directory or os.getenv('CHROMA_PATH', str(root / 'chroma_db'))
    docs_dir = docs_dir or os.getenv('MEDICAL_DOCS_DIR', str(root / 'medical_docs'))
    embeddings = SentenceTransformer(os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'))
    client = chromadb.PersistentClient(path=str(persist_directory), settings=chromadb.Settings(anonymized_telemetry=False))
    collection = client.get_or_create_collection('medical_guidelines', embedding_function=None)
    if not collection.count():
        chunks = load_and_split_documents(docs_dir)
        # Bound each batch to avoid unbounded embedding/insert allocation.
        for offset in range(0, len(chunks), 100):
            texts = [chunk.page_content for chunk in chunks[offset:offset+100]]
            collection.add(ids=[str(i) for i in range(offset, offset + len(texts))], documents=texts, embeddings=embeddings.encode(texts).tolist())
    return VectorStore(collection, embeddings)
