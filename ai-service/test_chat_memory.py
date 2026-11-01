from memory import get_session_memory, clear_session_memory, get_all_memory_messages

def test_memory_save_and_retrieve():
    session_id = "test_session_1"
    
    # Ensure starting clean
    clear_session_memory(session_id)
    mem = get_session_memory(session_id)
    
    mem.save_context({"input": "Hello"}, {"output": "Hi there!"})
    
    history = get_all_memory_messages(session_id)
    assert "Hello" in history
    assert "Hi there!" in history
    
    # Cleanup
    clear_session_memory(session_id)
    assert get_all_memory_messages(session_id) == ""
