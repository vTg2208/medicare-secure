FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements*.txt ./
ARG ENABLE_RAG=false
RUN pip install --no-cache-dir -r requirements.txt && \
    if [ "$ENABLE_RAG" = "true" ]; then pip install --no-cache-dir -r requirements-rag.txt; fi && \
    groupadd --system ai && useradd --system --gid ai --create-home ai
COPY --chown=ai:ai *.py ./
COPY --chown=ai:ai medical_docs ./medical_docs
RUN mkdir -p /app/chroma_db && chown ai:ai /app/chroma_db
USER ai
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3)"]
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-concurrency", "40", "--timeout-keep-alive", "5"]
