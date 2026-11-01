"""Load local clinical reference text and PDFs for optional retrieval."""
from pathlib import Path
from types import SimpleNamespace


def load_and_split_documents(docs_dir='medical_docs'):
    chunks = []
    root = Path(docs_dir)
    if not root.exists():
        raise FileNotFoundError('Medical reference directory does not exist')
    for path in sorted(root.rglob('*')):
        if path.suffix.lower() == '.txt':
            text = path.read_text(encoding='utf-8')
        elif path.suffix.lower() == '.pdf':
            from pypdf import PdfReader
            text = '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)
        else:
            continue
        for start in range(0, len(text), 450):
            part = text[start:start+500].strip()
            if part:
                chunks.append(SimpleNamespace(page_content=part))
    return chunks
