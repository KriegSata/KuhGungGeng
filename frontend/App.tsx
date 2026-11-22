import {useEffect, useRef, useState, type ReactNode} from 'react';
import {ArrowRight, BookOpen, Camera, Check, ChevronLeft, Compass, History, ImagePlus, Info, LoaderCircle, Search, ShieldCheck, Trash2, Upload, Waves, X} from 'lucide-react';
import {api, startSession, validateFile} from './api';
import type {Prediction, Species} from './types';
import SpeciesPhoto, {PhotoCredit} from './SpeciesPhoto';

const warning = 'Do not consume a crab based solely on model output. A photograph cannot establish food safety.';
const words = (value:string) => value.replaceAll('_',' ');

function CrabArt({small=false}:{small?:boolean}) {
  return <svg className={small?'crab-art small':'crab-art'} viewBox="0 0 520 390" fill="none" aria-hidden="true">
    <defs><linearGradient id="shell" x1="130" y1="100" x2="370" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#b96242"/><stop offset="1" stopColor="#713728"/></linearGradient><pattern id="speckle" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="4" cy="6" r="1.4" fill="#ecc9a0" opacity=".35"/></pattern></defs>
    <g stroke="#84412e" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
      <path d="M183 222L115 233L53 275M181 239L121 263L84 317M195 257L151 293L132 345M207 271L187 308L190 352M337 222L405 233L467 275M339 239L399 263L436 317M325 257L369 293L388 345M313 271L333 308L330 352"/>
      <path d="M187 195L124 164L102 116M333 195L396 164L418 116" strokeWidth="21"/>
    </g>
    <path d="M105 135C63 124 53 82 73 52L90 89L103 91L111 47C145 66 153 101 126 128Z" fill="url(#shell)" stroke="#653b2a" strokeWidth="3"/>
    <path d="M415 135C457 124 467 82 447 52L430 89L417 91L409 47C375 66 367 101 394 128Z" fill="url(#shell)" stroke="#653b2a" strokeWidth="3"/>
    <path d="M149 206L157 187L170 184L175 169L190 168L197 152Q260 130 323 152L330 168L345 169L350 184L363 187L371 206Q349 281 260 287Q171 281 149 206Z" fill="url(#shell)" stroke="#653b2a" strokeWidth="3"/>
    <path d="M160 202Q176 149 260 150Q344 149 360 202Q345 270 260 278Q175 270 160 202" fill="url(#speckle)"/>
    <path d="M201 187Q260 166 319 187M202 237Q260 261 318 237M260 189L260 245" stroke="#e2ae80" strokeOpacity=".35" strokeWidth="2"/>
    <path d="M224 154L216 132M296 154L304 132" stroke="#6c3e29" strokeWidth="7"/><circle cx="215" cy="131" r="7" fill="#23382e"/><circle cx="305" cy="131" r="7" fill="#23382e"/>
  </svg>;
}

