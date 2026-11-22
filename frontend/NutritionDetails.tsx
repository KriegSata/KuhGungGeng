import type {Species} from './types';

export default function NutritionDetails({species}:{species:Species}) {
  const nutrition=species.nutrition;
  if(species.toxicity==='toxic')return <section className="nutrition-section" aria-label="Nutrition reference"><h4>Nutrition</h4><p className="nutrition-unknown">Do not eat this toxic species. No food-use nutrition guidance is provided.</p></section>;
  if(!nutrition)return <section className="nutrition-section" aria-label="Nutrition reference"><h4>Nutrition & cholesterol</h4><p className="nutrition-unknown">Species-specific nutrient and cholesterol values have not been verified.</p></section>;
  const cholesterol=nutrition.cholesterol_mg;
  const percent=cholesterol===null?null:cholesterol/nutrition.cholesterol_daily_value_mg*100;
  const high=percent!==null&&percent>=nutrition.high_percent_daily_value;
  return <section className="nutrition-section" aria-label="Nutrition reference">
    <h4>Nutrition & cholesterol</h4><p className="nutrition-basis">Per {nutrition.basis} · {nutrition.preparation}</p>
    <div className={`nutrition-cholesterol${high?' high':''}`}>
      <div><span>Dietary cholesterol</span><strong>{cholesterol===null?'Not reported':`${cholesterol} mg`}</strong></div>
      {percent!==null ? <span className="cholesterol-label">{high?'High cholesterol':'Below the high threshold'} · {Math.round(percent)}% Daily Value</span> : <span className="cholesterol-label">Unknown level</span>}
    </div>
    <dl className="nutrient-grid">{nutrition.nutrients.map(n=><div key={n.name}><dt>{n.name}</dt><dd>{n.value} <span>{n.unit}</span></dd></div>)}</dl>
    <p className="nutrition-note">{nutrition.note}</p>
    <div className="nutrition-sources"><a href={nutrition.source.url} target="_blank" rel="noreferrer">{nutrition.source.title} ↗</a>
      <a href={nutrition.threshold_source.url} target="_blank" rel="noreferrer">High = at least {nutrition.high_percent_daily_value}% of the {nutrition.cholesterol_daily_value_mg} mg FDA Daily Value per displayed portion ↗</a>
    </div>
  </section>;
}
