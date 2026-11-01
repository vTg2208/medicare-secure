import os
from memory import get_session_memory
from triage_engine import get_llm_response, TriagePrompt, SoapPrompt, parse_soap_response, extract_symptoms_llm
from symptom_tracker import update_symptoms, get_symptoms

MAX_TRIAGE_QUESTIONS = 5

def assistant_message_count(memory):
    return len([
        m for m in memory.chat_memory.messages
        if m.type == "ai"
    ])

# Initialize global dependencies for the Chatbot
vector_store = None
retriever = None


def init_chatbot():
    global vector_store, retriever
    if os.getenv("AI_RAG_ENABLED", "false").lower() != "true":
        vector_store, retriever = None, None
        return
    from vector_store import get_vector_store
    vector_store = get_vector_store()
    retriever = vector_store.as_retriever(search_kwargs={"k": 2})


def get_retriever():
    global retriever
    if retriever is None and os.getenv("AI_RAG_ENABLED", "false").lower() == "true":
        init_chatbot()
    return retriever


def process_chat_message(session_id: str, user_message: str) -> str:
    """
    Core RAG pipeline for processing a single chat message.
    """

    memory = get_session_memory(session_id, create=False)

    if assistant_message_count(memory) >= MAX_TRIAGE_QUESTIONS:
        summary = generate_soap_summary(session_id, user_message)
        symptoms = get_symptoms(session_id)
        
        reply = "Draft Pre-Screening Summary - Clinician Review Required\n\nSymptoms:\n"
        if symptoms:
            for s in symptoms:
                reply += f"• {s}\n"
        else:
            reply += "• No specific symptoms recorded.\n"
            
        reply += f"\nSuggested Department:\n{summary.get('recommended_department', 'General Physician')}\n"
        reply += f"\nNext Step:\n{summary.get('plan', 'Consult a physician for further evaluation.')}"
        
        reply += "\n\nThis is not a diagnosis or an emergency assessment. Contact a clinician for care."
        memory.save_context({"input": user_message}, {"output": reply})
        return reply

    # Extract new symptoms and update tracker
    extracted_symptoms = extract_symptoms_llm(user_message)
    current_symptoms = sorted(set(get_symptoms(session_id) + extracted_symptoms))
    symptoms_str = ", ".join(current_symptoms) if current_symptoms else "None"

    # Retrieve relevant medical documents
    retriever_inst = get_retriever()
    docs = retriever_inst.invoke(user_message) if retriever_inst else []

    context_text = "\n\n".join([doc.page_content for doc in docs]) if docs else ""

    # Fallback if vector DB is empty
    if not context_text.strip():
        context_text = "No retrieved medical guidelines are available. Collect patient-reported symptoms only; do not invent clinical facts or give treatment advice."

    chat_history_str = memory.buffer_as_str

    system_prompt = TriagePrompt.format(
        context=context_text,
        symptoms=symptoms_str,
        chat_history=chat_history_str,
        input=""
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    response = get_llm_response(messages, temperature=0.2, max_tokens=60)

    # Save conversation in memory
    update_symptoms(session_id, extracted_symptoms)
    memory.save_context({"input": user_message}, {"output": response})

    return response


def generate_soap_summary(session_id: str, latest_message=None) -> dict:
    """
    Generates SOAP summary from conversation history.
    """

    memory = get_session_memory(session_id, create=False)
    chat_history_str = memory.buffer_as_str

    if latest_message:
        chat_history_str += f"\nhuman: {latest_message}"

    if not chat_history_str.strip():
        raise ValueError("A conversation is required")

    system_prompt = SoapPrompt.format(
        chat_history=""
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": chat_history_str}
    ]

    response = get_llm_response(messages, temperature=0.0, max_tokens=500)

    return parse_soap_response(response)