export default function App() {
  const [tab,setTab]=useState('identify');
  const [species,setSpecies]=useState<Species[]>([]);
  const [selected,setSelected]=useState<Species|null>(null);
  const [search,setSearch]=useState('');
  const [ready,setReady]=useState(false);
  const [modelAvailable,setModelAvailable]=useState(false);
  const [error,setError]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [result,setResult]=useState<Prediction|null>(null);
  const [resultOpen,setResultOpen]=useState(false);
  const [history,setHistory]=useState<Prediction[]>([]);
  const [note,setNote]=useState('');
  const [feedbackSent,setFeedbackSent]=useState(false);
  const [suggestion,setSuggestion]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const camera=useRef<HTMLInputElement>(null);
  const selectionVersion=useRef(0);

  useEffect(()=>{let active=true; (async()=>{try {await startSession(); const [catalog,model]=await Promise.all([api<{items:Species[]}>('/species'),api<{available:boolean}>('/model')]); if(active){setSpecies(catalog.items);setModelAvailable(model.available);setReady(true);}}catch(e){if(active)setError((e as Error).message);}})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>{if(tab==='history' && ready) api<{items:Prediction[]}>('/predictions').then(r=>setHistory(r.items)).catch(e=>setError(e.message));},[tab,ready]);
  useEffect(()=>{if(result)setResultOpen(true);},[result]);

  async function choose(candidate?:File) {
    if (!candidate || busy) return;
    const version=++selectionVersion.current;
    setError(''); setResult(null);setFile(null);setFeedbackSent(false);
    const invalid=validateFile(candidate);if(invalid){setError(invalid);return;}
    try {
      const bitmap=await createImageBitmap(candidate);
      const invalidSize=Math.min(bitmap.width,bitmap.height)<224 || bitmap.width*bitmap.height>24_000_000 || Math.max(bitmap.width,bitmap.height)>12000;
      bitmap.close();
      if(invalidSize) throw new Error('Use an image at least 224 × 224 pixels and no larger than 24 megapixels or 12,000 pixels on either side.');
      if(version===selectionVersion.current)setFile(candidate);
    } catch(e) {if(version===selectionVersion.current)setError((e as Error).message || 'This image could not be opened.');}
  }
  async function identify() {
    if(!file)return;
    setBusy(true);setError('');setResult(null);setFeedbackSent(false);
    try {
      const form=new FormData();form.append('file',file);
      const uploaded=await api<{id:string}>('/uploads',{method:'POST',body:form});
      setResult(await api<Prediction>('/predictions',{method:'POST',body:JSON.stringify({upload_id:uploaded.id,top_k:3})}));setResultOpen(true);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function sendFeedback() {
    if(!result)return;setBusy(true);setError('');
    try{await api('/feedback',{method:'POST',body:JSON.stringify({prediction_id:result.id,note,suggested_species_id:suggestion||null})});setFeedbackSent(true);setNote('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const filtered=species.filter(s=>[s.scientific_name,s.english_name,...s.names.map(n=>n.name)].join(' ').toLowerCase().includes(search.toLowerCase()));
  const identifiedSpecies=result?.status==='identified' ? species.find(s=>s.id===result.candidates[0]?.species_id) : undefined;

  return <><a className="skip" href="#main">Skip to content</a><header className="header"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('identify');setSelected(null);}}><span className="brand-icon"><Waves size={23}/></span><span>KuhGungGeng<span className="brand-caption">A PHILIPPINE CRAB FIELD GUIDE</span></span></a><nav aria-label="Main navigation">{[{id:'identify',label:'Identify',icon:Compass},{id:'guide',label:'Field guide',icon:BookOpen},{id:'history',label:'My observations',icon:History}].map(({id,label,icon:Icon})=><button key={id} className={tab===id?'nav active':'nav'} onClick={()=>{setTab(id);setSelected(null);setError('');}} aria-current={tab===id?'page':undefined}><Icon size={16}/>{label}</button>)}</nav><span className="region"><span/>Philippines</span></header>
    <main id="main">
    {error && <div className="error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
    {tab==='identify' && <>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span/> YOUR COASTAL FIELD GUIDE</div><h1>Meet the crabs<br/>of the <em>Philippines.</em></h1><p>One photo. Discover a possible species.</p></div><div className="specimen"><div className="specimen-orbit"/><CrabArt/><span className="specimen-label">BRACHYURA <span>01 — FIELD NOTES</span></span><span className="art-note">Illustration</span></div></section>
      <section className="workspace"><div className="upload-card"><div className="section-heading"><span className="step">01</span><div><h2>Identify your crab</h2></div></div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label="Choose crab photograph" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}} disabled={busy}/>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="visually-hidden" aria-label="Take crab photograph" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}} disabled={busy}/>
        <button className={`dropzone ${dragging?'dragging':''} ${preview?'has-preview':''}`} disabled={busy} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void choose(e.dataTransfer.files[0]);}} aria-label={preview?'Replace photograph':'Upload a crab photograph'}>
          {preview ? <><img src={preview} alt="Your selected crab photograph"/><span className="replace"><ImagePlus size={16}/> Change photo</span></> : <><span className="upload-icon"><Upload size={32} strokeWidth={1.4}/></span><strong>Upload a crab photo</strong><span>Drop an image or browse files</span><small>JPG, PNG, WebP · max 10 MiB</small></>}
        </button><div className="upload-actions"><button className="secondary" onClick={()=>camera.current?.click()} disabled={busy}><Camera size={17}/> Take a photo</button><button className="primary" disabled={!file||!ready||busy} onClick={()=>void identify()}>{busy?<LoaderCircle className="spin" size={17}/>:<Search size={17}/>} {busy?'Examining photo…':'Identify crab'}<ArrowRight size={16}/></button></div>
        <p className="privacy"><ShieldCheck size={16}/> Private for 24 hours. Never used for training.</p>
      </div><aside className="tips"><div className="eyebrow">BEFORE YOU UPLOAD</div><h2>A clearer photo.<br/>A better match.</h2><ol><li><span>1</span><div><strong>Show the whole crab</strong><p>Shell, claws, and legs in view.</p></div></li><li><span>2</span><div><strong>Use natural light</strong><p>Keep it sharp. Avoid glare.</p></div></li><li><span>3</span><div><strong>Keep a safe distance</strong><p>Photograph without touching.</p></div></li></ol></aside></section>
      {!modelAvailable && <div className="model-notice"><Info size={19}/><div><strong>Identification model awaiting validation</strong><p>Photo uploads are available. Predictions are not yet enabled.</p></div></div>}
      {result && <button className="secondary reopen-result" onClick={()=>setResultOpen(true)}>View last result <ArrowRight size={17}/></button>}
      {result && <ResultDialog open={resultOpen} onClose={()=>setResultOpen(false)}><section className="result" aria-live="polite"><div className="eyebrow">YOUR OBSERVATION</div><h2 id="prediction-title">{result.status==='identified'?'A possible identification':'Not enough information to identify this crab'}</h2><p>{result.reason==='model_unavailable'?'No validated identification model is installed. Your image was processed, but no species prediction was made.':result.reason?`We could not make a reliable species identification: ${words(result.reason)}.`:'This is a model suggestion. Compare diagnostic traits and consult an expert when uncertain.'}</p>
        <img className="result-photo" src={`/api/uploads/${result.upload_id}/image`} alt="Crab photograph for this observation" onError={e=>{e.currentTarget.hidden=true;}}/>
        {result.experimental && <span className="model-badge">Experimental · 8 species</span>}
        {result.candidates.map(c=><button className="candidate" key={c.species_id} onClick={()=>{setSelected(species.find(s=>s.id===c.species_id)||null);setTab('guide');}}><em>{c.scientific_name}</em><span>{Math.round(c.confidence*100)}% supported-class score <ArrowRight size={15}/></span></button>)}
        {identifiedSpecies && <SpeciesFacts species={identifiedSpecies} onMore={()=>{setSelected(identifiedSpecies);setTab('guide');}}/>}
        {result.quality_warnings.length>0 && <p className="quality">Photo checks: {result.quality_warnings.map(words).join(', ')}. These checks are approximate.</p>}
        <p className="result-caution"><ShieldCheck size={19}/> A photo cannot confirm food safety.</p>
        <details className="result-info"><summary>About this result & photo tips</summary><p>{result.confidence_explanation}</p><p>{result.photo_guidance}</p><div className="photo-views">{result.suggested_photos.map(p=><span key={p}>{words(p)}</span>)}</div><p className="safety"><ShieldCheck size={17}/>{result.safety_disclaimer}</p><small className="muted">Model: {result.model_version} · Observation {result.id.slice(0,8)}</small></details>
        <details><summary>Suggest a correction</summary>{feedbackSent?<p role="status"><Check size={16}/> Sent for review.</p>:<form onSubmit={e=>{e.preventDefault();void sendFeedback();}}><label>Possible species<select value={suggestion} onChange={e=>setSuggestion(e.target.value)}><option value="">Unknown / another species</option>{species.map(s=><option key={s.id} value={s.id}>{s.scientific_name}</option>)}</select></label><label>What did you notice?<textarea required minLength={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe the visible traits."/></label><button className="primary" disabled={busy}>Send for review</button></form>}</details></section></ResultDialog>}
      <section className="guide-preview"><div><div className="eyebrow">KEEP EXPLORING</div><h2>Get to know your coast.</h2></div><button className="text-button" onClick={()=>setTab('guide')}>Explore the field guide <ArrowRight size={18}/></button></section>
    </>}
    {tab==='guide' && (selected?<SpeciesDetail species={selected} back={()=>setSelected(null)}/>:<section className="catalog field-guide">
      <div className="eyebrow">THE COAST, UP CLOSE</div><h1>Know your coastal neighbors.</h1><p>Explore real photographs, habitats, and species notes.</p>
      <div className="guide-tools"><label className="search"><Search size={21}/><input aria-label="Search species" placeholder="Search crab names…" value={search} onChange={e=>setSearch(e.target.value)}/></label><span>{filtered.length} species</span></div>
      <div className="species-grid">{filtered.map(s=><GuideCard key={s.id} species={s} onSelect={()=>setSelected(s)}/>)}</div>
      {!filtered.length&&<p>No species found. Try another name.</p>}
    </section>)}
    {tab==='history' && <section className="catalog"><div className="eyebrow">YOUR PRIVATE FIELD NOTES</div><h1>My observations</h1><p>Saved in this browser’s private session for 30 days. Photos expire after 24 hours.</p>{!history.length?<div className="empty"><History size={40}/><h2>Your next discovery starts here.</h2><p>Upload a photograph to create your first observation.</p><button className="primary" onClick={()=>setTab('identify')}>Identify a crab <ArrowRight size={16}/></button></div>:history.map(h=><article className="history-row" key={h.id}><div><strong>{h.candidates[0]?.scientific_name||'Unresolved observation'}</strong><p>{new Date(h.created_at*1000).toLocaleString()} · {words(h.status)}</p></div><button className="secondary" onClick={()=>{setResult(h);setFeedbackSent(false);setTab('identify');}}>View</button><button className="icon-button" aria-label="Delete observation and photo" onClick={async()=>{try{await api(`/predictions/${h.id}`,{method:'DELETE'});setHistory(history.filter(item=>item.id!==h.id));}catch(e){setError((e as Error).message);}}}><Trash2 size={18}/></button></article>)}</section>}
    {tab==='review'&&<Reviewer onError={setError}/>}
    <div className="bottom-warning"><ShieldCheck size={20}/><p>{warning}</p></div>
    </main><footer><span className="footer-brand"><Waves size={18}/> KuhGungGeng</span><p>Made for curious minds and Philippine shores.</p><button onClick={()=>{setTab('review');setError('');}}>Reviewer workspace</button></footer></>;
}

function ResultDialog({open,onClose,children}:{open:boolean;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current;
    if(!element)return;
    if(open && !element.open)element.showModal();
    if(!open && element.open)element.close();
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previousOverflow;};
  },[open]);
  return <dialog ref={dialog} className="prediction-dialog" aria-labelledby="prediction-title" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="dialog-content"><div className="dialog-toolbar"><span>IDENTIFICATION RESULT</span><button className="icon-button" autoFocus aria-label="Close prediction" onClick={onClose}><X size={24}/></button></div>{children}</div>
  </dialog>;
}

