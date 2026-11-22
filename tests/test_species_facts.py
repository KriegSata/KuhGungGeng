from backend.classifier_catalog import documents
from backend.species_facts import enrich


def test_all_classifier_species_have_sourced_locations_and_explicit_safety_status():
    for document in documents():
        facts = enrich(document)
        assert facts['habitat'] != 'Not yet reviewed.'
        assert facts['distribution'] != 'Not yet reviewed.'
        assert facts['sources']
        assert facts['toxicity'] in {'unknown', 'diet_related_risk_reported'}
        assert facts['edibility'] in {'unknown', 'reported_food_use'}
        assert facts['last_reviewed'] is None
    cardisoma = enrich(next(d for d in documents() if d['id'] == 'cardisoma-carnifex'))
    assert cardisoma['toxicity'] == 'diet_related_risk_reported'
    assert cardisoma['claim_sources']['toxicity']


def test_reference_refresh_preserves_reviewed_species_knowledge():
    document = dict(id='scylla-serrata', identification_status='expert_reviewed', habitat='Reviewed habitat')
    assert enrich(document) == document
