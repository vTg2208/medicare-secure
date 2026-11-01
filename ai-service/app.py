"""Internal AI service. Run one worker: short-lived session state is process-local."""
import hmac
import logging
import os
from contextlib import asynccontextmanager
from uuid import UUID

from dotenv import load_dotenv
load_dotenv()
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from chatbot import process_chat_message, generate_soap_summary, init_chatbot
from memory import clear_session_memory, get_session_memory

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app):
    app.state.ready = False
    if not os.getenv('AI_SERVICE_TOKEN') or not os.getenv('GROQ_API_KEY'):
        logger.error('AI service requires AI_SERVICE_TOKEN and GROQ_API_KEY')
    else:
        try:
            await run_in_threadpool(init_chatbot)
            app.state.ready = True
        except Exception:
            logger.error('AI service initialization failed')
    yield
    app.state.ready = False

app = FastAPI(title='AI Chatbot Service', lifespan=lifespan)
app.state.ready = False
MAX_REQUEST_BYTES = 16384

class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        # Enforce actual streamed byte count too, including chunked requests.
        messages, total = [], 0
        while True:
            event = await receive()
            if event['type'] == 'http.disconnect':
                return
            total += len(event.get('body', b''))
            if total > MAX_REQUEST_BYTES:
                return await JSONResponse({'detail': 'Request body too large'}, status_code=413)(scope, receive, send)
            messages.append(event)
            if not event.get('more_body', False):
                break
        async def replay():
            return messages.pop(0) if messages else await receive()
        await self.app(scope, replay, send)

app.add_middleware(BodyLimit)


def authenticated(authorization: str = Header(default='')):
    token = os.getenv('AI_SERVICE_TOKEN', '')
    if not token:
        raise HTTPException(status_code=503, detail='AI service is not configured')
    if not hmac.compare_digest(authorization.encode(), f'Bearer {token}'.encode()):
        raise HTTPException(status_code=401, detail='Invalid service credentials')
    if not app.state.ready:
        raise HTTPException(status_code=503, detail='AI service is not ready')

class StartSessionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    session_id: UUID

class MessageRequest(StartSessionRequest):
    message: str = Field(min_length=1, max_length=4000)

    @field_validator('message')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('Message must not be blank')
        return value.strip()

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get('/ready')
def ready():
    if not app.state.ready:
        raise HTTPException(status_code=503, detail='AI service is not ready')
    return {'status': 'ready'}

@app.post('/chatbot/start', dependencies=[Depends(authenticated)])
def start_session(req: StartSessionRequest):
    session_id = str(req.session_id)
    clear_session_memory(session_id)
    get_session_memory(session_id)
    return {'status': 'started', 'message': 'Session initialized.'}

@app.post('/chatbot/message', dependencies=[Depends(authenticated)])
def handle_message(req: MessageRequest):
    try:
        memory = get_session_memory(str(req.session_id), create=False)
        with memory.lock:
            reply = process_chat_message(str(req.session_id), req.message)
        return {'reply': reply}
    except KeyError:
        raise HTTPException(status_code=409, detail='Session expired. Start a new pre-screening session.')
    except Exception:
        logger.error('AI message processing failed')
        raise HTTPException(status_code=503, detail='AI pre-screening is unavailable. Contact a clinician for assistance.')

@app.get('/chatbot/summary/{session_id}', dependencies=[Depends(authenticated)])
def get_summary(session_id: UUID):
    try:
        memory = get_session_memory(str(session_id), create=False)
        with memory.lock:
            if not memory.buffer_as_str.strip():
                raise HTTPException(status_code=409, detail="A conversation is required before generating a summary.")
            summary = generate_soap_summary(str(session_id))
        return {'summary': summary}
    except KeyError:
        raise HTTPException(status_code=409, detail='Session expired. Start a new pre-screening session.')
    except HTTPException:
        raise
    except Exception:
        logger.error('AI summary generation failed')
        raise HTTPException(status_code=503, detail='AI summary generation is unavailable.')
