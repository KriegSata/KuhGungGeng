"""Published reference summaries for the field guide."""
from .nutrition import nutrition_for


def _source(key, title, url):
    return dict(id=key, title=title, url=url)


def _fao(page):
    return _source('fao-1998-crabs', 'FAO: Western Central Pacific crabs (1998)',
                   f'https://isopods.nhm.org/pdfs/4113/4113.pdf#page={page}')


def _food(page):
    return _source('seafdec-1980', 'SEAFDEC: Edible crustacea of the Philippines (1980)',
                   f'https://repository.seafdec.org.ph/bitstream/handle/10862/152/ediblecrustacea.pdf?sequence=1#page={page}')


MANGROVE = _source('seafdec-2025', 'SEAFDEC/AQD: Philippine mangrove crab manual (2025)',
                   'https://repository.seafdec.org.ph/bitstream/handle/10862/6607/CaballeroPA2025-AEM77.pdf?isAllowed=y&sequence=3')
SCYLLA = _source('scylla-revision', 'Keenan et al.: Revision of Scylla, figure 6 (1998)',
                 'https://era.dpi.qld.gov.au/id/eprint/8476/1/KeenanDavieMann1998_Scyllarevision_lowres.pdf')
SCYLLA_TRAITS = _source('scylla-morphology-2020', 'Fazhan et al.: Morphological comparison of mud crabs (2020)',
                        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6944125/')
BLUE = _source('pelagicus-revision', 'Lai et al.: Revision of the blue swimming crab complex (2010)',
               'https://treatment.plazi.org/id/AC71483FE167FFDDB747FD53FA68A59E')
SHORE = _source('australia-asian-shore', 'Australian Government: Asian shore crab identification',
                'https://www.marinepests.gov.au/pests/identify/asian-shore-crab')
SHORE_RANGE = _source('usgs-asian-shore', 'USGS: Asian shore crab habitat and native range',
                      'https://nas.er.usgs.gov/queries/factsheet.aspx?SpeciesID=183')
BFAR = _source('bfar-pia-2026', 'BFAR / Philippine Information Agency: Beware of deadly crabs',
               'https://pia.gov.ph/news/beware-of-deadly-crabs-bfar/')
LAND_RISK = _source('seafdec-land-crab-risk', 'SEAFDEC: Toxic marine organisms of the Philippines',
                    'https://repository.seafdec.org/bitstream/handle/20.500.12066/5991/safis25.pdf?isAllowed=y&sequence=1')
DEVIL = _source('naturalis-zosimus', 'Naturalis: Zosimus aeneus',
                'https://crabs-japan.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/taxon.php?id=33964')
FLORAL = _source('wam-floridus', 'Western Australian Museum: Atergatis floridus',
                 'https://museum.wa.gov.au/online-collections/names/atergatis-floridus/')
FLORAL_RANGE = _source('naturalis-floridus', 'Naturalis: Atergatis floridus records, including Cebu',
                       'https://crabs-japan.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/taxon.php?id=33976')


def _facts(description, traits, habitat, distribution, size, color, similar, sources,
           *, food=None, risk=None, toxicity='unknown'):
    fields = dict(description=description, diagnostic_traits=traits, habitat=habitat,
                  distribution=distribution, size_range=size, coloration=color, lookalikes=similar)
    claim_sources = {field: [source['id'] for source in sources] for field in fields}
    claim_sources['edibility'] = [source['id'] for source in (food, risk) if source]
    claim_sources['toxicity'] = [risk['id']] if risk else []
    edibility = 'reported_food_use' if food else 'unknown'
    if toxicity == 'toxic':
        edibility = 'not_recommended'
    return dict(**fields, edibility=edibility, toxicity=toxicity, claim_sources=claim_sources,
                sources=[*sources, *(source for source in (food, risk) if source)])


MUD_HABITAT = 'Soft mud in mangrove creeks, estuaries, and adjacent tidal waters.'
MUD_RANGE = 'Indo-West Pacific, including the Philippines.'
MUD_SOURCES = [MANGROVE, SCYLLA, SCYLLA_TRAITS]

FACTS = {
    'scylla-serrata': _facts(
        'A large mud crab with prominent claw spines and polygon-like markings on its limbs.',
        ['Look for tall, pointed lobes on the front edge of the shell.',
         'The claws have distinct spines, and polygon-shaped markings can extend across the legs and claws.'],
        MUD_HABITAT, MUD_RANGE, '15.3 cm shell width in an illustrated male specimen.',
        'Green to nearly black shell with visible polygon patterns on the limbs.',
        ['Scylla olivacea', 'Scylla tranquebarica'], MUD_SOURCES, food=_food(76)),
    'scylla-olivacea': _facts(
        'A mud crab with low, rounded frontal lobes and usually orange or brown claws.',
        ['Compare the low, rounded lobes between the eyes with the sharper lobes of the giant mud crab.',
         'The claws have reduced spines, and the legs lack the distinct polygon patterns seen in some other mud crabs.'],
        MUD_HABITAT, MUD_RANGE, '11.3 cm shell width in an illustrated male specimen.',
        'Brown to dark shell; claw color can range from orange to brown.',
        ['Scylla serrata', 'Scylla tranquebarica'], MUD_SOURCES, food=MANGROVE),
    'scylla-tranquebarica': _facts(
        'A mud crab with blunt frontal lobes and polygon-like patterns most evident on the rear legs.',
        ['Look for blunt frontal lobes and check the rear swimming legs for polygon marks.',
         'Use the shape of the frontal lobes and claw spines alongside color.'],
        MUD_HABITAT, MUD_RANGE, '12.1 cm shell width in an illustrated male specimen.',
        'Green to nearly black shell; the claws are often purple.',
        ['Scylla serrata', 'Scylla olivacea'], MUD_SOURCES, food=MANGROVE),
    'portunus-pelagicus': _facts(
        'A swimming crab with long side spines, paddle-shaped rear legs, and often conspicuous blue markings.',
        ['The shell is a little over twice as wide as it is long, with a long spine on either side.',
         'Look for the small teeth at the center front of the shell and elongated walking-leg segments.'],
        'Sandy and muddy-sand coastal bottoms from bays to offshore waters.',
        'Indo-West Pacific with Philippine records in the revised species account.',
        '14.2 cm shell width in the male reference specimen used in the taxonomic revision.',
        'Males often show vivid blue and white markings; females are usually less brightly colored.',
        ['Portunus sanguinolentus', 'Other members of the blue swimming crab complex'],
        [BLUE, _food(78)], food=_food(78)),
    'portunus-sanguinolentus': _facts(
        'A swimming crab with three dark red spots on the rear of its shell.',
        ['Check for three wine-red spots across the back of the shell.',
         'Each front-side edge has nine teeth including the enlarged outer spine.'],
        'Sand or sandy mud from the intertidal zone to about 30 m depth.',
        'Indo-Pacific, including the Philippines.', 'Up to 20 cm shell width.',
        'Pale to greenish shell with three prominent dark red spots.',
        ['Portunus pelagicus'], [_fao(88), _food(80)], food=_food(80)),
    'charybdis-feriata': _facts(
        'A swimming crab with a pale and maroon shell pattern that often forms a cross.',
        ['Check for the cross-like pattern across the middle of the shell.',
         'Look for six teeth along each front-side edge and pale spots on the legs or claws.'],
        'Sandy and muddy coastal seabeds, often around 30–60 m depth.',
        'Indo-West Pacific, including the Philippines.', 'Up to 20 cm shell width.',
        'Maroon or reddish-brown against pale stripes, with pale spots on the limbs.',
        ['Other swimming crabs in the genus Charybdis'], [_fao(83), _food(82)], food=_food(82)),
    'ranina-ranina': _facts(
        'A red-orange crab with an elongated shell and broad legs suited to digging backward into sand.',
        ['The long shell is wider toward the eyes and narrows toward the rear.',
         'Look for broad, flattened leg tips rather than the rounded paddles of most swimming crabs.'],
        'Sandy seabeds, including offshore bottoms deeper than 100 m.',
        'Indo-Pacific with Philippine records, including Zamboanga.',
        'Up to 15 cm shell length in males and 12 cm in females.',
        'Orange-red, sometimes with pale spots on the front of the shell.',
        ['Other frog crabs in the family Raninidae'], [_fao(53), _food(72)], food=_food(72)),
    'cardisoma-carnifex': _facts(
        'A rounded land crab often seen near coastal burrows. Adult males can have one much larger claw.',
        ['Look for a broad, inflated shell and a strongly uneven pair of claws in adult males.',
         'The shell is smooth and rounded, with legs suited to walking on land.'],
        'Coastal burrows behind mangroves and near brackish water.',
        'Indo-West Pacific.', 'Up to 12 cm shell width in males.',
        'Usually greyish to brown.', ['Other land crabs in the family Gecarcinidae'],
        [_fao(112)], food=_fao(112), risk=LAND_RISK, toxicity='diet_related_risk_reported'),
    'ocypode-ceratophthalma': _facts(
        'A sandy-beach ghost crab whose adults can have horn-like extensions above the eyes.',
        ['Look for long eyestalks and the horn-like extension beyond the eye in adults.',
         'The shell is roughly square and the long legs can blend in with beach sand.'],
        'Burrows in sandy upper beaches, above the usual waterline.',
        'Indo-West Pacific.', 'Up to 5 cm shell width.',
        'Sandy tan to grey; the light shell can blend into dry sand.',
        ['Ocypode cordimanus, which lacks the adult eyestalk horns'], [_fao(116)]),
    'hemigrapsus-sanguineus': _facts(
        'A small rocky-shore crab with banded legs and a square shell.',
        ['Count three teeth on each side of the shell behind the eyes.',
         'Check the walking legs for light and dark bands and the claws for small spots.'],
        'Rocky intertidal shores, commonly under stones and around crevices or hard structures.',
        'Native to the northwest Pacific. Philippine occurrence remains unverified in these references.',
        'Up to about 5 cm shell width.', 'Variable green to reddish-purple, with banded legs and spotted claws.',
        ['Other Hemigrapsus shore crabs'], [SHORE, SHORE_RANGE]),
    'zosimus-aeneus': _facts(
        'A reef crab with a wide oval shell, flattened bumps, and strongly sculpted edges.',
        ['Look for a wide oval shell with flattened bumps and a front edge divided into four lobes.',
         'The claws and legs have a similarly bumpy surface, and the shell edge has four lobes on each side.'],
        'Shallow tropical reef waters.', 'Indo-Pacific, including the Philippines.',
        'Published specimens measured 9.0 cm (male) and 6.3 cm (female) across the shell.',
        'Dark blotches on a lighter background; use the shell and claw shape as well.',
        ['Other reef crabs in the family Xanthidae'], [DEVIL, _fao(12)], risk=BFAR, toxicity='toxic'),
    'atergatis-floridus': _facts(
        'A rounded reef crab commonly recognized by pale, lace-like markings on its shell.',
        ['Check the smooth, broad oval shell and its rounded front-side edge.',
         'Look for a fine pale network on the shell and dark tips on the claws.'],
        'Shallow coral and rocky reefs, including shelters beneath rocks and rubble.',
        'Western Pacific, with Philippine records including Cebu.', 'Up to 10 cm shell width.',
        'Green to brown with pale lace-like markings and dark claw tips.',
        ['Other egg crabs in the genus Atergatis'], [FLORAL, FLORAL_RANGE], risk=BFAR, toxicity='toxic'),
}


def enrich(document):
    """Apply sourced reference fields to provisional and legacy records."""
    identity = document['id']
    facts = FACTS.get(identity)
    if not facts or document.get('identification_status') in {'verified', 'expert_reviewed'}:
        return document
    previous_nutrition = document.get('nutrition') or {}
    old_nutrition_source = previous_nutrition.get('source', {}).get('id')
    sources = {source['id']: source for source in document.get('sources', [])
               if source['id'] not in {'scylla-morphology-2019', old_nutrition_source}}
    sources.update({source['id']: source for source in facts['sources']})
    claim_sources = {**document.get('claim_sources', {}), **facts['claim_sources']}
    if facts['toxicity'] == 'toxic':
        advisory_ids = {evidence['source_id'] for evidence in document.get('safety_evidence', [])
                        if evidence['source_id'] in sources}
        claim_sources['toxicity'] = [BFAR['id'], *sorted(advisory_ids)]
    nutrition = nutrition_for(identity)
    claim_sources['nutrition'] = [nutrition['source']['id']] if nutrition else []
    if nutrition:
        sources[nutrition['source']['id']] = nutrition['source']
    return {**document, **facts, 'nutrition': nutrition, 'sources': list(sources.values()),
            'claim_sources': claim_sources, 'reference_revision': 'species-facts-2026-11-24'}
