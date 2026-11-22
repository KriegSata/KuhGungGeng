"""Fetch reviewed file selections and attribution from Wikimedia Commons.

Without --download, list candidate JPEG photographs from each species category.
Selection titles live in frontend/reference-photo-selections.json.
"""
import argparse
import html
import json
from pathlib import Path
import re
import sys

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SPECIES = ['Scylla serrata', 'Scylla olivacea', 'Scylla tranquebarica',
           'Portunus pelagicus', 'Zosimus aeneus', 'Atergatis floridus',
           'Cardisoma carnifex', 'Charybdis feriata', 'Hemigrapsus sanguineus',
           'Ocypode ceratophthalma', 'Portunus sanguinolentus', 'Ranina ranina']


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    session = requests.Session()
    session.headers['User-Agent'] = 'KuhGungGengFieldGuide/1.0 (reference-photo attribution importer)'
    session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2,
                  status_forcelist=[429, 502, 503], respect_retry_after_header=True)))
    def query(**params):
        result = session.get('https://commons.wikimedia.org/w/api.php', params={
            'action': 'query', 'format': 'json', 'prop': 'imageinfo',
            'iiprop': 'url|extmetadata', 'iiurlwidth': 960, **params}, timeout=40)
        result.raise_for_status()
        return list(result.json().get('query', {}).get('pages', {}).values())
    if not args.download:
        for species in SPECIES:
            pages = query(generator='categorymembers', gcmtitle='Category:' + species,
                          gcmtype='file', gcmlimit=20)
            print(species, flush=True)
            for page in pages:
                if page['title'].lower().endswith(('.jpg', '.jpeg')):
                    metadata = page.get('imageinfo', [{}])[0].get('extmetadata', {})
                    print(' ', page['title'], '|', metadata.get('LicenseShortName', {}).get('value'), flush=True)
        return
    selections = json.loads(Path('frontend/reference-photo-selections.json').read_text(encoding='utf-8'))
    output = Path('public/images/species')
    output.mkdir(parents=True, exist_ok=True)
    credits = {}
    credit_path = Path('frontend/reference-photos.json')
    previous = json.loads(credit_path.read_text(encoding='utf-8')) if credit_path.exists() else {}
    pages = {page['title']: page for page in query(titles='|'.join(selections.values()))}
    for identity, title in selections.items():
        page = pages[title]
        info = page['imageinfo'][0]
        meta = info['extmetadata']
        license_name = plain(meta.get('LicenseShortName', {}).get('value', ''))
        if not license_name.startswith(('CC BY', 'CC0', 'Public domain')):
            raise ValueError(f'Unsupported or missing license: {title}: {license_name}')
        if not (output / f'{identity}.jpg').exists() or previous.get(identity, {}).get('title') != title.removeprefix('File:'):
            response = session.get(info.get('thumburl', info['url']), timeout=60)
            response.raise_for_status()
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError(f'Not an image: {title}')
            (output / f'{identity}.jpg').write_bytes(response.content)
        credits[identity] = dict(src=f'/images/species/{identity}.jpg',
                                 source=info['descriptionurl'],
                                 author=plain(meta.get('Artist', {}).get('value', 'OpenCage' if identity == 'scylla-serrata' else 'See source')),
                                 license=license_name,
                                 licenseUrl=meta.get('LicenseUrl', {}).get('value', ''),
                                 title=title.removeprefix('File:'),
                                 changes='Wikimedia thumbnail; displayed with crop on guide cards.')
        print(f'Downloaded {identity}: {license_name}', flush=True)
    Path('frontend/reference-photos.json').write_text(json.dumps(credits, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
