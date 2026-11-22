"""Provisional catalog entries matching the local classifier's folder labels."""
from .schemas import SAFETY_WARNING


CLASSES = {
    'cardisoma-carnifex': ('Cardisoma carnifex', 'Mangrove land crab'),
    'charybdis-feriata': ('Charybdis feriata', 'Crucifix crab'),
    'hemigrapsus-sanguineus': ('Hemigrapsus sanguineus', 'Asian shore crab'),
    'ocypode-ceratophthalma': ('Ocypode ceratophthalma', 'Horn-eyed ghost crab'),
    'portunus-pelagicus': ('Portunus pelagicus', 'Blue swimming crab'),
    'portunus-sanguinolentus': ('Portunus sanguinolentus', 'Three-spot swimming crab'),
    'ranina-ranina': ('Ranina ranina', 'Red frog crab / spanner crab'),
    'scylla-serrata': ('Scylla serrata', 'Giant mud crab'),
}


def documents():
    for identity, (scientific, english) in CLASSES.items():
        yield dict(id=identity, scientific_name=scientific, english_name=english,
                   accepted_taxon_id=None, taxonomic_rank='species', synonyms=[],
                   names=[dict(name=english, language='en', region='unspecified', scope='species', status='provisional')],
                   diagnostic_traits=['Training folder label; diagnostic traits await expert review.'],
                   habitat='Not yet reviewed.', distribution='Not yet reviewed.', size_range=None,
                   coloration=None, life_stage_notes='Image classification may be unreliable for juveniles or partial views.',
                   lookalikes=[], edibility='unknown', toxicity='unknown', venom_status='unknown',
                   safety_warning=SAFETY_WARNING, safety_evidence=[], conservation_status='not_reviewed',
                   regulatory_notes='Not yet reviewed.', common_uses='Not yet reviewed.',
                   identification_status='provisional', review_status='pending', reviewed_by=None,
                   last_reviewed=None, revision='experimental-classifier-v1', sources=[], claim_sources={})
