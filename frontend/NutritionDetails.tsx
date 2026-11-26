import {Activity, ArrowUpRight, ChevronDown, CircleAlert, Droplet, Flame, Layers3} from 'lucide-react';
import type {Nutrient, NutritionSample, Source, Species} from './types';

const featuredNutrients = [
  {name: 'Energy', label: 'Calories', tone: 'energy', Icon: Flame},
  {name: 'Protein', label: 'Protein', tone: 'protein', Icon: Layers3},
  {name: 'Total fat', label: 'Total fat', tone: 'fat', Icon: Droplet},
];

export default function NutritionDetails({species, standalone = false}: {species: Species; standalone?: boolean}) {
  const nutrition = species.nutrition;
  const Title = standalone ? 'h2' : 'h3';
  const Subheading = standalone ? 'h3' : 'h4';
  const toxic = species.toxicity === 'toxic';
  const poisoningRisk = species.toxicity === 'diet_related_risk_reported';
  if (toxic || poisoningRisk) {
    const primaryId = toxic ? 'bfar-pia-2026' : 'seafdec-land-crab-risk';
    const source = species.sources?.find(item => item.id === primaryId);
    const additionalLinks = claimLinks(species, 'toxicity').filter(item => item.id !== primaryId);
    return <section className="nutrition-section" aria-label="Nutrition reference">
      <Title>Nutrition</Title>
      <div className="nutrition-warning" data-toxic={toxic}>
        <span className="nutrition-warning-icon"><CircleAlert size={23} aria-hidden="true"/></span>
        <div>
          <Subheading>{toxic ? 'Toxic species' : 'Poisoning risk reported'}</Subheading>
          <p>{toxic ? 'Do not eat this toxic species, even when cooked. BFAR reports that its toxins survive cooking.'
            : 'SEAFDEC detected toxins in mangrove land crab samples. How often people get sick or how severe illness can be remains unverified. BFAR Region 9 also uses the names “kuray” and “kagang” for toxic reef crabs. A local name alone cannot confirm the species.'}</p>
          {source && <a href={source.url} target="_blank" rel="noreferrer">{toxic ? 'Read the BFAR advisory' : 'Read the SEAFDEC report'} <ArrowUpRight size={15} aria-hidden="true"/></a>}
          <EvidenceLinks sources={additionalLinks}/>
        </div>
      </div>
    </section>;
  }
  if (!nutrition) return <section className="nutrition-section" aria-label="Nutrition reference">
    <Title>Nutrition</Title>
    {species.nutrition_evidence_note ? <div className="nutrition-evidence">
      <Subheading>Limited evidence for edible meat</Subheading>
      <p>{species.nutrition_evidence_note}</p>
      <p className="nutrition-unknown">Calories, protein, total fat, cholesterol and vitamin amounts are still unverified.</p>
      <EvidenceLinks sources={claimLinks(species, 'nutrition_evidence_note')}/>
    </div> : <p className="nutrition-unknown">Species-specific nutrient and cholesterol values have not been verified. Vitamin levels and nutritional benefits are also unverified.</p>}
  </section>;

  return <section className="nutrition-section" aria-label="Nutrition reference">
    <div className="nutrition-heading">
      <Title>Nutrition</Title>
      <div className="nutrition-serving"><span>Serving size</span><strong>{nutrition.basis}</strong></div>
    </div>
    <p className="nutrition-basis">{nutrition.preparation}{nutrition.country && <> <span aria-hidden="true">·</span> {nutrition.country}</>}</p>
    <SampleNutrients sample={nutrition} featured/>
    {!!nutrition.additional_samples?.length && <div className="nutrition-sample-list">
      <Subheading>Additional samples</Subheading>
      {nutrition.additional_samples.map(sample => <details className="nutrition-sample" key={`${sample.source.id}:${sample.preparation}`}>
        <summary>
          <span><strong>{sample.preparation}</strong><span>{sample.country && `${sample.country} · `}{sample.basis}</span></span>
          {(sample.cholesterol_mg !== null || sample.cholesterol_range_mg) && <span className="nutrition-sample-score">
            <span>Cholesterol</span><strong>{sample.cholesterol_range_mg?.join('–') ?? sample.cholesterol_mg} mg</strong>
          </span>}
          <ChevronDown size={19} aria-hidden="true"/>
        </summary>
        <div className="nutrition-sample-content"><SampleNutrients sample={sample}/></div>
      </details>)}
    </div>}
    {(nutrition.benefit || nutrition.consideration) && <div className="nutrition-takeaways">
      {nutrition.benefit && <div><Subheading>What you get</Subheading><p>{nutrition.benefit}</p></div>}
      {nutrition.consideration && <div><Subheading>What to watch for</Subheading><p>{nutrition.consideration}</p></div>}
    </div>}
  </section>;
}

