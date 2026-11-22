from backend.classifier_catalog import documents
from backend.species_facts import enrich


def test_all_classifier_species_have_sourced_locations_and_explicit_safety_status():
    for document in documents():
        facts = enrich(document)
        assert facts['habitat'] != 'Not yet reviewed.'
        assert facts['distribution'] != 'Not yet reviewed.'
        assert facts['sources']
        assert facts['description']
        assert facts['toxicity'] in {'unknown', 'diet_related_risk_reported'}
        assert facts['edibility'] in {'unknown', 'reported_food_use'}
        assert facts['last_reviewed'] is None
    cardisoma = enrich(next(d for d in documents() if d['id'] == 'cardisoma-carnifex'))
    assert cardisoma['toxicity'] == 'diet_related_risk_reported'
    assert cardisoma['claim_sources']['toxicity']


def test_reference_refresh_preserves_reviewed_species_knowledge():
    document = dict(id='scylla-serrata', identification_status='expert_reviewed', habitat='Reviewed habitat')
    assert enrich(document) == document


def test_nutrition_uses_matching_food_records_and_keeps_missing_cholesterol():
    from backend.nutrition import nutrition_for
    assert nutrition_for('portunus-pelagicus')['cholesterol_mg'] == 118
    assert nutrition_for('scylla-serrata')['cholesterol_mg'] is None
    assert nutrition_for('scylla-olivacea') is None
    assert nutrition_for('charybdis-feriata') is None
    assert nutrition_for('ranina-ranina')['cholesterol_mg'] == 29
