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
            assert 'garth-alcala-1977' in facts['claim_sources']['toxicity']


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


def test_orange_mud_crab_whole_body_figures_keep_their_own_basis():
    from backend.nutrition import nutrition_for
    meat = nutrition_for('scylla-olivacea')
    whole = next(sample for sample in meat['additional_samples'] if sample['basis'] == '100 g whole-body sample')
    assert {'name': 'Energy', 'value': 102.5, 'unit': 'kcal'} in whole['nutrients']
    assert meat['estimated_energy']
    assert meat['cholesterol_mg'] is None and whole['cholesterol_mg'] is None


def test_additional_nutrition_samples_keep_their_measurements_and_sources():
    document = enrich(next(doc for doc in documents() if doc['id'] == 'scylla-serrata'))
    nutrition = document['nutrition']
    assert nutrition['country'] == 'Philippines'
    assert nutrition['cholesterol_mg'] is None
    raw = nutrition['additional_samples'][0]
    assert raw['country'] == 'Australia'
    assert raw['portion_g'] == 100
    assert {'name': 'Vitamin B12', 'value': 1.08, 'unit': 'µg'} in raw['vitamins']
    assert document['claim_sources']['nutrition'] == [
        'fnri-G041', 'frdc-mud-crab', 'mathew-1999', 'fnri-G040', 'fnri-G039', 'fao-ufish-092015', 'thai-fcd-2030', 'momen-selenium-2025',
    ]
    assert all(source_id in {source['id'] for source in document['sources']}
               for source_id in document['claim_sources']['nutrition'])
    assert enrich(document) == document


def test_shared_local_names_do_not_assign_the_same_toxicity():
    ghost = enrich(next(doc for doc in documents() if doc['id'] == 'ocypode-ceratophthalma'))
    assert ghost['toxicity'] == 'unknown'
    assert ghost['scientific_name'] == 'Ocypode ceratophthalmus'
    assert 'Ocypode ceratophthalma' in ghost['synonyms']
    assert ghost['shared_local_name']['species_id'] == 'atergatis-floridus'
    assert 'Agokoy' in {item['name'] for item in ghost['names']}
    assert 'floral-agokoy' in ghost['claim_sources']['shared_local_name']
    land = enrich(next(doc for doc in documents() if doc['id'] == 'cardisoma-carnifex'))
    assert {'Kuray', 'Kagang'} <= {item['name'] for item in land['names']}
    assert land['toxicity'] == 'diet_related_risk_reported'


def test_asian_shore_crab_links_local_zinc_research_without_creating_a_food_profile():
    shore = enrich(next(doc for doc in documents() if doc['id'] == 'hemigrapsus-sanguineus'))
    assert shore['nutrition'] is None
    assert '2.7–4.4 mg zinc per 100 g of wet muscle' in shore['nutrition_evidence_note']
    assert 'luo-shore-crab-zinc-2013' in shore['claim_sources']['nutrition_evidence_note']
