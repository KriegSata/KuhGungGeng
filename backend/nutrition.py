"""Food-reference measurements; never inferred from a photograph."""

FDA_DV = dict(id='fda-daily-value', title='FDA: Daily Values and the 20% high guideline',
              url='https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels')

IFCT = 'https://nin.res.in/ebooks/IFCT2017_16122024.pdf'
FAO_UFISH = 'https://www.fao.org/food-composition/tables-and-databases/detail/f-food-composition-tables/en'
MATHEW = 'https://doi.org/10.1016/S0308-8146(99)00050-3'
STUDY_LIMIT = 'This older method can include other sterols in its cholesterol estimate.'
SAMPLE_NOTE = 'Nutrient levels can vary with the portion and preparation.'
ULLAH_ORANGE = dict(id='ullah-orange-mud', title='Ullah et al.: Orange mud crab, table 1 and figure 2 (2020)',
                   url='https://journals.ekb.eg/article_129349_4ef58862c556eff7599fa576bdcc0bab.pdf#page=4')
UMER_CRABS_URL = 'https://doi.org/10.1016/j.jfca.2021.103877'


def _measurements(values):
    return [dict(name=name, value=value, unit=unit) for name, value, unit in values]


def _sample(profile):
    return {'portion_g': 100, 'basis': '100 g edible portion', **profile,
            'nutrients': _measurements(profile.get('nutrients', [])),
            'vitamins': _measurements(profile.get('vitamins', [])),
            'cholesterol_daily_value_mg': 300, 'high_percent_daily_value': 20,
            'threshold_source': FDA_DV, 'note': profile.get('note', SAMPLE_NOTE)}


def _thai_selenium(value, *, moisture=None):
    nutrients = [('Selenium', value, 'µg')]
    if moisture is not None:
        nutrients.append(('Moisture', moisture, 'g'))
    return dict(preparation='Boiled edible portion, selenium study', country='Thailand', cholesterol_mg=None,
                nutrients=nutrients,
                source=dict(id='momen-selenium-2025', title='Momen et al.: Selenium in Thai seafood, table 2 (2025)',
                            url='https://pmc.ncbi.nlm.nih.gov/articles/PMC12346270/#foods-14-02700-t002'))


