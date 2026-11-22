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
            preparation='Spanner crab reference; preparation not specified', cholesterol_mg=29,
            nutrients=[('Total fat', .5, 'g')],
            source=dict(id='frdc-spanner', title='FRDC Fishfiles: Spanner crab nutrition',
                        url='https://www.fishfiles.com.au/Consuming/Buying/Choosing-Species/Spanner-Crab-211')),
    }
    if identity not in profiles:
        return None
    profile = profiles[identity]
    return {**profile, 'portion_g': 100, 'basis': '100 g edible portion',
            'nutrients': [dict(name=n, value=v, unit=u) for n, v, u in profile['nutrients']],
            'cholesterol_daily_value_mg': 300, 'high_percent_daily_value': 20,
            'threshold_source': FDA_DV,
            'note': 'Food composition reference, not a measurement of this crab. This is cholesterol in food, not cholesterol absorbed or a blood-test result.'}
