# AI pre-screening service

This optional internal service collects patient-reported symptoms and produces a draft summary for clinician review. It is not a diagnostic or emergency assessment system. Model routing confidence never changes clinical urgency or queue priority.

## Configuration and startup

The API disables AI by default. To enable it, set `AI_ENABLED=true`, `AI_SERVICE_URL` to this service's private URL, and `AI_SERVICE_TOKEN` to a strong shared secret. Set the same `AI_SERVICE_TOKEN` and a valid `GROQ_API_KEY` in this service's environment. Keep these values out of frontend builds and source control.

`GROQ_MODEL` defaults to `llama-3.1-8b-instant`. Select a model available to your Groq account and confirm its current availability in the [official model list](https://console.groq.com/docs/models). No provider call occurs during import or startup.

Install runtime dependencies with `python -m pip install -r requirements.txt`, then run from this directory:

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1 --limit-concurrency 40 --timeout-keep-alive 5
```

Use exactly one worker while session state remains in memory. `GET /health` checks process liveness. `GET /ready` returns 503 unless required settings exist and optional retrieval initialized successfully. Readiness does not validate the external API key, model entitlement, provider reachability, or clinical quality.

`POST /chatbot/start`, `POST /chatbot/message`, and `GET /chatbot/summary/{session_id}` require `Authorization: Bearer <AI_SERVICE_TOKEN>`. Session identifiers must be UUIDs, messages contain 1-4000 characters, and request bodies are limited to 16 KiB, including streamed bodies. Model failures and invalid generated summaries return 503 rather than successful medical content. Provider requests use a 10-second timeout and no retries; the API bounds requests to 30 seconds.

## Session retention

History keeps the latest ten patient/assistant exchanges. State is limited to 1000 sessions and expires after 30 idle minutes; history and extracted symptoms are evicted together. Calls within one session are serialized. Restarting the service, expiry, or capacity eviction requires starting a new session (HTTP 409). The application database separately retains authorized conversation and summary records according to its retention policy.

## Optional retrieval

Retrieval is disabled by default. Enable it only after installing `requirements-rag.txt` and setting `AI_RAG_ENABLED=true`. For Docker, also build with `--build-arg ENABLE_RAG=true`. Startup loads local references and the embedding model; uncached embeddings require a Hugging Face download. Configure `EMBEDDING_MODEL`, `MEDICAL_DOCS_DIR`, and `CHROMA_PATH` if needed. Defaults are `sentence-transformers/all-MiniLM-L6-v2`, this directory's `medical_docs`, and this directory's `chroma_db`.

The adapter uses the Chroma `medical_guidelines` collection and explicit embeddings. Provide a writable persistent Chroma directory and an embedding cache for repeatable startup. Rebuild that collection when changing the embedding model or clinical references. Existing legacy `langchain` collections are not reused. Review reference provenance and currency before relying on retrieval.

## Offline verification

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest . -q
python -m pip check
```

Tests mock the provider, Chroma and embedding model and block external socket connections. They test authorization, request limits, startup readiness, error propagation, bounded history, symptom eviction, final-message retention, summary validation and optional retrieval. Installing test dependencies does not install or download embedding models. The tests establish application behavior; they do not validate medical accuracy, provider account access, or the production container runtime.
