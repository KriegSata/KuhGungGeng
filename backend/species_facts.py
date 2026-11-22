"""Sourced reference summaries, separate from photo-based predictions.

These summaries do not certify an individual animal as safe to eat.
"""

SEAFDEC = dict(id='seafdec-1980', title='SEAFDEC: Edible crustacea of the Philippines (1980)',
               url='https://repository.seafdec.org.ph/bitstream/handle/10862/152/ediblecrustacea.pdf?sequence=1')
FAO = dict(id='fao-1998-crabs', title='FAO: Western Central Pacific crabs (1998)',
           url='https://isopods.nhm.org/pdfs/4113/4113.pdf')
ASIAN_SHORE = dict(id='australia-asian-shore', title='Australian Government: Asian shore crab',
                   url='https://www.marinepests.gov.au/pests/identify/asian-shore-crab')

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
    if identity not in REFERENCES or document.get('identification_status') in {'verified', 'expert_reviewed'}:
        return document
    habitat, distribution, source, page = REFERENCES[identity]
    source = dict(source)
    if page:
        source['url'] += f'#page={page}'
    sources = {s['id']: s for s in document.get('sources', [])}
    sources[source['id']] = source
    edibility = 'unknown' if identity == 'hemigrapsus-sanguineus' else 'reported_food_use'
    toxicity = 'diet_related_risk_reported' if identity == 'cardisoma-carnifex' else 'unknown'
    return {**document, 'habitat': habitat, 'distribution': distribution,
            'edibility': edibility, 'toxicity': toxicity,
            'reference_revision': 'species-facts-2026-11-22',
            'sources': list(sources.values()),
            'claim_sources': {**document.get('claim_sources', {}),
                             'habitat': [source['id']], 'distribution': [source['id']],
                             'edibility': [] if edibility == 'unknown' else [source['id']],
                             'toxicity': [source['id']] if toxicity != 'unknown' else []}}
