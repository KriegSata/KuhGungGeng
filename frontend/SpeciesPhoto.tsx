import {useState} from 'react';
import photos from './reference-photos.json';
import type {Species} from './types';

export type PhotoFeature = {label: string; description: string; x: number; y: number; aspectRatio: number};
type Photo = {src: string; source: string; author: string; license: string; licenseUrl: string; title: string; changes: string; feature?: PhotoFeature};
const references: Record<string, Photo> = photos;

export function referencePhoto(speciesId: string) {
  return references[speciesId];
}

export function PhotoCredit({species}:{species:Pick<Species, 'id'>}) {
  const photo=references[species.id];
  if(!photo)return null;
  return <span className="photo-credit"><a href={photo.source} title={photo.title} target="_blank" rel="noreferrer">Photo: {photo.author}</a></span>;
}

export default function SpeciesPhoto({species,large=false,eager=false}:{species:Species;large?:boolean;eager?:boolean}) {
  const [failed,setFailed]=useState(false);
  const photo=references[species.id];
  const image = photo && !failed
    ? <img src={photo.src} alt={`${species.scientific_name} reference photograph`} loading={eager ? 'eager' : 'lazy'}
        width="960" height="640" onError={() => setFailed(true)}/>
    : <div className="photo-unavailable">Reference photo unavailable</div>;
  return <figure className={large?'reference-photo large':'reference-photo'}>
    {large ? <div className="specimen-photo-mat">{image}</div> : image}
    {large && <figcaption><PhotoCredit species={species}/><span className="photo-use-note">Reference photograph · guide cards show a cropped view</span></figcaption>}
  </figure>;
}
