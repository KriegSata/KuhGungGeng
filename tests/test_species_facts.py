import json
from pathlib import Path

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


def test_all_guide_entries_have_sourced_traits_and_toxic_entries_keep_the_warning():
    seed = Path(__file__).resolve().parents[1] / 'backend' / 'seed' / 'species.json'
    catalog = {doc['id']: doc for doc in [*documents(), *json.loads(seed.read_text(encoding='utf-8'))]}
    for doc in catalog.values():
        facts = enrich(doc)
        for field in ('diagnostic_traits', 'habitat', 'distribution', 'size_range', 'coloration', 'lookalikes'):
            assert facts[field]
            assert facts['claim_sources'][field]
        assert enrich(facts) == facts
        if facts['id'] in {'zosimus-aeneus', 'atergatis-floridus'}:
            assert facts['toxicity'] == 'toxic'
            assert facts['nutrition'] is None
            assert 'bfar-pia-2026' in facts['claim_sources']['toxicity']


def test_nutrition_uses_matching_food_records_and_keeps_missing_cholesterol():
    from backend.nutrition import nutrition_for
    assert nutrition_for('portunus-pelagicus')['cholesterol_mg'] == 118
    assert nutrition_for('scylla-serrata')['cholesterol_mg'] is None
    assert nutrition_for('scylla-olivacea')['nutrients'][0]['value'] == 19.24
    assert nutrition_for('charybdis-feriata')['cholesterol_mg'] is None
    assert nutrition_for('ranina-ranina')['cholesterol_mg'] == 54
    assert nutrition_for('cardisoma-carnifex') is None
    assert nutrition_for('ocypode-ceratophthalma') is None
    assert nutrition_for('hemigrapsus-sanguineus') is None
