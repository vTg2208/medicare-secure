"""Optional local retrieval with explicit embeddings and a SQLite cache.

Only trusted local reference documents are indexed. No legacy vector database,
serialized Python objects, plugins or remote database endpoints are loaded.
"""
from contextlib import closing
import hashlib
import heapq
import json
import math
import os
from pathlib import Path
import sqlite3
from types import SimpleNamespace


def _normalized(vector, dimensions=None):
    if not isinstance(vector, (list, tuple)) or not vector:
        raise ValueError('Embedding must be a nonempty numeric vector')
    if dimensions is not None and len(vector) != dimensions:
        raise ValueError('Embedding dimensions do not match the current model')
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in vector):
        raise ValueError('Embedding must contain numbers')
    if not all(math.isfinite(value) for value in vector):
        raise ValueError('Embedding must contain finite numbers')
    norm = math.hypot(*vector)
    if not math.isfinite(norm) or not norm:
        raise ValueError('Embedding must have a finite nonzero norm')
    return tuple(value / norm for value in vector)


def _encode(embeddings, texts, dimensions=None):
    values = embeddings.encode(texts)
    values = values.tolist() if hasattr(values, 'tolist') else values
    if len(values) != len(texts):
        raise ValueError('Embedding model returned the wrong number of vectors')
    return [_normalized(vector, dimensions) for vector in values]


class VectorStore:
    def __init__(self, documents, vectors, embeddings, k=2):
        self.documents, self.vectors = tuple(documents), tuple(vectors)
        self.embeddings, self.k = embeddings, k

    def as_retriever(self, search_kwargs=None):
        k = (search_kwargs or {}).get('k', 2)
        if isinstance(k, bool) or not isinstance(k, int) or k < 1:
            raise ValueError('Retrieval result limit must be a positive integer')
        return VectorStore(self.documents, self.vectors, self.embeddings, k)

    def invoke(self, text):
        if not self.documents:
            return []
        query = _encode(self.embeddings, [text], len(self.vectors[0]))[0]
        # Unit vectors make cosine distance equal to 1 - dot product.
        closest = heapq.nsmallest(
            min(self.k, len(self.documents)), range(len(self.documents)),
            key=lambda index: 1 - sum(a * b for a, b in zip(query, self.vectors[index])),
        )
        return [SimpleNamespace(page_content=self.documents[index]) for index in closest]


def get_vector_store(persist_directory=None, docs_dir=None):
    # Optional dependencies and model downloads are deferred until RAG startup.
    from sentence_transformers import SentenceTransformer
    from document_loader import load_and_split_documents

    root = Path(__file__).resolve().parent
    directory = Path(persist_directory or os.getenv('VECTOR_INDEX_PATH')
                     or os.getenv('CHROMA_PATH', str(root / 'chroma_db')))
    docs_dir = docs_dir or os.getenv('MEDICAL_DOCS_DIR', str(root / 'medical_docs'))
    documents = [chunk.page_content for chunk in load_and_split_documents(docs_dir)]
    model_name = os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
    revision = os.getenv('EMBEDDING_MODEL_REVISION')
    embeddings = SentenceTransformer(model_name, trust_remote_code=False,
                                     **({'revision': revision} if revision else {}))
    # Also detect changed effective embeddings under an unchanged model alias.
    probe = _encode(embeddings, ['Local clinical reference retrieval model fingerprint.'])[0]
    fingerprint = hashlib.sha256(json.dumps({
        'schema': 1, 'model': model_name, 'revision': revision,
        'probe': probe, 'documents': documents,
    }, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()

    directory.mkdir(parents=True, exist_ok=True)
    # This new filename deliberately leaves all legacy Chroma files untouched.
    with closing(sqlite3.connect(directory / 'local-vectors.sqlite3', timeout=30)) as connection:
        with connection:
            # SELECTs alone do not start a Python sqlite3 transaction. Hold the
            # writer reservation across both cache reads and any rebuild so a
            # concurrent model startup cannot mix metadata with another index.
            connection.execute('BEGIN IMMEDIATE')
            connection.execute('CREATE TABLE IF NOT EXISTS index_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            connection.execute('CREATE TABLE IF NOT EXISTS reference_chunks (position INTEGER PRIMARY KEY, text TEXT NOT NULL, vector TEXT NOT NULL)')
            cached = connection.execute("SELECT value FROM index_metadata WHERE key = 'fingerprint'").fetchone()
            vectors = None
            if cached and cached[0] == fingerprint:
                rows = connection.execute('SELECT text, vector FROM reference_chunks ORDER BY position').fetchall()
                if [row[0] for row in rows] == documents:
                    try:
                        vectors = [_normalized(json.loads(row[1]), len(probe)) for row in rows]
                    except (ValueError, TypeError):
                        pass  # Rebuild an invalid cache from trusted local references.
            if vectors is None:
                vectors = []
                for offset in range(0, len(documents), 100):
                    vectors.extend(_encode(embeddings, documents[offset:offset + 100], len(probe)))
                # Replace metadata and vectors atomically only after all encoding succeeds.
                connection.execute('DELETE FROM reference_chunks')
                connection.executemany('INSERT INTO reference_chunks (position, text, vector) VALUES (?, ?, ?)', (
                    (index, text, json.dumps(vector, allow_nan=False))
                    for index, (text, vector) in enumerate(zip(documents, vectors))
                ))
                connection.execute("INSERT OR REPLACE INTO index_metadata (key, value) VALUES ('fingerprint', ?)", (fingerprint,))
    # No SQLite connection escapes startup; immutable snapshots work in request threads.
    return VectorStore(documents, vectors, embeddings)