ADDITIONAL_SAMPLES = {
    'portunus-pelagicus': [dict(
        preparation='Crab fat (aligue). Cooking status unspecified.', country='Philippines', cholesterol_mg=None,
        nutrients=[('Energy', 86, 'kcal'), ('Protein', 11.5, 'g'), ('Total fat', 4.4, 'g'), ('Sodium', 644, 'mg')],
        vitamins=[('Vitamin A', 220, 'µg RAE'), ('Vitamin B1', .09, 'mg'), ('Vitamin B2', .49, 'mg'),
                  ('Niacin (B3)', 1.1, 'mg'), ('Vitamin C', 0, 'mg')],
        source=dict(id='fnri-G036', title='DOST-FNRI: Blue swimming crab, aligue (G036)',
                    url='https://i.fnri.dost.gov.ph/fct/library/report/4016')),
        dict(preparation='Meat without crab fat. Cooking status unspecified.', country='Philippines', cholesterol_mg=None,
             nutrients=[('Energy', 93, 'kcal'), ('Protein', 19.9, 'g'), ('Total fat', .5, 'g'), ('Carbohydrate', 2.2, 'g'),
                        ('Saturated fat', .10, 'g'), ('Calcium', 134, 'mg'), ('Phosphorus', 180, 'mg'), ('Sodium', 342, 'mg')],
             vitamins=[('Vitamin A', 1, 'µg RAE'), ('Vitamin B1', .04, 'mg'), ('Vitamin B2', .07, 'mg'),
                       ('Niacin (B3)', 3.9, 'mg'), ('Vitamin C', 0, 'mg')],
             source=dict(id='fnri-G037', title='DOST-FNRI: Blue swimming crab meat (G037)',
                         url='https://i.fnri.dost.gov.ph/fct/library/report/4017')),
        dict(preparation='Raw body and claw flesh, compiled food-table record', cholesterol_mg=133,
             nutrients=[('Energy', 87.5, 'kcal'), ('Protein', 19.88, 'g'), ('Total fat', .89, 'g'),
                        ('Calcium', 120.33, 'mg'), ('Copper', .6, 'mg'), ('Potassium', 405, 'mg'),
                        ('Phosphorus', 258.33, 'mg'), ('Magnesium', 40, 'mg'), ('Sodium', 302.5, 'mg'), ('Zinc', 2.45, 'mg')],
             vitamins=[('Vitamin B1', .04, 'mg'), ('Vitamin B2', .07, 'mg'), ('Niacin (B3)', 3.9, 'mg')],
             note='FAO combined multiple records. Cholesterol values underlying the average ranged from 61 to 284 mg per 100 g.',
             source=dict(id='fao-ufish-092014', title='FAO/INFOODS: Blue swimming crab, raw (092014)', url=FAO_UFISH)),
        _thai_selenium(42.3)],
    'scylla-serrata': [dict(
        preparation='Raw edible meat, pooled sample from Maningrida', country='Australia', cholesterol_mg=None,
        nutrients=[('Energy', 67, 'kcal'), ('Protein', 15.6, 'g'), ('Total fat', .3, 'g'), ('Calcium', 105, 'mg'),
                   ('Iron', .8, 'mg'), ('Magnesium', 41, 'mg'), ('Phosphorus', 135, 'mg'), ('Potassium', 254, 'mg'),
                   ('Selenium', 120, 'µg'), ('Iodine', 21, 'µg'), ('Zinc', 4.9, 'mg'), ('Sodium', 352, 'mg')],
        vitamins=[('Vitamin B12', 1.08, 'µg'), ('Vitamin D3', 2.9, 'µg'), ('Vitamin B2', .70, 'mg'),
                  ('Niacin (B3)', 1.2, 'mg'), ('Vitamin B6', .25, 'mg'), ('Vitamin E', .4, 'mg')],
        source=dict(id='frdc-mud-crab', title='FRDC: Maningrida mud crab nutrient analysis',
                    url='https://www.frdc.com.au/sites/default/files/products/2019-143-DLD.pdf#page=51')),
        dict(preparation='Claw meat. Cooking status unspecified.', country='India', cholesterol_mg=51.5,
             source=dict(id='mathew-1999', title='Mathew et al.: Cholesterol in Indian fish and shellfish (1999)',
                         url=MATHEW), note=STUDY_LIMIT),
        dict(preparation='Other edible meat sample. Cooking status unspecified.', country='India', cholesterol_mg=54.8,
             source=dict(id='mathew-1999', title='Mathew et al.: Cholesterol in Indian fish and shellfish (1999)',
                         url=MATHEW), note=STUDY_LIMIT),
        dict(preparation='Meat without crab fat. Cooking status unspecified.', country='Philippines', cholesterol_mg=None,
             nutrients=[('Energy', 103, 'kcal'), ('Protein', 18.5, 'g'), ('Total fat', 3.2, 'g'), ('Carbohydrate', 0, 'g'),
                        ('Sodium', 247, 'mg')],
             vitamins=[('Vitamin A', 210, 'µg RAE'), ('Vitamin B1', .05, 'mg'), ('Vitamin B2', .25, 'mg'),
                       ('Niacin (B3)', 2.1, 'mg'), ('Vitamin C', 0, 'mg')],
             source=dict(id='fnri-G040', title='DOST-FNRI: Mud/mangrove crab meat (G040)',
                         url='https://i.fnri.dost.gov.ph/fct/library/report/4020')),
        dict(preparation='Crab fat (aligue). Cooking status unspecified.', country='Philippines', cholesterol_mg=None,
             nutrients=[('Energy', 188, 'kcal'), ('Protein', 26, 'g'), ('Total fat', 5.6, 'g'), ('Carbohydrate', 8.5, 'g'),
                        ('Sodium', 1163, 'mg')],
             vitamins=[('Vitamin A', 4245, 'µg RAE'), ('Vitamin B1', .79, 'mg'), ('Vitamin B2', .92, 'mg'),
                       ('Niacin (B3)', 1.3, 'mg'), ('Vitamin C', 0, 'mg')],
             note='This record describes crab fat. The boiled-meat sample has a different vitamin A and sodium content.',
             source=dict(id='fnri-G039', title='DOST-FNRI: Mud/mangrove crab, aligue (G039)',
                         url='https://i.fnri.dost.gov.ph/fct/library/report/4019')),
        dict(preparation='Raw body and claw flesh, compiled food-table record', cholesterol_mg=108.67,
             nutrients=[('Energy', 78.3, 'kcal'), ('Protein', 14.7, 'g'), ('Total fat', 1.67, 'g'),
                        ('Available carbohydrate', 1.14, 'g'), ('Sodium', 231.45, 'mg'), ('Zinc', 3.25, 'mg'),
                        ('Selenium', 54.6, 'µg'), ('EPA', 180, 'mg'), ('DHA', 160, 'mg')],
             vitamins=[('Vitamin B1', .033, 'mg'), ('Vitamin B2', .217, 'mg'), ('Niacin (B3)', 3.33, 'mg'),
                       ('Alpha-tocopherol (vitamin E)', 2.85, 'mg')],
             note='FAO combined fresh and frozen records. Cholesterol values underlying the average ranged from 65 to 142 mg per 100 g.',
             source=dict(id='fao-ufish-092015', title='FAO/INFOODS: Giant mud crab, raw (092015)', url=FAO_UFISH)),
        dict(preparation='Whole soft-shell crab, raw and frozen (ARO brand)', country='Thailand', cholesterol_mg=64,
             basis='100 g whole soft-shell crab',
             nutrients=[('Energy', 51, 'kcal'), ('Protein', 9.17, 'g'), ('Total fat', .85, 'g'),
                        ('Calcium', 307, 'mg'), ('Magnesium', 54, 'mg'), ('Sodium', 351, 'mg'),
                        ('Potassium', 266, 'mg'), ('Iron', .59, 'mg'), ('Copper', 1.23, 'mg'), ('Zinc', 2.35, 'mg')],
             vitamins=[('Vitamin A', 5, 'µg RAE'), ('Vitamin D (D2 + D3)', 2.10, 'µg'),
                       ('Alpha-tocopherol (vitamin E)', 1.52, 'mg'), ('Vitamin B1', .46, 'mg'), ('Vitamin B2', .48, 'mg'),
                       ('Niacin (B3)', 1.03, 'mg'), ('Vitamin B6', .04, 'mg'), ('Folate (B9)', 11, 'µg'),
                       ('Vitamin B12', 7.50, 'µg')],
             note='This record describes the whole soft-shell product. The Philippine boiled-meat record uses meat without crab fat.',
             source=dict(id='thai-fcd-2030', title='Mahidol University: Thai Food Composition Database, soft-shell mud crab (2030)',
                         url='https://inmu.mahidol.ac.th/thaifcd/foodsearch/food_name_result_nutrient?mode=food_name_result_nutrient&food_id=2030&dbcode=STD&nutrient_name=&value_per_servingsize=100')),
        _thai_selenium(33.6, moisture=84.2)],
    'scylla-olivacea': [dict(
        preparation='Farmed crab meat, four study groups. Cooking status unspecified.', country='Indonesia',
        cholesterol_mg=None, cholesterol_range_mg=[90.33, 100.33],
        source=dict(id='karim-2021', title='Karim et al.: Orange mud crab cholesterol, table 1 (2021)',
                    url='https://doi.org/10.23880/izab-16000265'),
        note='Farmed in South Sulawesi. The mean of the four group averages is 94.67 mg per 100 g. Differences between groups were statistically inconclusive.'),
        dict(preparation='Raw whole-body sample from female crabs', basis='100 g whole-body sample',
             country='Bangladesh', cholesterol_mg=None,
             nutrients=[('Energy', 102.5, 'kcal'), ('Protein', 19.10, 'g'), ('Total fat', 1.43, 'g'),
                        ('Carbohydrate', 3.30, 'g'), ('Moisture', 74.96, 'g'), ('Ash', 1.20, 'g')],
             note='Figure 2 gives 102.5 kcal for the whole-body sample. The authors calculated energy from protein, carbohydrate and fat.',
             source=ULLAH_ORANGE),
        dict(preparation='Raw body and claw meat from wild female crabs', country='Bangladesh', cholesterol_mg=None,
             nutrients=[('Energy', 79.33, 'kcal'), ('Protein', 12.63, 'g'), ('Total fat', 1.30, 'g'),
                        ('Carbohydrate', 2.82, 'g'), ('Moisture', 77.06, 'g'), ('Ash', 2.93, 'g')],
             note='The Ganges–Brahmaputra Delta study reports these values on a wet-weight basis. It also flagged elevated contaminants at the study sites.',
             source=dict(id='ferdousi-orange-mud', title='Ferdousi et al.: Wild orange mud crab meat, table 2 (2025)',
                         url='https://researchportal.murdoch.edu.au/esploro/outputs/journalArticle/Nutritional-prospects-and-heavy-metal-risks/991005703768907891'))],
    'scylla-tranquebarica': [dict(
        preparation='Raw body meat from male crabs', country='India', cholesterol_mg=None,
        nutrients=[('Protein', 15.63, 'g'), ('Total fat', .65, 'g')],
        source=dict(id='sreelakshmi-purple-mud', title='Sreelakshmi et al.: Purple mud crab, table 2 (2016)',
                    url='https://epubs.icar.org.in/index.php/IJF/article/download/34511/24689/488419#page=2'))],
    'portunus-sanguinolentus': [dict(
        preparation='Raw meat from male crabs', country='Bangladesh', cholesterol_mg=None,
        nutrients=[('Protein', 14.02, 'g'), ('Total fat', 2.78, 'g'), ('Sodium', 220.71, 'mg'),
                   ('Potassium', 198.70, 'mg'), ('Calcium', 46.92, 'mg'), ('Iron', 4.22, 'mg'),
                   ('Phosphorus', 62.10, 'mg')],
        source=dict(id='al-mamun-three-spot', title='Al Mamun et al.: Three-spot swimming crab, tables 1–2 (2024)',
                    url='https://doi.org/10.1016/j.jafr.2024.100972')),
        dict(preparation='Crab meat. Cooking status unspecified.', country='Pakistan', cholesterol_mg=None,
             nutrients=[('Protein', 14.2, 'g'), ('Arginine', 9.98, 'mg')],
             vitamin_note='The study reports vitamin C in all four crab species tested. The public abstract gives no amount for three-spot swimming crab.',
             source=dict(id='umer-three-spot', title='Umer et al.: Three-spot swimming crab composition (2021)',
                         url=UMER_CRABS_URL))],
    'charybdis-feriata': [dict(
        preparation='Edible meat, two samples. Cooking status unspecified.', country='India',
        cholesterol_mg=None, cholesterol_range_mg=[54.2, 56.5],
        source=dict(id='mathew-1999', title='Mathew et al.: Cholesterol in Indian fish and shellfish (1999)', url=MATHEW),
        note=f'{STUDY_LIMIT} The May sample had 0.70 g fat and an estimated 56.5 mg cholesterol. The March sample had 0.76 g fat and an estimated 54.2 mg cholesterol. Amounts are per 100 g. The paper uses the older name Charybdis cruciata.'),
        dict(preparation='Raw body and claw meat, combined', country='India', cholesterol_mg=None,
             nutrients=[('Protein', 15.5, 'g'), ('Total fat', 2.3, 'g'), ('Moisture', 81.7, 'g'), ('Ash', 1.5, 'g')],
             note='The study measured six samples and uses the older scientific name Charybdis cruciata.',
             source=dict(id='sachindra-crucifix', title='Sachindra: Crucifix crab meat, table 1.8 (2003)',
                         url='https://ir.cftri.res.in/150/1/1868_Sachindra.pdf#page=106')),
        dict(preparation='Raw pooled muscle from adult females, Zhoushan', country='China', cholesterol_mg=None,
             nutrients=[('Protein', 18.07, 'g'), ('Total fat', .84, 'g'), ('Essential amino acids', 5.66, 'g')],
             note='Wet-weight estimates calculated from the study’s dry-weight means and average moisture.',
             source=dict(id='lu-crucifix', title='Lu et al.: Crucifix crab muscle, tables 2–3 (2014)',
                         url='https://ccsenet.org/journal/index.php/jfr/article/download/33425/19250')),
        _thai_selenium(56.9)],
}


