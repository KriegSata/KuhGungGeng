import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {CSSProperties, KeyboardEvent} from 'react';
import {ArrowRight, BookOpen, CalendarDays, Camera, Check, ChevronLeft, Focus, Globe2, History, ImagePlus, Lightbulb, Link2, LoaderCircle, MapPin, NotebookText, Ruler, Search, ShieldAlert, ShieldCheck, Sun, Trash2, Utensils, X} from 'lucide-react';
import {animate} from 'animejs/animation';
import {stagger} from 'animejs/utils';
import {api, ApiError, startSession, validateFile} from './api';
import type {Prediction, Source, Species} from './types';
import SpeciesPhoto, {PhotoCredit, referencePhoto} from './SpeciesPhoto';
import NutritionDetails from './NutritionDetails';
import CameraCapture from './CameraCapture';
import {useScrollReveal} from './useScrollReveal';

const guide = '#/field-guide';
const photoTips = '#/photo-tips';
const observations = '#/observations';
const speciesLink = (id: string) => guide + '/' + encodeURIComponent(id);
const observationLink = (id: string) => observations + '/' + encodeURIComponent(id);
const words = (value: string) => value.replaceAll('_', ' ');

type Resource<T> = {status: 'loading'} | {status: 'ready'; data: T} | {status: 'failed'; message: string};
type Model = {available: boolean; version?: string; species_ids?: string[]};
type PhotoSelection = {file: File; uploadId?: string};
type PhotoStage = 'preparing' | 'uploading' | 'analyzing';

function useResource<T>(path: string | null, needsSession = false) {
  const [request, setRequest] = useState(0);
  const [response, setResponse] = useState<{path: string; request: number; resource: Resource<T>}>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    async function load(endpoint: string) {
      try {
        if (needsSession) await startSession();
        if (controller.signal.aborted) return;
        const data = await api<T>(endpoint, {signal: controller.signal});
        if (!controller.signal.aborted) setResponse({path: endpoint, request, resource: {status: 'ready', data}});
      } catch (error) {
        if (!controller.signal.aborted) {
          setResponse({path: endpoint, request, resource: {status: 'failed', message: (error as Error).message}});
        }
      }
    }
    void load(path);
    return () => controller.abort();
  }, [path, request, needsSession]);

  const state: Resource<T> = response?.path === path && response.request === request
    ? response.resource
    : {status: 'loading'};
  return [state, () => setRequest(value => value + 1)] as const;
}

function LoadState({state, label, retry}: {state: Resource<unknown>; label: string; retry: () => void}) {
  if (state.status === 'failed') {
    return <div className="load-state"><p role="alert">{state.message}</p><button className="secondary" onClick={retry}>Try again</button></div>;
  }
  return <p className="load-state" role="status">{label}</p>;
}

function currentRoute() {
  const hash = location.hash;
  return hash.startsWith('#/') && hash !== '#/identify' ? hash : guide;
}

function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  const main = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  const previouslyRendered = useRef(route);

  useEffect(() => {
    const restoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = restoration; };
  }, []);

  useEffect(() => {
    function update() {
      const next = currentRoute();
      if (next === route) return;
      positions.current.set(route, scrollY);
      setRoute(next);
    }
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, [route]);

  useLayoutEffect(() => {
    if (previouslyRendered.current === route) return;
    previouslyRendered.current = route;
    main.current?.focus({preventScroll: true});
    const top = positions.current.get(route) ?? 0;
    if (scrollY !== top) window.scrollTo(0, top);
  }, [route]);

  return {route, main};
}

function exampleFor(id: string) {
  try { return sessionStorage.getItem('shellfie:example:' + id); } catch { return null; }
}

function resultTitle(prediction: Prediction) {
  if (prediction.reason === 'model_unavailable') return 'Identification unavailable';
  return prediction.status === 'identified' ? 'Possible match' : 'Match uncertain';
}

function resultMessage(prediction: Prediction) {
  switch (prediction.reason) {
    case 'model_unavailable': return 'The identification model is unavailable. Browse the field guide to compare species.';
    case 'poor_image_quality': return 'Try a sharper photo in even light, with the whole crab in view.';
    case 'ambiguous_species': return 'The model could not settle on one species.';
    case null: return 'Look at the same part of both crabs and compare what you can see.';
    default: return 'The model needs more information. Try another view of the crab.';
  }
}

async function photoDimensions(file: File) {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const {width, height} = bitmap;
      bitmap.close();
      return {width, height};
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return {width: image.naturalWidth, height: image.naturalHeight};
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    throw new Error('This photo could not be opened. Choose a JPG, PNG or WebP image.');
  }
}