function GuideCard({species:s,onSelect}:{species:Species;onSelect:()=>void}) {
  return <article className="species-card photo-card"><button className="guide-card-button" onClick={onSelect} aria-label={`View ${s.english_name}`}>
    <div className="guide-card-photo"><SpeciesPhoto species={s}/>{s.toxicity==='toxic'&&<span className="toxicity-badge"><ShieldCheck size={15}/> Toxic species</span>}</div>
    <div className="species-card-copy"><h2>{s.english_name}</h2><em>{s.scientific_name}</em><p>{s.habitat}</p><span className="text-button">Explore species <ArrowRight size={17}/></span></div>
  </button><div className="card-photo-credit"><PhotoCredit species={s}/></div></article>;
}

function SpeciesFacts({species:s,onMore}:{species:Species;onMore:()=>void}) {
  const edibility=s.edibility==='reported_food_use' ? 'Reported food use' : s.edibility==='not_recommended' ? 'Do not eat' : s.edibility==='unknown' ? 'Not established' : words(s.edibility);
  const poisonous=s.toxicity==='toxic' ? 'Known toxic species' : s.toxicity==='diet_related_risk_reported' ? 'Diet-related poisoning reported' : s.toxicity==='unknown' ? 'Not established' : words(s.toxicity);
  return <section className="species-facts" aria-label="Identified species details">
    <div className="eyebrow">ABOUT THIS SPECIES</div>
    <h3>{s.english_name}</h3><p className="facts-scientific"><em>{s.scientific_name}</em></p>
    <dl className="facts-grid">
      <div><dt>Edible?</dt><dd>{edibility}</dd></div>
      <div className={s.toxicity==='toxic'||s.toxicity==='diet_related_risk_reported'?'facts-caution':undefined}><dt>Poisonous?</dt><dd>{poisonous}</dd></div>
      <div><dt>Where to look</dt><dd>{s.habitat}</dd></div>
      <div><dt>Where it occurs</dt><dd>{s.distribution}</dd></div>
    </dl>
    <p className="facts-note">Species reference only. Edibility does not establish the safety of the photographed crab.</p>
    <div className="facts-links"><button className="text-button" onClick={onMore}>Full species details <ArrowRight size={17}/></button>
      {s.sources.length>0 && <details><summary>Sources</summary>{s.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>}
    </div>
  </section>;
}

function SpeciesDetail({species:s,back}:{species:Species;back:()=>void}) {
  return <article className="catalog detail">
    <button className="text-button" onClick={back}><ChevronLeft size={18}/> Back to field guide</button>
    <div className="eyebrow">{words(s.identification_status)} · {s.last_reviewed?`Reviewed ${s.last_reviewed}`:'Expert review pending'}</div>
    <h1>{s.english_name}</h1><p className="latin">{s.scientific_name}</p>
    <SpeciesPhoto species={s} large/>
    <p className="safety"><ShieldCheck size={20}/>{s.safety_warning}</p>
    <div className="detail-grid"><section><h2>What to look for</h2><ul>{s.diagnostic_traits.map(t=><li key={t}>{t}</li>)}</ul>
      <h3>Life stage & limitations</h3><p>{s.life_stage_notes}</p><h3>Similar species</h3><p>{s.lookalikes.join(', ')||'Not yet reviewed'}</p>
      <h3>Names across our islands</h3>{s.names.map(n=><p key={n.name+n.region}><strong>{n.name}</strong> · {n.language} · {n.region}<br/><small>{n.scope} · {words(n.status)}</small></p>)}
    </section><section><h2>Species notes</h2><dl>{[['Habitat',s.habitat],['Distribution',s.distribution],['Typical size',s.size_range||'Not yet reviewed'],['Coloration',s.coloration||'Not yet reviewed'],['Edibility',words(s.edibility)],['Toxicity',words(s.toxicity)],['Venom evidence',words(s.venom_status)],['Conservation',words(s.conservation_status)],['Regulations',s.regulatory_notes],['Ecological / common uses',s.common_uses]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section></div>
    <h2>Sources & provenance</h2><p>Reference notes are provisional. Missing information awaits review.</p>
    {s.sources.map(source=><p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></p>)}
    <small>Knowledge revision: {s.revision} · Last expert review: {s.last_reviewed||'Pending'}</small>
  </article>;
}

type ReviewItem={id:string;note?:string;status:string;scientific_name?:string;provider?:string;license?:string;source_url?:string};
function Reviewer({onError}:{onError:(s:string)=>void}) {
  const [key,setKey]=useState('');const [items,setItems]=useState<ReviewItem[]>([]);const [loaded,setLoaded]=useState(false);const [kind,setKind]=useState('reviews');const [notes,setNotes]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
  async function load(){setBusy(true);try{const r=await api<{items:ReviewItem[]}>(`/admin/${kind}`,{},key);setItems(r.items);setLoaded(true);}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
  async function review(id:string,decision:string){setBusy(true);try{await api(`/admin/${kind}/${id}${kind==='dataset'?'/review':''}`,{method:'POST',body:JSON.stringify({decision,note:notes[id]||''})},key);setItems(items.filter(i=>i.id!==id));}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
  return <section className="catalog"><div className="eyebrow">RESTRICTED WORKSPACE</div><h1>Expert review</h1><p>Review decisions are audited. Accepted corrections never automatically become training labels.</p><form className="review-login" onSubmit={e=>{e.preventDefault();void load();}}><label>Reviewer key<input type="password" autoComplete="off" required value={key} onChange={e=>setKey(e.target.value)}/></label><label>Queue<select value={kind} onChange={e=>{setKind(e.target.value);setLoaded(false);setItems([]);}}><option value="reviews">Identification feedback</option><option value="dataset">Dataset items</option></select></label><button className="primary" disabled={busy}>Load queue</button><button className="secondary" type="button" onClick={()=>{setKey('');setItems([]);setLoaded(false);}}>Clear access</button></form>{loaded&&!items.length&&<p>No pending items.</p>}{items.map(i=><article className="review-item" key={i.id}><h2>{i.scientific_name||'Identification feedback'}</h2><p>{i.note||`${i.provider} · ${i.license}`}</p>{i.source_url&&<a href={i.source_url} target="_blank" rel="noreferrer">Inspect source ↗</a>}<p>Status: {words(i.status)}</p>{i.status==='pending'&&<><label>Review rationale (at least 10 characters)<textarea value={notes[i.id]||''} onChange={e=>setNotes({...notes,[i.id]:e.target.value})}/></label><div className="upload-actions">{['accepted','rejected','needs_expert'].map(d=><button className="secondary" key={d} disabled={busy||(notes[i.id]||'').length<10} onClick={()=>void review(i.id,d)}>{words(d)}</button>)}</div></>}</article>)}</section>;
}
