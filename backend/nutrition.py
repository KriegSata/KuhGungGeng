"""Food-reference measurements; never inferred from a photograph."""

FDA_DV = dict(id='fda-daily-value', title='FDA: Daily Values and the 20% high guideline',
              url='https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels')


def nutrition_for(identity):
    profiles = {
        'portunus-pelagicus': dict(
            preparation='Boiled meat, without crab fat', cholesterol_mg=118,
            nutrients=[('Energy', 98, 'kcal'), ('Protein', 19.4, 'g'), ('Total fat', .9, 'g'),
                       ('Carbohydrate', 3.1, 'g'), ('Saturated fat', .24, 'g'),
                       ('Calcium', 281, 'mg'), ('Iron', 2, 'mg'), ('Sodium', 494, 'mg')],
            source=dict(id='fnri-G038', title='DOST-FNRI: Blue swimming crab, boiled (G038)',
                        url='https://i.fnri.dost.gov.ph/fct/library/report/4018')),
        'scylla-serrata': dict(
            preparation='Boiled meat, without crab fat', cholesterol_mg=None,
            nutrients=[('Energy', 88, 'kcal'), ('Protein', 17.6, 'g'), ('Total fat', 1.9, 'g'),
                       ('Carbohydrate', 0, 'g'), ('Saturated fat', .52, 'g'),
                       ('Calcium', 279, 'mg'), ('Iron', 1.7, 'mg'), ('Sodium', 326, 'mg')],
            source=dict(id='fnri-G041', title='DOST-FNRI: Mud/mangrove crab, boiled (G041)',
                        url='https://i.fnri.dost.gov.ph/fct/library/report/4021')),
        'ranina-ranina': dict(
            preparation='Raw edible parts, combined sample', cholesterol_mg=54,
            nutrients=[('Energy', 72, 'kcal'), ('Protein', 16.6, 'g'), ('Total fat', .1, 'g'),
                       ('Carbohydrate', 2.8, 'g'), ('Calcium', 178, 'mg'), ('Iron', .9, 'mg'),
                       ('Sodium', 343, 'mg')],
            source=dict(id='tfda-spanner', title='Taiwan FDA food composition database: Spanner crab (J2500201)',
                        url='https://data.gov.tw/en/datasets/8543')),
        'scylla-olivacea': dict(
            preparation='Raw breast meat from female crabs sampled in Bangladesh',
            cholesterol_mg=None,
            nutrients=[('Protein', 19.24, 'g'), ('Total fat', 1.46, 'g'), ('Carbohydrate', 2.89, 'g')],
            source=dict(id='ullah-orange-mud', title='Ullah et al.: Orange mud crab, table 1 (2020)',
                        url='https://journals.ekb.eg/article_129349_4ef58862c556eff7599fa576bdcc0bab.pdf#page=4')),
        'scylla-tranquebarica': dict(
            preparation='Raw body meat from male crabs sampled in India',
            cholesterol_mg=None,
            nutrients=[('Protein', 15.63, 'g'), ('Total fat', .65, 'g')],
            source=dict(id='sreelakshmi-purple-mud', title='Sreelakshmi et al.: Purple mud crab, table 2 (2016)',
                        url='https://epubs.icar.org.in/index.php/IJF/article/download/34511/24689/488419#page=2')),
        'portunus-sanguinolentus': dict(
            preparation='Raw meat from male crabs sampled in Bangladesh',
            cholesterol_mg=None,
            nutrients=[('Protein', 14.02, 'g'), ('Total fat', 2.78, 'g'), ('Sodium', 220.71, 'mg'),
                       ('Potassium', 198.70, 'mg'), ('Calcium', 46.92, 'mg'), ('Iron', 4.22, 'mg'),
                       ('Phosphorus', 62.10, 'mg')],
            source=dict(id='al-mamun-three-spot', title='Al Mamun et al.: Three-spot swimming crab, tables 1–2 (2024)',
                        url='https://doi.org/10.1016/j.jafr.2024.100972')),
        'charybdis-feriata': dict(
            preparation='Crab meat sampled in Pakistan (wet weight)',
            cholesterol_mg=None,
            nutrients=[('Energy', 65.5, 'kcal'), ('Protein', 15.1, 'g')],
            source=dict(id='shah-crucifix', title='Shah et al.: Crucifix crab composition (2021)',
                        url='https://www.sciencedirect.com/science/article/pii/S0889157521000776')),
    }
    if identity not in profiles:
        return None
    profile = profiles[identity]
    return {**profile, 'portion_g': 100, 'basis': '100 g edible portion',
            'nutrients': [dict(name=n, value=v, unit=u) for n, v, u in profile['nutrients']],
            'cholesterol_daily_value_mg': 300, 'high_percent_daily_value': 20,
            'threshold_source': FDA_DV,
            'note': 'These values describe the reference sample. Nutrient levels can vary with the portion and preparation.'}
