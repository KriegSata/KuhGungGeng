export type Source = {id:string; title:string; url:string};
export type Nutrition = {
  portion_g:number; basis:string; preparation:string; cholesterol_mg:number|null;
  cholesterol_daily_value_mg:number; high_percent_daily_value:number;
  nutrients:{name:string;value:number;unit:string}[];
  source:Source; threshold_source:Source; note:string;
};
export type Species = {
  id:string; scientific_name:string; english_name:string; revision:string;
  names:{name:string; language:string; region:string; scope:string; status:string}[];
  diagnostic_traits:string[]; habitat:string; distribution:string; size_range:string|null;
  coloration:string|null; life_stage_notes:string; lookalikes:string[];
  edibility:string; toxicity:string; venom_status:string; safety_warning:string;
  conservation_status:string; regulatory_notes:string; common_uses:string;
  identification_status:string; last_reviewed:string|null; sources:Source[];
  description?:string; nutrition?:Nutrition|null;
};
export type Prediction = {
  experimental?:boolean;
  id:string; upload_id:string; status:string; reason:string|null; model_version:string; created_at:number;
  candidates:{species_id:string; scientific_name:string; english_name?:string; names:Species['names']; confidence:number}[];
  ood:{detected:boolean|null; score:number|null; method:string}; quality_warnings:string[];
  safety_disclaimer:string; confidence_explanation:string; suggested_photos:string[]; photo_guidance:string;
};
