"""Sourced reference summaries, separate from photo-based predictions.

These summaries do not certify an individual animal as safe to eat.
"""
from .nutrition import nutrition_for

SEAFDEC = dict(id='seafdec-1980', title='SEAFDEC: Edible crustacea of the Philippines (1980)',
               url='https://repository.seafdec.org.ph/bitstream/handle/10862/152/ediblecrustacea.pdf?sequence=1')
FAO = dict(id='fao-1998-crabs', title='FAO: Western Central Pacific crabs (1998)',
           url='https://isopods.nhm.org/pdfs/4113/4113.pdf')
ASIAN_SHORE = dict(id='australia-asian-shore', title='Australian Government: Asian shore crab',
                   url='https://www.marinepests.gov.au/pests/identify/asian-shore-crab')
SCYLLA_STUDY = dict(id='scylla-morphology-2019', title='PeerJ: Morphological descriptions of Scylla species (2019)',
                    url='https://pmc.ncbi.nlm.nih.gov/articles/PMC6944125/')
BFAR = dict(id='bfar-pia-2026', title='BFAR / PIA: Beware of deadly crabs (2026)',
            url='https://pia.gov.ph/news/beware-of-deadly-crabs---bfar/')

DESCRIPTIONS = {
    'scylla-serrata': ('A robust mud crab with prominent claw spines and polygon-like markings on its claws and legs. Similar Scylla species require close comparison.', SCYLLA_STUDY),
    'scylla-olivacea': ('An orange mud crab with rounded, relatively low frontal spines and reduced claw spines. Its limbs lack the polygon-like pattern of some related mud crabs.', SCYLLA_STUDY),
    'scylla-tranquebarica': ('A mud crab with blunt frontal spines and patterned rear legs. Claws are often purple, but color alone does not establish identity.', SCYLLA_STUDY),
    'portunus-pelagicus': ('A swimming crab with long lateral shell spines and paddle-shaped rear legs. Males often show blue markings; females can be less brightly colored.', SEAFDEC),
    'portunus-sanguinolentus': ('A coastal swimming crab distinguished by three conspicuous dark-red spots on the rear part of its shell.', SEAFDEC),
    'charybdis-feriata': ('A swimming crab with contrasting pale and reddish-brown shell markings, often including a cross-like pattern. It has strong claws and six lateral teeth.', SEAFDEC),
    'ranina-ranina': ('A reddish, elongated crab with paddle-like legs adapted for burrowing backward into sand. Its front shell can have pale spots.', SEAFDEC),
    'cardisoma-carnifex': ('A brownish land crab with a swollen, rounded shell; adult males have one greatly enlarged claw. It shelters in deep coastal burrows.', FAO),
    'ocypode-ceratophthalma': ('A sandy-beach crab with a squarish shell and horn-like extensions above the eyes in adults. Juveniles may be harder to distinguish.', FAO),
    'hemigrapsus-sanguineus': ('A small shore crab with a squarish shell, three spines behind each eye, banded legs, and spotted claws.', ASIAN_SHORE),
    'zosimus-aeneus': ('A toxic reef crab with dark blotches on a lighter background. BFAR warns that its toxins can persist after cooking.', BFAR),
    'atergatis-floridus': ('A toxic reef crab identified in BFAR food-safety advisories. Its toxins can remain dangerous after boiling; it must not be treated as edible.', BFAR),
}

# (habitat, geographic range, reference, PDF page number)
REFERENCES = {
    'charybdis-feriata': ('Sandy shallows as juveniles; offshore mud as adults.',
                          'Indo-Pacific, including the Philippines.', SEAFDEC, 82),
    'ranina-ranina': ('Sandy seabeds, including depths beyond 30 m.',
                      'Indo-Pacific; recorded in the Philippines, including Zamboanga.', SEAFDEC, 72),
    'scylla-serrata': ('Brackish mudflats, mangroves, and estuary mouths.',
                       'Indo-Pacific, including the Philippines; historical records may include related species.', SEAFDEC, 76),
    'portunus-pelagicus': ('Sand and muddy sand, from bays to offshore waters.',
                          'Indo-Pacific, including Philippine records; older records use a broader taxon concept.', SEAFDEC, 78),
    'portunus-sanguinolentus': ('Coastal sand and muddy sand.',
                               'Indo-Pacific, including the Philippines.', SEAFDEC, 80),
    'cardisoma-carnifex': ('Land burrows behind mangroves and near brackish coastal water.',
                          'Indo-West Pacific.', FAO, 112),
    'ocypode-ceratophthalma': ('Deep burrows on sandy beaches above the usual waterline.',
                             'Indo-West Pacific.', FAO, 116),
    'hemigrapsus-sanguineus': ('Rocky intertidal shores, beneath rocks, shells, and structures.',
                              'Established in Victoria, Australia; Philippine occurrence is not established by this reference.', ASIAN_SHORE, None),
}


def enrich(document):
    """Update provisional reference fields without replacing reviewed knowledge."""
    identity = document['id']
    if document.get('identification_status') in {'verified', 'expert_reviewed'}:
        return document
    if identity not in REFERENCES:
        if identity not in DESCRIPTIONS:
            return document
        description, source = DESCRIPTIONS[identity]
        sources = {s['id']: s for s in document.get('sources', [])}
        sources[source['id']] = source
        return {**document, 'description': description, 'nutrition': nutrition_for(identity),
                'sources': list(sources.values()),
                'claim_sources': {**document.get('claim_sources', {}), 'description': [source['id']]}}
    habitat, distribution, source, page = REFERENCES[identity]
    source = dict(source)
    if page:
        source['url'] += f'#page={page}'
    sources = {s['id']: s for s in document.get('sources', [])}
    sources[source['id']] = source
    description, description_source = DESCRIPTIONS[identity]
    sources.setdefault(description_source['id'], description_source)
    nutrition = nutrition_for(identity)
    if nutrition:
        sources[nutrition['source']['id']] = nutrition['source']
    edibility = 'unknown' if identity == 'hemigrapsus-sanguineus' else 'reported_food_use'
    toxicity = 'diet_related_risk_reported' if identity == 'cardisoma-carnifex' else 'unknown'
    return {**document, 'habitat': habitat, 'distribution': distribution,
            'description': description, 'nutrition': nutrition,
            'edibility': edibility, 'toxicity': toxicity,
            'reference_revision': 'species-facts-2026-11-22',
            'sources': list(sources.values()),
            'claim_sources': {**document.get('claim_sources', {}),
                             'habitat': [source['id']], 'distribution': [source['id']],
                             'description': [description_source['id']],
                             'edibility': [] if edibility == 'unknown' else [source['id']],
                             'toxicity': [source['id']] if toxicity != 'unknown' else []}}