PROS_AND_CONS = {
    'portunus-pelagicus': (
        'The Philippine boiled meat sample provides 19.4 g protein with 0.24 g saturated fat. It also provides calcium and B vitamins.',
        'The same sample provides 118 mg cholesterol and 494 mg sodium. The separate aligue sample has more fat and sodium.'),
    'scylla-serrata': (
        'The Philippine boiled meat sample provides 17.6 g protein, 279 mg calcium and vitamin B2. The Australian raw sample provides B12 and D3.',
        'The Philippine boiled sample contains 326 mg sodium. Its DOST-FNRI record gives no cholesterol value. FAO reports 108.67 mg for a separate raw-meat record.'),
    'ranina-ranina': (
        'The Taiwanese sample provides 16.6 g protein and 3.64 µg vitamin B12, which supports nerve function and red blood cell formation.',
        'The same raw sample contains 54 mg cholesterol and 343 mg sodium. Preparation can change the amount in a serving.'),
    'scylla-olivacea': (
        'The Bangladesh raw breast-meat sample provides 19.24 g protein.',
        'An Indonesian farming study measured roughly 90–100 mg cholesterol across group averages. Vitamin measurements remain unverified.'),
    'scylla-tranquebarica': (
        'The Indian food table sample provides 10 g protein and several vitamins. A separate male body-meat sample provides 15.63 g protein.',
        'The cholesterol measurement represents one sampling region. Values for Philippine cooked meat remain unverified.'),
    'portunus-sanguinolentus': (
        'The Indian sample provides 15.36 g protein, several B vitamins and selenium. A separate Bangladesh sample provides protein and iron.',
        'The Indian sample contains 313 mg sodium. The Bangladesh sample contains about 221 mg sodium.'),
    'charybdis-feriata': (
        'The Pakistan meat sample provides 15.1 g protein. The study of boiled Thai meat reports 56.9 µg selenium.',
        'Cholesterol estimates come from an older study with a method limitation. The exact vitamin amounts for this species remain unverified.'),
}


