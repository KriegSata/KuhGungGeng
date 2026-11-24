import {afterEach,describe,it,expect} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import NutritionDetails from './NutritionDetails';
import type {Nutrition,Species} from './types';

afterEach(cleanup);
const nutrition:Nutrition={portion_g:100,basis:'100 g edible portion',preparation:'Boiled meat',cholesterol_mg:118,cholesterol_daily_value_mg:300,high_percent_daily_value:20,nutrients:[{name:'Protein',value:19.4,unit:'g'}],source:{id:'fnri',title:'DOST-FNRI',url:'https://i.fnri.dost.gov.ph/'},threshold_source:{id:'fda',title:'FDA',url:'https://www.fda.gov/'},note:'Food reference only.'};
const species=(n:Nutrition|null,toxicity='unknown')=>({nutrition:n,toxicity} as Species);

describe('dietary cholesterol display',()=>{
 it.each([[59.9,false],[60,true],[118,true]])('uses the 20%% daily value boundary for %s mg', (value,high)=>{
  const {container}=render(<NutritionDetails species={species({...nutrition,cholesterol_mg:value})}/>);
  expect(Boolean(container.querySelector('.nutrition-cholesterol.high'))).toBe(high);
  expect(screen.getByText(high?'High cholesterol · '+Math.round(value/300*100)+'% Daily Value':'Below the high threshold · '+Math.round(value/300*100)+'% Daily Value')).toBeInTheDocument();
 });
 it('does not turn missing cholesterol into zero or a low claim',()=>{
  const {container}=render(<NutritionDetails species={species({...nutrition,cholesterol_mg:null})}/>);
  const card=screen.getByText('Cholesterol').parentElement!;
  expect(within(card).getByText('Not reported')).toBeInTheDocument();
  expect(screen.getByText('Calories').parentElement).toHaveTextContent('Not reported');
  expect(container.querySelector('.high')).toBeNull();
  expect(screen.queryByText(/Below the high threshold/)).not.toBeInTheDocument();
 });
 it('shows the serving size ahead of the featured cards and keeps measured zeroes',()=>{
  render(<NutritionDetails species={species({...nutrition,nutrients:[
    {name:'Energy',value:98,unit:'kcal'},
    {name:'Total fat',value:0,unit:'g'},
    ...nutrition.nutrients,
    {name:'Sodium',value:494,unit:'mg'},
  ]})} standalone/>);
  const serving=screen.getByText('100 g edible portion');
  const calories=screen.getByText('Calories');
  expect(serving.compareDocumentPosition(calories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(calories.parentElement).toHaveTextContent('98 kcal');
  expect(screen.getByText('Protein').parentElement).toHaveTextContent('19.4 g');
  expect(screen.getByText('Total fat').parentElement).toHaveTextContent('0 g');
  expect(screen.getByText('Sodium').parentElement).toHaveTextContent('494 mg');
 });
 it('does not borrow another species nutrition profile',()=>{
  render(<NutritionDetails species={species(null)}/>);
  expect(screen.getByText(/Species-specific nutrient and cholesterol values have not been verified/)).toBeInTheDocument();
 });
 it('does not show food-use guidance for toxic crabs',()=>{
  render(<NutritionDetails species={species(nutrition,'toxic')}/>);
  expect(screen.getByText(/Do not eat this toxic species/)).toBeInTheDocument();
  expect(screen.queryByText('118 mg')).not.toBeInTheDocument();
 });
});