function claimLinks(species: Species, claim: string) {
  const ids = species.claim_sources?.[claim] ?? [];
  return ids.map(id => species.sources?.find(item => item.id === id)).filter((item): item is Source => !!item);
}

function EvidenceLinks({sources}: {sources: Source[]}) {
  return sources.length ? <div className="nutrition-sources">{sources.map(source =>
    <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} <ArrowUpRight size={14} aria-hidden="true"/></a>
  )}</div> : null;
}

function SampleNutrients({sample, featured = false}: {sample: NutritionSample; featured?: boolean}) {
  const {cholesterol_mg: cholesterol, cholesterol_range_mg: range, vitamins, nutrients} = sample;

  const percent = cholesterol !== null ? cholesterol / sample.cholesterol_daily_value_mg * 100 : null;
  const high = percent !== null && percent >= sample.high_percent_daily_value;
  const otherNutrients = featured
    ? nutrients.filter(nutrient => !featuredNutrients.some(({name}) => name === nutrient.name))
    : nutrients;

  return <>
    <div className="nutrition-sources nutrition-sample-source">
      <a href={sample.source.url} target="_blank" rel="noreferrer">{sample.source.title} <ArrowUpRight size={14} aria-hidden="true"/></a>
    </div>
    {(featured || cholesterol !== null || range) && <dl className={`nutrition-cards${featured ? '' : ' nutrition-cards-supplement'}`}>
      {featured && featuredNutrients.map(({name, label, tone, Icon}) => {
        const nutrient = nutrients.find(item => item.name === name);
        return <div key={name} className={`nutrition-card nutrition-card-${tone}`}>
          <dt><span className="nutrition-icon"><Icon size={21} aria-hidden="true"/></span>{label}</dt>
          <dd className={nutrient ? 'nutrition-value' : 'nutrition-missing'}>
            {nutrient ? <>{nutrient.value} <span>{nutrient.unit}</span></> : 'Not reported'}
          </dd>
          {name === 'Energy' && sample.estimated_energy && <dd className="nutrition-estimate">Estimated</dd>}
        </div>;
      })}
      <div className={`nutrition-card nutrition-cholesterol${high ? ' high' : ''}`}>
        <dt><span className="nutrition-icon"><Activity size={21} aria-hidden="true"/></span>Cholesterol</dt>
        <dd className={cholesterol === null && !range ? 'nutrition-missing' : 'nutrition-value'}>
          {range ? <>{range.join('–')} <span>mg</span></>
            : cholesterol === null ? (sample.missing_cholesterol_label ?? 'Not reported') : <>{cholesterol} <span>mg</span></>}
        </dd>
        {percent !== null && <dd className="cholesterol-label">
          {high ? 'High cholesterol' : 'Below the high threshold'} · {Math.round(percent)}% Daily Value
        </dd>}
      </div>
    </dl>}
    {!!otherNutrients.length && <NutrientGrid label="Other nutrients" values={otherNutrients}/>}
    {(featured || !!vitamins?.length || sample.vitamin_note) && <div className="nutrition-vitamins">
      <p className="nutrition-group-label">Vitamins</p>
      {!!vitamins?.length && <NutrientGrid label="Vitamins" values={vitamins}/>}
      {sample.vitamin_note && <p className="nutrition-note">{sample.vitamin_note}</p>}
      {!vitamins?.length && !sample.vitamin_note && <p className="nutrition-unknown">No verified vitamin values are available for this sample.</p>}
    </div>}
    <p className="nutrition-note">{sample.note}</p>
    {percent !== null && <div className="nutrition-sources">
      <a href={sample.threshold_source.url} target="_blank" rel="noreferrer">U.S. FDA Daily Value and high threshold <ArrowUpRight size={14} aria-hidden="true"/></a>
    </div>}
  </>;
}

function NutrientGrid({label, values}: {label: string; values: Nutrient[]}) {
  return <dl className="nutrient-grid" aria-label={label}>
    {values.map(nutrient => <div key={nutrient.name}>
      <dt>{nutrient.name}</dt><dd>{nutrient.value} <span>{nutrient.unit}</span></dd>
    </div>)}
  </dl>;
}