export default function App() {
  const {route, main} = useRoute();
  const [catalog, retryCatalog] = useResource<{items: Species[]}>('/species');
  const [model, retryModel] = useResource<Model>('/model');
  const [search, setSearch] = useState('');
  const [photo, setPhoto] = useState<PhotoSelection>();
  const [preview, setPreview] = useState('');
  const [stage, setStage] = useState<PhotoStage>();
  const [photoError, setPhotoError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [lastResult, setLastResult] = useState<Prediction>();
  const [returnTo, setReturnTo] = useState<{speciesId: string; observation: string}>();
  const [candidates, setCandidates] = useState<Record<string, string>>({});
  const activity = useRef(false);
  const species = catalog.status === 'ready' ? catalog.data.items : [];
  const speciesId = route.startsWith(guide + '/') ? route.slice(guide.length + 1) : '';
  const selected = species.find(item => encodeURIComponent(item.id) === speciesId);
  const predictionId = route.startsWith(observations + '/') ? route.slice(observations.length + 1) : '';
  const guideActive = route === guide || !!speciesId;
  const observationsActive = route === observations || !!predictionId;
  const inReview = route === '#/review';

  useEffect(() => {
    if (!photo?.file) { setPreview(''); return; }
    const url = URL.createObjectURL(photo.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo?.file]);

  async function preparePhoto(file: File) {
    if (activity.current) return;
    activity.current = true;
    setPhotoError('');
    setStage('preparing');
    try {
      const invalid = validateFile(file);
      if (invalid) throw new Error(invalid);
      const {width, height} = await photoDimensions(file);
      if (Math.min(width, height) < 224 || width * height > 24_000_000 || Math.max(width, height) > 12000) {
        throw new Error('Use a photo at least 224 × 224 pixels, up to 24 megapixels and 12,000 pixels on either side.');
      }
      setPhoto({file});
    } catch (error) {
      setPhotoError((error as Error).message);
    } finally {
      setStage(undefined);
      activity.current = false;
    }
  }

  async function submitPhoto() {
    if (!photo || activity.current) return;
    const sourceRoute = currentRoute();
    activity.current = true;
    setPhotoError('');
    setStage(photo.uploadId ? 'analyzing' : 'uploading');
    try {
      await startSession();
      let uploadId = photo.uploadId;
      if (!uploadId) {
        const form = new FormData();
        form.append('file', photo.file);
        ({id: uploadId} = await api<{id: string}>('/uploads', {method: 'POST', body: form}));
        setPhoto({...photo, uploadId});
      }
      setStage('analyzing');
      const prediction = await api<Prediction>('/predictions', {method: 'POST', body: JSON.stringify({upload_id: uploadId, top_k: 3})});
      setLastResult(prediction);
      if (currentRoute() === sourceRoute) location.hash = observationLink(prediction.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) setPhoto({...photo, uploadId: undefined});
      setPhotoError((error as Error).message);
    } finally {
      setStage(undefined);
      activity.current = false;
    }
  }

  const picker = {
    photo, preview, stage, error: photoError, model, retryModel,
    onFile: (file: File) => void preparePhoto(file),
    onSubmit: () => void submitPhoto(),
  };

  return <>
    <a className="skip" href="#main" onClick={event => {event.preventDefault(); main.current?.focus();}}>Skip to content</a>
    <header className="shell-header">
      <div className="shell-header-inner">
        <BrandLink/>
        <nav className="shell-nav" aria-label="Main navigation">
          <a href={guide} aria-current={guideActive ? 'page' : undefined}><BookOpen size={18}/> Field guide</a>
          <a href={photoTips} aria-current={route === photoTips ? 'page' : undefined}><Lightbulb size={18}/> Photo tips</a>
          <a href={observations} aria-current={observationsActive ? 'page' : undefined}><History size={18}/> My observations</a>
        </nav>
      </div>
    </header>
    <main id="main" ref={main} tabIndex={-1} className="shell-main">
      {route === guide && <Atlas catalog={catalog} retryCatalog={retryCatalog} picker={picker}
        search={search} setSearch={setSearch} onOpen={() => setReturnTo(undefined)}/>}
      {speciesId && (catalog.status !== 'ready'
        ? <LoadState state={catalog} label="Loading the field guide…" retry={retryCatalog}/>
        : selected
          ? <SpeciesDetail key={selected.id} species={selected}
              back={returnTo?.speciesId === selected.id ? returnTo.observation : guide}/>
          : <section className="shell-page"><h1>Species unavailable</h1><a href={guide}>Back to the field guide</a></section>)}
      {route === photoTips && <PhotoTips/>}
      {route === observations && <ObservationHistory species={species} onDelete={id => {
        if (lastResult?.id === id) setLastResult(undefined);
      }}/>}
      {predictionId && <ObservationPage key={predictionId} id={predictionId} species={species}
        model={model.status === 'ready' ? model.data : undefined}
        prediction={encodeURIComponent(lastResult?.id ?? '') === predictionId ? lastResult : undefined}
        candidateId={candidates[predictionId]}
        onSelect={id => setCandidates(previous => ({...previous, [predictionId]: id}))}
        onSpecies={id => setReturnTo({speciesId: id, observation: route})}/>}
      {inReview && <>{reviewError && <p role="alert" className="load-state">{reviewError}</p>}<Reviewer onError={setReviewError}/></>}
      {!guideActive && route !== photoTips && !observationsActive && !inReview &&
        <section className="shell-page"><h1>Page unavailable</h1><a href={guide}>Open the field guide</a></section>}
    </main>
    <footer className="shell-footer">
      <div className="shell-footer-inner">
        <div className="shell-footer-identity"><BrandLink/><p>Philippine crab field guide</p></div>
        <a className="shell-footer-review" href="#/review">Reviewer workspace <ArrowRight size={16} aria-hidden="true"/></a>
      </div>
    </footer>
  </>;
}

function BrandLink() {
  return <a href={guide} className="shell-brand">
    <img src="/shellfie.png" alt="" width="42" height="42"/> Shellfie
  </a>;
}

function Atlas({catalog, retryCatalog, picker, search, setSearch, onOpen}: {
  catalog: Resource<{items: Species[]}>; retryCatalog: () => void; picker: PhotoPickerProps;
  search: string; setSearch: (search: string) => void; onOpen: () => void;
}) {
  const species = catalog.status === 'ready' ? catalog.data.items : [];
  const featured = species.find(item => item.id === 'portunus-pelagicus');
  const query = search.trim().toLowerCase();
  const results = species.filter(item => [item.english_name, item.scientific_name, ...item.names.map(name => name.name)]
    .join(' ').toLowerCase().includes(query));
  const speciesGrid = useScrollReveal(results.map(item => item.id).join(','));

  return <>
    <section className={featured ? 'atlas-opening' : 'atlas-opening atlas-opening-single'}>
      <div className="atlas-intro">
        <img className="atlas-mascot" src="/shellfie-mascot.webp" alt="" width="768" height="768"/>
        <h1>Crabs of the <em>Philippines</em></h1>
        <p>Find possible matches for your crab.</p>
        <PhotoPicker {...picker}/>
      </div>
      {featured && <div className="atlas-feature">
        <a href={speciesLink(featured.id)} onClick={onOpen} className="atlas-feature-image" aria-label={'Open ' + featured.english_name}>
          <SpeciesPhoto species={featured} eager/>
        </a>
        <div className="atlas-feature-caption">
          <a href={speciesLink(featured.id)} onClick={onOpen}><strong>{featured.english_name}</strong>
            <i>{featured.scientific_name}</i><ArrowRight size={20}/></a>
          <PhotoCredit species={featured}/>
        </div>
      </div>}
    </section>
    <section className="atlas-index" aria-labelledby="index-heading">
      <div className="atlas-index-heading">
        <div className="atlas-index-title"><h2 id="index-heading">Species index</h2>
          {catalog.status === 'ready' && <output>{results.length} species</output>}</div>
        <label className="atlas-search"><Search size={22} aria-hidden="true"/>
          <input type="search" aria-label="Search species" placeholder="Search by crab name" value={search}
            onChange={event => setSearch(event.target.value)}/>
        </label>
      </div>
      {catalog.status !== 'ready' ? <LoadState state={catalog} label="Loading the field guide…" retry={retryCatalog}/> :
        results.length ? <div className="atlas-grid" ref={speciesGrid}>{results.map(item => <article className="atlas-card" key={item.id}>
        <a href={speciesLink(item.id)} onClick={onOpen} aria-label={`View ${item.english_name}`}
          aria-describedby={item.toxicity === 'toxic' ? `toxicity-${item.id}` : undefined}>
          <div className="atlas-card-photo">
            <SpeciesPhoto species={item}/>
            {item.toxicity === 'toxic' && <strong className="toxicity-badge" id={`toxicity-${item.id}`}>
              <span className="toxicity-badge-icon"><ShieldAlert size={16} aria-hidden="true"/></span>
              Toxic species
              <span className="toxicity-badge-bubble" aria-hidden="true"/>
            </strong>}
          </div>
          <div className="atlas-card-title"><div><h3>{item.english_name}</h3><i>{item.scientific_name}</i></div><ArrowRight size={20}/></div>
        </a>
        <div className="atlas-card-credit"><PhotoCredit species={item}/></div>
      </article>)}</div> : <p>No species found. Try another name.</p>}
    </section>
  </>;
}

type PhotoPickerProps = {
  photo?: PhotoSelection; preview: string; stage?: PhotoStage; error: string; model: Resource<Model>;
  retryModel: () => void; onFile: (file: File) => void; onSubmit: () => void;
};

function PhotoPicker({photo, preview, stage, error, model, retryModel, onFile, onSubmit}: PhotoPickerProps) {
  const library = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const stages = {preparing: 'Preparing photo…', uploading: 'Uploading photo…', analyzing: 'Comparing species…'};
  function select(input: HTMLInputElement) {
    if (input.files?.[0]) onFile(input.files[0]);
    input.value = '';
  }

  return <div className="hero-capture" role="group" aria-label="Identify a crab photo"
    onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      if (!stage && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
    }}>
    <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" hidden
      aria-label="Choose crab photograph" onChange={event => select(event.currentTarget)}/>
    {photo && <figure className="capture-preview">
      <img src={preview || undefined} alt="Your selected crab photograph"/>
    </figure>}
    <div className="capture-buttons">
      {photo && <button className="primary capture-submit" disabled={!!stage || model.status !== 'ready'} onClick={onSubmit}>
        Identify crab <ArrowRight size={18}/>
      </button>}
      <button className={photo ? 'secondary' : 'primary'} disabled={!!stage} onClick={() => setCameraOpen(true)}>
        <Camera size={19}/>{photo ? 'Retake photo' : 'Take a photo'}
      </button>
      <button className="secondary" disabled={!!stage} onClick={() => library.current?.click()}>
        <ImagePlus size={19}/>{photo ? 'Change photo' : 'Upload photo'}
      </button>
    </div>
    {stage && <p className="capture-status" role="status"><LoaderCircle className="spin" size={18}/>{stages[stage]}</p>}
    {error && <p className="capture-error" role="alert">{error}</p>}
    {photo && <CaptureModelStatus model={model} retryModel={retryModel}/>}
    <div className="hero-capture-notes">
      {!photo && <span>JPG, PNG, WebP · 10 MiB max</span>}
      <span><ShieldCheck size={14} aria-hidden="true"/> Private · Expires in 24 hours</span>
    </div>
    {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onPhoto={onFile} onUpload={() => library.current?.click()}/>}
  </div>;
}

function CaptureModelStatus({model, retryModel}: Pick<PhotoPickerProps, 'model' | 'retryModel'>) {
  if (model.status === 'failed') return <LoadState state={model} label="" retry={retryModel}/>;
  if (model.status === 'loading') return <p role="status">Checking the identification model…</p>;
  if (!model.data.available) return <p>The identification model is unavailable.</p>;
  return null;
}

function PhotoTips() {
  const exampleId = 'ocypode-ceratophthalma';
  const example = referencePhoto(exampleId);
  const notes = useScrollReveal();

  return <article className="shell-page photo-tips">
    <header className="tips-intro">
      <div>
        <h1>Photo tips</h1>
        <p>See what a clear, useful crab photo looks like.</p>
      </div>
      <a className="primary" href={guide}><Camera size={18} aria-hidden="true"/> Use the photo picker <ArrowRight size={16} aria-hidden="true"/></a>
    </header>
    <section aria-label="Good and poor crab photo examples">
      <div className="tips-comparison">
        <figure className="tips-photo">
          <div className="tips-photo-frame">
            <img src={example.src} width="960" height="720" alt="A sharp, bright photo of a ghost crab on sand, with its shell, claws and legs in view."/>
            <span className="tips-verdict"><Check size={16} aria-hidden="true"/> Good photo</span>
          </div>
          <figcaption><h2>Whole crab in focus</h2><p>The shell markings are sharp, with room around the claws and legs.</p></figcaption>
        </figure>
        <figure className="tips-photo tips-photo-retake">
          <div className="tips-photo-frame">
            <img src={example.src} width="960" height="720" alt="A dark, blurry close-up of the same crab, with most of its legs cut out of the frame."/>
            <span className="tips-verdict"><X size={16} aria-hidden="true"/> Retake</span>
          </div>
          <figcaption><h2>Too close and blurry</h2><p>Cropping cuts off the legs. Dimming and blur hide the shell markings.</p></figcaption>
        </figure>
      </div>
      <p className="tips-credit"><PhotoCredit species={{id: exampleId}}/></p>
    </section>
    <div className="tips-notes" ref={notes}>
      <section className="tips-checklist" aria-labelledby="photo-checklist">
        <h2 id="photo-checklist">Before you take a photo</h2>
        <ul>
          <li><Focus size={22} aria-hidden="true"/><div><h3>Frame the whole crab</h3><p>Leave room around its claws and legs. Tap the screen to focus on the shell.</p></div></li>
          <li><Sun size={22} aria-hidden="true"/><div><h3>Look for even light</h3><p>Aim for a clear view of the shell markings without glare or heavy shadows.</p></div></li>
          <li><Camera size={22} aria-hidden="true"/><div><h3>Try a different angle</h3><p>Stay back and photograph the crab where you found it. Change your angle if the claws are hidden.</p></div></li>
        </ul>
      </section>
      <aside className="tips-result" aria-label="Match scores and photo privacy">
        <section>
          <h2>Reading your results</h2>
          <p>Match percentages are model scores. Compare the crab’s features with the reference photos. If you’re unsure, try another angle.</p>
        </section>
        <section>
          <h2>Photo privacy</h2>
          <p>Private photos expire after 24 hours and are never used for training. Results stay in My observations for 30 days.</p>
        </section>
      </aside>
    </div>
  </article>;
}

const speciesTabs = [
  {id: 'overview', label: 'Overview', Icon: BookOpen},
  {id: 'information', label: 'Crab info', Icon: NotebookText},
  {id: 'nutrition', label: 'Nutrition', Icon: Utensils},
  {id: 'sources', label: 'Sources', Icon: Link2},
];
const speciesSourcesTab = speciesTabs.findIndex(tab => tab.id === 'sources');

function SpeciesDetail({species, back}: {
  species: Species; back: string;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const previousTab = useRef(0);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabDock = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const activePanel = useRef<HTMLDivElement>(null);
  const toxic = species.toxicity === 'toxic';
  const toxicWarning = 'Do not eat this crab, even if cooked.';
  const warning = species.safety_warning && <p className="result-caution specimen-safety">
    <ShieldCheck size={20} aria-hidden="true"/>{species.safety_warning}
  </p>;

  useLayoutEffect(() => {
    const direction = Math.sign(activeTab - previousTab.current);
    previousTab.current = activeTab;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const panel = activePanel.current;
    if (!motion || motion.matches || !panel) return;

    const enter = animate(panel, {opacity: [.4, 1], x: [direction * 16, 0], duration: 290, ease: 'out(3)'});
    const details = panel.querySelectorAll('.specimen-reveal, .nutrition-card, .species-source-grid > div');
    const reveal = details.length ? animate(details, {
      opacity: [.55, 1], y: [12, 0], delay: stagger(45, {start: 65}), duration: 310, ease: 'out(3)',
    }) : null;
    function stop() {
      enter.revert();
      reveal?.revert();
    }
    function updateMotion() {
      if (motion?.matches) stop();
    }
    motion.addEventListener('change', updateMotion);
    return () => {
      motion.removeEventListener('change', updateMotion);
      stop();
    };
  }, [activeTab]);

  function selectTab(index: number) {
    if (index === activeTab) return;
    if (tabDock.current && stage.current) {
      const dockBottom = tabDock.current.getBoundingClientRect().bottom;
      const stageTop = stage.current.getBoundingClientRect().top;
      if (stageTop < dockBottom) {
        window.scrollBy({top: stageTop - dockBottom - 8, behavior: 'instant'});
      }
    }
    setActiveTab(index);
    tabButtons.current[index]?.focus({preventScroll: true});
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = speciesTabs.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = index === 0 ? last : index - 1; break;
      case 'ArrowRight': next = index === last ? 0 : index + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
    }
    event.preventDefault();
    selectTab(next);
  }

  const overviewFacts = [
    {label: 'Habitat', value: species.habitat, Icon: MapPin},
    {label: 'Range', value: species.distribution, Icon: Globe2},
    {label: 'Reported size', value: species.size_range, Icon: Ruler},
  ].filter(({value}) => value);

  const overview = <div className="specimen-spread">
    {toxic && <button className="specimen-toxic" type="button"
      aria-label="View safety sources" aria-describedby="species-toxic-title species-toxic-description"
      onClick={() => selectTab(speciesSourcesTab)}>
      <span className="specimen-toxic-icon"><ShieldAlert size={26} aria-hidden="true"/></span>
      <span className="specimen-toxic-copy">
        <strong id="species-toxic-title">Toxic species</strong>
        <span id="species-toxic-description">{toxicWarning}</span>
      </span>
      <span className="specimen-toxic-action" aria-hidden="true">
        <span>Safety sources</span><ArrowRight size={17}/>
      </span>
      <span className="specimen-toxic-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/></span>
    </button>}
    <div className="specimen-overview-photo specimen-reveal"><SpeciesPhoto species={species} large eager/></div>
    <section className="specimen-summary specimen-reveal" aria-labelledby="species-overview-heading">
      <h2 id="species-overview-heading">At a glance</h2>
      {species.description && <p className="shell-lead">{species.description}</p>}
      {!!overviewFacts.length && <dl className="specimen-overview-facts">
        {overviewFacts.map(({label, value, Icon}) => <div key={label}>
          <dt><Icon size={19} aria-hidden="true"/> {label}</dt>
          <dd>{value}</dd>
        </div>)}
      </dl>}
    </section>
    {warning}
  </div>;
  const information = <section className="specimen-notes" aria-label="Crab information">
    <div className="specimen-traits specimen-reveal"><h2>What to look for</h2>
      {species.diagnostic_traits?.length ? <ul>{species.diagnostic_traits.map(trait => <li key={trait}>{trait}</li>)}</ul> : <p>Trait notes await review.</p>}
      {species.life_stage_notes && <p>{species.life_stage_notes}</p>}
      {!!species.lookalikes?.length && <><h3>Similar species</h3><p>{species.lookalikes.join(', ')}</p></>}
    </div>
    <div className="specimen-reveal"><h2>Species notes</h2><dl>{[
      ['Habitat', species.habitat], ['Distribution', species.distribution], ['Reported size', species.size_range],
      ['Coloration', species.coloration], ['Food use', species.edibility === 'reported_food_use' ? 'Reported food use' :
        species.edibility === 'not_recommended' ? 'Do not eat' : 'Unverified'],
      ['Toxicity', toxic ? 'Known toxic species' : species.toxicity === 'diet_related_risk_reported' ? 'Poisoning risk reported' : 'Unverified'],
    ].filter(([,value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
    {warning}
  </section>;
  const panels = [overview, information, <NutritionDetails species={species} standalone/>, <SpeciesSources species={species}/>];

  return <article className="shell-page specimen-page">
    <a className="back-link" href={back}><ChevronLeft size={18}/>{back === guide ? 'Back to the field guide' : 'Back to comparison'}</a>
    <header className="specimen-heading">
      <h1>{species.english_name}</h1>
      <p className="specimen-latin">{species.scientific_name}</p>
    </header>
    <div className="specimen-tab-dock" ref={tabDock}>
      <div className="specimen-tabs" role="tablist" aria-label="Species details" style={{
        '--tab-index': activeTab, '--tab-column': activeTab % 2, '--tab-row': Math.floor(activeTab / 2),
      } as CSSProperties}>
        <span className="specimen-tab-highlight" aria-hidden="true"/>
        {speciesTabs.map(({id, label, Icon}, index) => <button
          key={id} type="button" role="tab" id={`species-tab-${id}`} aria-controls={`species-panel-${id}`}
          aria-selected={activeTab === index} tabIndex={activeTab === index ? 0 : -1}
          ref={button => { tabButtons.current[index] = button; }}
          onClick={() => selectTab(index)} onKeyDown={event => handleTabKey(event, index)}>
          <Icon size={19} aria-hidden="true"/>{label}
        </button>)}
      </div>
    </div>
    <div className="specimen-stage" ref={stage}>
      {speciesTabs.map(({id}, index) => <div key={id} role="tabpanel" id={`species-panel-${id}`}
        aria-labelledby={`species-tab-${id}`} tabIndex={0} hidden={activeTab !== index}
        className="specimen-panel" ref={activeTab === index ? activePanel : undefined}>
        {activeTab === index && <>
          {toxic && index !== 0 && <p className="specimen-toxic-reminder">
            <ShieldAlert size={17} aria-hidden="true"/>
            <span><strong>Toxic species</strong> · <span>{toxicWarning}</span></span>
          </p>}
          {panels[index]}
        </>}
      </div>)}
    </div>
  </article>;
}

function SpeciesSources({species}: {species: Species}) {
  const hasPoisoningWarning = species.toxicity === 'toxic' || species.toxicity === 'diet_related_risk_reported';
  const nutrition = hasPoisoningWarning ? null : species.nutrition;
  const nutritionSources = nutrition ? [nutrition.source] : [];
  if (nutrition && nutrition.cholesterol_mg !== null) nutritionSources.push(nutrition.threshold_source);
  const nutritionIds = new Set(nutritionSources.map(source => source.id));
  const informationSources = species.sources.filter(source => !nutritionIds.has(source.id));

  return <section className="sources-section">
    <h2>Sources and review</h2>
    <div className="species-source-grid">
      <div><h3>Crab information</h3>
        <SpeciesSourceLinks sources={informationSources} empty="Reference links are pending."/>
      </div>
      <div><h3>Crab nutrition</h3>
        <SpeciesSourceLinks sources={nutritionSources} empty={species.toxicity === 'toxic'
          ? 'Food-use nutrition is omitted for this toxic species.'
          : 'No verified species-specific nutrition source is listed.'}/>
      </div>
    </div>
    <p className="sources-review">{species.last_reviewed ? 'Last expert review ' + species.last_reviewed : 'Expert review pending'}</p>
  </section>;
}

function SpeciesSourceLinks({sources, empty}: {sources: Source[]; empty: string}) {
  return sources.length ? <ul className="species-source-links">{sources.map(source => <li key={source.id}>
    <a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
  </li>)}</ul> : <p>{empty}</p>;
}

function ObservationPhoto({prediction, alt, lazy = false}: {prediction: Prediction; alt: string; lazy?: boolean}) {
  const [failed, setFailed] = useState(false);
  const expired = Date.now() >= (prediction.created_at + 86_400) * 1000;
  if (failed || expired) return <div className="photo-unavailable">{expired ? 'Photo expired' : 'Photo unavailable'}</div>;
  return <img src={`/api/uploads/${encodeURIComponent(prediction.upload_id)}/image`} alt={alt}
    loading={lazy ? 'lazy' : undefined} onError={() => setFailed(true)}/>;
}

function ObservationPage({id, prediction, species, model, candidateId, onSelect, onSpecies}: {
  id: string; prediction?: Prediction; species: Species[]; model?: Model; candidateId?: string;
  onSelect: (id: string) => void; onSpecies: (id: string) => void;
}) {
  const [record, retry] = useResource<Prediction>(prediction ? null : '/predictions/' + id, true);
  const result = prediction ?? (record.status === 'ready' ? record.data : undefined);
  const [view, setView] = useState<'input' | 'reference'>(candidateId ? 'reference' : 'input');
  if (!result) return <LoadState state={record} label="Loading the observation…" retry={retry}/>;
  const example = species.find(item => item.id === exampleFor(result.id));
  const candidate = result.candidates.find(item => item.species_id === candidateId) ?? result.candidates[0];
  const reference = candidate && species.find(item => item.id === candidate.species_id);
  const acceptedSpecies = result.status === 'identified' ? species.find(item => item.id === result.candidates[0]?.species_id) : undefined;
  const coverage = model?.version === result.model_version ? model?.species_ids?.length : undefined;
  const inputLabel = example ? 'Example photo' : 'Your photo';

  return <article className="shell-page observation-page">
    <a className="back-link" href={observations}><ChevronLeft size={18}/> My observations</a>
    <h1>{resultTitle(result)}</h1>
    <p className="shell-lead">{resultMessage(result)}</p>
    {result.experimental && <p className="model-summary">Experimental model{coverage ? ` · Compares ${coverage} species` : ''}</p>}
    {candidate && <section className="comparison" aria-labelledby="comparison-heading">
      <div className="match-panel">
        <h2 id="comparison-heading">Possible matches</h2>
        <p id="match-score-note">Model scores · Select a species to compare photos.</p>
        <div className="comparison-candidates" role="group" aria-label="Model suggestions" aria-describedby="match-score-note">
          {result.candidates.map((item, index) => {
            const entry = species.find(crab => crab.id === item.species_id);
            const name = item.english_name || entry?.english_name || item.scientific_name;
            const score = Math.round(item.confidence * 100);
            return <button className="match-candidate" key={item.species_id} type="button"
              aria-pressed={candidate.species_id === item.species_id}
              onClick={() => {onSelect(item.species_id); setView('reference');}}>
              <span className="match-rank"><span className="visually-hidden">Rank </span>{index + 1}</span>
              <span className="match-score"><span className="visually-hidden">Model score </span>{score}%</span>
              <span className="match-species"><strong>{name}</strong>
                {name !== item.scientific_name && <i>{item.scientific_name}</i>}
              </span>
              <meter className="match-meter" min="0" max="100" value={score} aria-hidden="true"/>
            </button>;
          })}
        </div>
      </div>
      <div className="comparison-switch" role="group" aria-label="Photo view">
        <button type="button" aria-pressed={view === 'input'} onClick={() => setView('input')}>{inputLabel}</button>
        <button type="button" aria-pressed={view === 'reference'} onClick={() => setView('reference')}>Reference photo</button>
      </div>
      <div className="comparison-grid" data-view={view}>
        <section className="comparison-input"><h3>{inputLabel}</h3>
          <figure><ObservationPhoto prediction={result} alt={inputLabel + ' submitted for identification'}/></figure>
          {example && <p><strong>{example.english_name}</strong><br/><i>{example.scientific_name}</i><br/><PhotoCredit species={example}/></p>}
        </section>
        <section className="comparison-reference"><h3>Reference photo</h3>
          {reference ? <SpeciesPhoto key={reference.id} species={reference} large/> : <div className="photo-unavailable">Reference photo unavailable</div>}
          <p><strong>{candidate.english_name || reference?.english_name || candidate.scientific_name}</strong><br/><i>{candidate.scientific_name}</i></p>
          {reference && <a className="atlas-action" href={speciesLink(reference.id)} onClick={() => onSpecies(reference.id)}>
            Open species entry <ArrowRight size={18}/>
          </a>}
        </section>
      </div>
    </section>}
    {!candidate && <>
      <figure className="single-observation-photo"><figcaption>{inputLabel}</figcaption>
        <ObservationPhoto prediction={result} alt={inputLabel + ' submitted for identification'}/>
      </figure>
      <div className="result-actions">
        <a className="primary" href={guide}>{result.reason === 'model_unavailable' ? 'Browse the field guide' : 'Try another photo'} <ArrowRight size={18}/></a>
        <a className="secondary" href={photoTips}>Photo tips</a>
      </div>
    </>}
    {result.reason === 'poor_image_quality' && candidate && <a className="secondary" href={guide}>Try another photo</a>}
    <p className="result-caution"><ShieldCheck size={20}/> A photo cannot confirm food safety.</p>
    {acceptedSpecies && <SpeciesFacts species={acceptedSpecies} onMore={() => {
      onSpecies(acceptedSpecies.id);
      location.hash = speciesLink(acceptedSpecies.id);
    }}/>}
    <details className="observation-details"><summary>Model details and photo tips</summary>
      <p>{result.confidence_explanation}</p>
      {result.quality_warnings.length > 0 && <p>Photo checks · {result.quality_warnings.map(words).join(', ')}</p>}
      <p>{result.photo_guidance}</p>
      <ul>{result.suggested_photos.map(angle => <li key={angle}>{words(angle)}</li>)}</ul>
      <p>{result.safety_disclaimer}</p>
      <small>Model {result.model_version}</small>
    </details>
    <Correction species={species} prediction={result}/>
  </article>;
}

function Correction({species, prediction}: {species: Species[]; prediction: Prediction}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [message, setMessage] = useState('');

  async function send(data: FormData) {
    setState('sending');
    setMessage('');
    try {
      await startSession();
      await api('/feedback', {method: 'POST', body: JSON.stringify({
        prediction_id: prediction.id, note: data.get('note'), suggested_species_id: data.get('species') || null,
      })});
      setState('sent');
    } catch (error) {
      setMessage((error as Error).message);
      setState('idle');
    }
  }

  return <details className="observation-details"><summary>Suggest a correction</summary>
    {state === 'sent' ? <p role="status"><Check size={16}/> Sent for review.</p> :
      <form onSubmit={event => {event.preventDefault(); void send(new FormData(event.currentTarget));}}>
        <label>Possible species<select name="species"><option value="">Unknown or another species</option>
          {species.map(item => <option value={item.id} key={item.id}>{item.scientific_name}</option>)}
        </select></label>
        <label>What did you notice?<textarea name="note" required minLength={3} maxLength={2000}/></label>
        {message && <p role="alert">{message}</p>}
        <button className="primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send for review'}</button>
      </form>}
  </details>;
}

const observationDate = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function ObservationCard({prediction, species, onDelete}: {
  prediction: Prediction; species: Species[]; onDelete: () => void;
}) {
  const candidate = prediction.status === 'identified' ? prediction.candidates[0] : undefined;
  const commonName = candidate && (candidate.english_name || species.find(item => item.id === candidate.species_id)?.english_name);
  const status = resultTitle(prediction);
  const title = commonName || candidate?.scientific_name || (prediction.reason === 'model_unavailable' ? 'Crab photo' : 'Unresolved observation');
  const recordedAt = new Date(prediction.created_at * 1000);
  const headingId = 'observation-title-' + prediction.id;
  const statusId = 'observation-status-' + prediction.id;

  return <article className="observation-card">
    <a className="observation-card-link" href={observationLink(prediction.id)} aria-labelledby={headingId} aria-describedby={statusId}>
      <div className="observation-thumb"><ObservationPhoto prediction={prediction} alt="" lazy/></div>
      <div className="observation-card-copy">
        <span id={statusId} className="observation-status" data-match={!!candidate}>{status}</span>
        <h2 id={headingId}>{title}</h2>
        {commonName && commonName !== candidate?.scientific_name && <i>{candidate?.scientific_name}</i>}
        <ArrowRight className="observation-arrow" size={20} aria-hidden="true"/>
      </div>
    </a>
    <div className="observation-card-meta">
      <time dateTime={recordedAt.toISOString()}><CalendarDays size={15} aria-hidden="true"/>{observationDate.format(recordedAt)}</time>
      <button className="observation-delete" aria-label={`Delete observation and photo for ${title}`} onClick={onDelete}>
        <Trash2 size={17} aria-hidden="true"/>
      </button>
    </div>
  </article>;
}

function ObservationHistory({species, onDelete}: {species: Species[]; onDelete: (id: string) => void}) {
  const [resource, retry] = useResource<{items: Prediction[]}>('/predictions', true);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<Prediction>();
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const confirmation = useRef<HTMLDialogElement>(null);
  const items = resource.status === 'ready' ? resource.data.items.filter(item => !removed.includes(item.id)) : [];

  async function remove(item: Prediction) {
    setDeleting(true);
    setMessage('');
    try {
      await api('/predictions/' + encodeURIComponent(item.id), {method: 'DELETE'});
      setRemoved(previous => [...previous, item.id]);
      try { sessionStorage.removeItem('shellfie:example:' + item.id); } catch { /* Storage may be disabled. */ }
      onDelete(item.id);
      confirmation.current?.close();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return <section className="shell-page observations-page">
    <header className="observations-heading">
      <div>
        <h1>My observations</h1>
        <p><ShieldCheck size={17} aria-hidden="true"/> Private to this browser. Results are kept for 30 days and photos for 24 hours.</p>
      </div>
      {items.length > 0 && <a className="primary" href={guide}><Camera size={18} aria-hidden="true"/> New observation</a>}
    </header>
    {resource.status !== 'ready' ? <LoadState state={resource} label="Loading observations…" retry={retry}/> :
      items.length ? <div className="observations-list">{items.map(item =>
        <ObservationCard key={item.id} prediction={item} species={species} onDelete={() => {
          setPending(item); setMessage(''); confirmation.current?.showModal();
        }}/>)}</div> : <div className="observations-empty">
          <History size={28} aria-hidden="true"/>
          <h2>No observations yet</h2>
          <p>Your photo identifications will appear here.</p>
          <a href={guide} className="primary"><Camera size={18} aria-hidden="true"/> Identify a photo</a>
        </div>}
    <dialog className="delete-confirmation" ref={confirmation} aria-labelledby="delete-heading" onCancel={event => {
      if (deleting) event.preventDefault();
    }}>
      <h2 id="delete-heading">Delete this observation?</h2>
      {pending && <p>The {resultTitle(pending).toLowerCase()} result from {new Date(pending.created_at * 1000).toLocaleString()} and its photo will be removed.</p>}
      {message && <p role="alert">{message}</p>}
      <div className="result-actions"><button className="secondary" autoFocus disabled={deleting} onClick={() => confirmation.current?.close()}>Cancel</button>
        <button className="delete-button" disabled={deleting || !pending} onClick={() => {if (pending) void remove(pending);}}>
          {deleting ? 'Deleting…' : 'Delete observation'}
        </button></div>
    </dialog>
  </section>;
}

function SpeciesFacts({species:s,onMore}:{species:Species;onMore:()=>void}) {
  const edibility=s.edibility==='reported_food_use' ? 'Reported food use' : s.edibility==='not_recommended' ? 'Do not eat' : s.edibility==='unknown' ? 'Not established' : words(s.edibility);
  const poisonous=s.toxicity==='toxic' ? 'Known toxic species' : s.toxicity==='diet_related_risk_reported' ? 'Diet-related poisoning reported' : s.toxicity==='unknown' ? 'Not established' : words(s.toxicity);
  return <section className="species-facts" aria-label="Identified species details">
    <div className="eyebrow">ABOUT THIS SPECIES</div>
    <div className="species-name-pair"><h3>{s.english_name}</h3><em>{s.scientific_name}</em></div>
    {s.description && <p className="species-description">{s.description}</p>}
    <dl className="facts-grid">
      <div><dt>Edible?</dt><dd>{edibility}</dd></div>
      <div className={s.toxicity==='toxic'||s.toxicity==='diet_related_risk_reported'?'facts-caution':undefined}><dt>Poisonous?</dt><dd>{poisonous}</dd></div>
      <div><dt>Where to look</dt><dd>{s.habitat}</dd></div>
      <div><dt>Where it occurs</dt><dd>{s.distribution}</dd></div>
    </dl>
    <NutritionDetails species={s}/>
    <p className="facts-note">Species reference only. Edibility does not establish the safety of the photographed crab.</p>
    <div className="facts-links"><button className="text-button" onClick={onMore}>Full species details <ArrowRight size={17}/></button>
      {s.sources.length>0 && <details><summary>Sources</summary>{s.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>}
    </div>
  </section>;
}

type ReviewItem={id:string;note?:string;status:string;scientific_name?:string;provider?:string;license?:string;source_url?:string};
function Reviewer({onError}:{onError:(s:string)=>void}) {
  const [key,setKey]=useState('');const [items,setItems]=useState<ReviewItem[]>([]);const [loaded,setLoaded]=useState(false);const [kind,setKind]=useState('reviews');const [notes,setNotes]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
  async function load(){setBusy(true);try{const r=await api<{items:ReviewItem[]}>(`/admin/${kind}`,{},key);setItems(r.items);setLoaded(true);}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
  async function review(id:string,decision:string){setBusy(true);try{await api(`/admin/${kind}/${id}${kind==='dataset'?'/review':''}`,{method:'POST',body:JSON.stringify({decision,note:notes[id]||''})},key);setItems(items.filter(i=>i.id!==id));}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
  return <section className="catalog"><div className="eyebrow">RESTRICTED WORKSPACE</div><h1>Expert review</h1><p>Review decisions are audited. Accepted corrections never automatically become training labels.</p><form className="review-login" onSubmit={e=>{e.preventDefault();void load();}}><label>Reviewer key<input type="password" autoComplete="off" required value={key} onChange={e=>setKey(e.target.value)}/></label><label>Queue<select value={kind} onChange={e=>{setKind(e.target.value);setLoaded(false);setItems([]);}}><option value="reviews">Identification feedback</option><option value="dataset">Dataset items</option></select></label><button className="primary" disabled={busy}>Load queue</button><button className="secondary" type="button" onClick={()=>{setKey('');setItems([]);setLoaded(false);}}>Clear access</button></form>{loaded&&!items.length&&<p>No pending items.</p>}{items.map(i=><article className="review-item" key={i.id}><h2>{i.scientific_name||'Identification feedback'}</h2><p>{i.note||`${i.provider} · ${i.license}`}</p>{i.source_url&&<a href={i.source_url} target="_blank" rel="noreferrer">Inspect source ↗</a>}<p>Status: {words(i.status)}</p>{i.status==='pending'&&<><label>Review rationale (at least 10 characters)<textarea value={notes[i.id]||''} onChange={e=>setNotes({...notes,[i.id]:e.target.value})}/></label><div className="upload-actions">{['accepted','rejected','needs_expert'].map(d=><button className="secondary" key={d} disabled={busy||(notes[i.id]||'').length<10} onClick={()=>void review(i.id,d)}>{words(d)}</button>)}</div></>}</article>)}</section>;
}
