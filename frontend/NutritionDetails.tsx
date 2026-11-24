import {Activity, Droplet, Flame, Layers3} from 'lucide-react';
import type {Species} from './types';

const featuredNutrients = [
  {name: 'Energy', label: 'Calories', tone: 'energy', Icon: Flame},
  {name: 'Protein', label: 'Protein', tone: 'protein', Icon: Layers3},
  {name: 'Total fat', label: 'Total fat', tone: 'fat', Icon: Droplet},
];

export default function NutritionDetails({species, standalone = false}: {species: Species; standalone?: boolean}) {
  const nutrition = species.nutrition;
  const Title = standalone ? 'h2' : 'h3';
  const unavailable = {
    toxic: 'Do not eat this toxic species.',
    diet_related_risk_reported: 'Poisoning has been reported for this species.',
  };
  if (species.toxicity === 'toxic' || species.toxicity === 'diet_related_risk_reported') {
    return <section className="nutrition-section" aria-label="Nutrition reference">
      <Title>Nutrition</Title><p className="nutrition-unknown">{unavailable[species.toxicity]}</p>
    </section>;
  }
  if (!nutrition) return <section className="nutrition-section" aria-label="Nutrition reference">
    <Title>Nutrition</Title><p className="nutrition-unknown">Species-specific nutrient and cholesterol values have not been verified.</p>
  </section>;

  const cholesterol = nutrition.cholesterol_mg;
  const percent = cholesterol === null ? null : cholesterol / nutrition.cholesterol_daily_value_mg * 100;
  const high = percent !== null && percent >= nutrition.high_percent_daily_value;
  const otherNutrients = nutrition.nutrients.filter(nutrient => !featuredNutrients.some(({name}) => name === nutrient.name));

  return <section className="nutrition-section" aria-label="Nutrition reference">
    <div className="nutrition-heading">
      <Title>Nutrition</Title>
      <div className="nutrition-serving">
        <span>Serving size</span>
        <strong>{nutrition.basis}</strong>
      </div>
    </div>
    <p className="nutrition-basis">{nutrition.preparation}</p>
    <dl className="nutrition-cards">
      {featuredNutrients.map(({name, label, tone, Icon}) => {
        const nutrient = nutrition.nutrients.find(item => item.name === name);
        return <div key={name} className={`nutrition-card nutrition-card-${tone}`}>
          <dt><span className="nutrition-icon"><Icon size={21} aria-hidden="true"/></span>{label}</dt>
          <dd className={nutrient ? 'nutrition-value' : 'nutrition-missing'}>
            {nutrient ? <>{nutrient.value} <span>{nutrient.unit}</span></> : 'Not reported'}
          </dd>
        </div>;
      })}
      <div className={`nutrition-card nutrition-cholesterol${high ? ' high' : ''}`}>
        <dt><span className="nutrition-icon"><Activity size={21} aria-hidden="true"/></span>Cholesterol</dt>
        <dd className={cholesterol === null ? 'nutrition-missing' : 'nutrition-value'}>
          {cholesterol === null ? 'Not reported' : <>{cholesterol} <span>mg</span></>}
        </dd>
        {percent !== null && <dd className="cholesterol-label">
          {high ? 'High cholesterol' : 'Below the high threshold'} · {Math.round(percent)}% Daily Value
        </dd>}
      </div>
    </dl>
    {!!otherNutrients.length && <dl className="nutrient-grid" aria-label="Other nutrients">
      {otherNutrients.map(nutrient => <div key={nutrient.name}>
        <dt>{nutrient.name}</dt><dd>{nutrient.value} <span>{nutrient.unit}</span></dd>
      </div>)}
    </dl>}
    <p className="nutrition-note">{nutrition.note}</p>
    {!standalone && <div className="nutrition-sources">
      <a href={nutrition.source.url} target="_blank" rel="noreferrer">{nutrition.source.title} ↗</a>
      {percent !== null && <a href={nutrition.threshold_source.url} target="_blank" rel="noreferrer">High = at least {nutrition.high_percent_daily_value}% of the {nutrition.cholesterol_daily_value_mg} mg FDA Daily Value per displayed portion ↗</a>}
    </div>}
  </section>;
}