def nutrition_for(identity):
    profiles = {
        'portunus-pelagicus': dict(
            preparation='Boiled meat, without crab fat', country='Philippines', cholesterol_mg=118,
            vitamin_note='Vitamins B5, B6, folate (B9), B12, D, E and K are not reported for this sample.',
            vitamins=[('Vitamin A', 1, 'µg RAE'), ('Vitamin B1', .05, 'mg'), ('Vitamin B2', .24, 'mg'),
                      ('Niacin (B3)', 2.4, 'mg'), ('Vitamin C', 0, 'mg')],
            nutrients=[('Energy', 98, 'kcal'), ('Protein', 19.4, 'g'), ('Total fat', .9, 'g'),
                       ('Carbohydrate', 3.1, 'g'), ('Saturated fat', .24, 'g'),
                       ('Calcium', 281, 'mg'), ('Phosphorus', 265, 'mg'), ('Iron', 2, 'mg'), ('Sodium', 494, 'mg')],
            source=dict(id='fnri-G038', title='DOST-FNRI: Blue swimming crab, boiled (G038)',
                        url='https://i.fnri.dost.gov.ph/fct/library/report/4018')),
        'scylla-serrata': dict(
            preparation='Boiled meat, without crab fat', country='Philippines', cholesterol_mg=None,
            missing_cholesterol_label='Not reported in PhilFCT',
            vitamins=[('Vitamin A', 60, 'µg RAE'), ('Vitamin B1', .02, 'mg'), ('Vitamin B2', .36, 'mg'),
                      ('Niacin (B3)', 1.6, 'mg'), ('Vitamin C', 0, 'mg')],
            nutrients=[('Energy', 88, 'kcal'), ('Protein', 17.6, 'g'), ('Total fat', 1.9, 'g'),
                       ('Carbohydrate', 0, 'g'), ('Saturated fat', .52, 'g'),
                       ('Calcium', 279, 'mg'), ('Phosphorus', 184, 'mg'), ('Iron', 1.7, 'mg'), ('Sodium', 326, 'mg'),
                       ('Moisture', 78.2, 'g'), ('Ash', 2.3, 'g')],
            source=dict(id='fnri-G041', title='DOST-FNRI: Mud/mangrove crab, boiled (G041)',
                        url='https://i.fnri.dost.gov.ph/fct/library/report/4021')),
        'ranina-ranina': dict(
            preparation='Raw edible parts, combined sample', country='Taiwan', cholesterol_mg=54,
            vitamin_note='Vitamins B5, D and K are not reported for this sample.',
            vitamins=[('Vitamin A', 1, 'µg RE'), ('Vitamin B1', .03, 'mg'), ('Vitamin B2', .04, 'mg'),
                      ('Niacin (B3)', 3.29, 'mg'), ('Vitamin B6', .21, 'mg'), ('Folate (B9)', 7, 'µg'),
                      ('Vitamin B12', 3.64, 'µg'), ('Vitamin C', 5.5, 'mg'), ('Vitamin E', 1.36, 'mg')],
            nutrients=[('Energy', 72, 'kcal'), ('Protein', 16.6, 'g'), ('Total fat', .1, 'g'),
                       ('Carbohydrate', 2.8, 'g'), ('Calcium', 178, 'mg'), ('Iron', .9, 'mg'), ('Zinc', 1.6, 'mg'),
                       ('Magnesium', 74, 'mg'), ('Phosphorus', 119, 'mg'), ('Potassium', 303, 'mg'),
                       ('Sodium', 343, 'mg'), ('EPA', 19, 'mg'), ('DHA', 19, 'mg')],
            source=dict(id='tfda-spanner', title='Taiwan FDA food composition database: Spanner crab (J2500201)',
                        url='https://data.gov.tw/en/datasets/8543')),
        'scylla-olivacea': dict(
            preparation='Raw breast meat from female crabs', country='Bangladesh',
            cholesterol_mg=None,
            nutrients=[('Protein', 19.24, 'g'), ('Total fat', 1.46, 'g'), ('Carbohydrate', 2.89, 'g'),
                       ('Energy', 101.7, 'kcal'), ('Moisture', 74.94, 'g'), ('Ash', 1.46, 'g')],
            estimated_energy=True,
            vitamin_note='Not reported for this sample.',
            note='Calories are estimated from the reported protein, fat and carbohydrate using the study’s energy factors.',
            source=ULLAH_ORANGE),
        'scylla-tranquebarica': dict(
            preparation='Raw edible portion, one sampling region', country='India', cholesterol_mg=7.10,
            vitamin_note='Vitamins B12 and C are not reported for this sample.',
            nutrients=[('Energy', 45, 'kcal'), ('Protein', 10, 'g'), ('Total fat', .55, 'g'), ('Calcium', 201, 'mg'),
                       ('Copper', 1.23, 'mg'), ('Iron', .87, 'mg'), ('Magnesium', 46.92, 'mg'),
                       ('Phosphorus', 153, 'mg'), ('Potassium', 227, 'mg'), ('Selenium', 51.97, 'µg'),
                       ('Sodium', 305, 'mg'), ('Zinc', 3.30, 'mg')],
            vitamins=[('Vitamin A (retinol)', 8.33, 'µg'), ('Vitamin B1', .06, 'mg'), ('Vitamin B2', .14, 'mg'),
                      ('Niacin (B3)', .60, 'mg'), ('Vitamin B5', 1.30, 'mg'), ('Vitamin B6', .18, 'mg'),
                      ('Folate (B9)', 13.83, 'µg'), ('Vitamin D3', .94, 'µg'), ('Vitamin E', 2.34, 'mg α-TE'),
                      ('Vitamin K2', 1.03, 'µg')],
            source=dict(id='icmr-q005', title='ICMR–NIN: Indian Food Composition Tables (Q005)', url=IFCT)),
        'portunus-sanguinolentus': dict(
            preparation='Raw edible portion, one sampling region', country='India', cholesterol_mg=23.18,
            vitamin_note='Vitamins B12 and C are not reported for this sample. See the separate Pakistan study for a vitamin C finding.',
            nutrients=[('Energy', 68, 'kcal'), ('Protein', 15.36, 'g'), ('Total fat', .60, 'g'), ('Calcium', 333, 'mg'),
                       ('Copper', .84, 'mg'), ('Iron', .98, 'mg'), ('Magnesium', 80.04, 'mg'),
                       ('Phosphorus', 193, 'mg'), ('Potassium', 252, 'mg'), ('Selenium', 37.69, 'µg'),
                       ('Sodium', 313, 'mg'), ('Zinc', 3.07, 'mg')],
            vitamins=[('Vitamin A (retinol)', 5.02, 'µg'), ('Vitamin B1', .05, 'mg'), ('Vitamin B2', .06, 'mg'),
                      ('Niacin (B3)', .97, 'mg'), ('Vitamin B5', 1.53, 'mg'), ('Vitamin B6', .12, 'mg'),
                      ('Folate (B9)', 7.74, 'µg'), ('Vitamin D3', .63, 'µg'), ('Vitamin E', 2.06, 'mg α-TE'),
                      ('Vitamin K2', 1.11, 'µg')],
            source=dict(id='icmr-q002', title='ICMR–NIN: Indian Food Composition Tables (Q002)', url=IFCT)),
        'charybdis-feriata': dict(
            preparation='Crab meat, wet weight. Cooking status unspecified.', country='Pakistan',
            cholesterol_mg=None,
            nutrients=[('Energy', 65.5, 'kcal'), ('Protein', 15.1, 'g'), ('Moisture', 80, 'g')],
            vitamin_note='The study reports thiamine (B1), niacin (B3) and vitamin C in all four crabs it analyzed. The public abstract gives no amounts for crucifix crab specifically.',
            note='Exact fat and cholesterol values for this sample remain unverified. Additional samples include measured fat and cholesterol from separate Indian studies.',
            source=dict(id='umer-crucifix', title='Umer et al.: Crucifix crab composition (2021)',
                        url=UMER_CRABS_URL)),
    }
    if identity not in profiles:
        return None
    benefit, consideration = PROS_AND_CONS[identity]
    return {**_sample(profiles[identity]), 'benefit': benefit, 'consideration': consideration,
            'additional_samples': [_sample(sample) for sample in ADDITIONAL_SAMPLES.get(identity, [])]}
