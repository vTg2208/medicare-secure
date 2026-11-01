from memory import get_session_memory


def update_symptoms(session_id, new_symptoms):
    memory = get_session_memory(session_id)
    with memory.lock:
        for symptom in new_symptoms:
            if isinstance(symptom, str) and symptom.strip() and len(memory.symptoms) < 100:
                memory.symptoms.add(symptom.strip()[:200])
        return sorted(memory.symptoms)


def get_symptoms(session_id):
    try:
        return sorted(get_session_memory(session_id, create=False).symptoms)
    except KeyError:
        return []
