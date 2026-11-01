from triage_engine import parse_soap_response

def test_parse_soap_response_valid():
    sample_json = '''```json
    {
      "subjective": "Chest pain",
      "objective": "For 2 hours",
      "assessment": "Cardiac",
      "plan": "Review",
      "recommended_department": "Cardiology",
      "confidence_score": 0.85
    }
    ```'''
    res = parse_soap_response(sample_json)
    assert res["recommended_department"] == "Cardiology"
    
def test_parse_soap_response_low_confidence():
    sample_json = '''{
      "subjective": "Unknown",
      "objective": "None",
      "assessment": "Vague",
      "plan": "Check",
      "recommended_department": "Neurology",
      "confidence_score": 0.5
    }'''
    res = parse_soap_response(sample_json)
    # Because confidence < 0.6, the fallback should trigger
    assert res["recommended_department"] == "General Physician"


def test_malformed_summaries_fail_instead_of_becoming_medical_success():
    import pytest
    for response in ['not json', '{}', '{"confidence_score": NaN}', '[]']:
        with pytest.raises((ValueError, TypeError)):
            parse_soap_response(response)
