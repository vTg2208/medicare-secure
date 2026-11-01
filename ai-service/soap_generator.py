"""Compatibility entry point for SOAP generation using the configured provider."""
from triage_engine import SoapPrompt, get_llm_response, parse_soap_response


def generate_soap(conversation):
    return parse_soap_response(get_llm_response([
        {'role': 'system', 'content': SoapPrompt.format(chat_history='')},
        {'role': 'user', 'content': conversation},
    ], temperature=0.0, max_tokens=500))
