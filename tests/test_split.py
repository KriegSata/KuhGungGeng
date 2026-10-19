import pytest
from ml.split import split_records


def row(identity,**overrides):
    return {'image_id':identity,'species_id':'scylla-serrata','object_key':f'{identity}.jpg','sha256':identity*64,'perceptual_hash':{'a':'0000000000000000','b':'ffffffffffffffff','c':'0000000000000001'}[identity],'observation_group':identity,'creator':identity,'license':'CC-BY-4.0','source_url':'https://example.org','verification_status':'expert_reviewed','training_rights':True,**overrides}


def test_near_duplicates_and_same_observation_never_cross_splits():
    records=split_records([row('a'),row('b',observation_group='a'),row('c')])
    assert len({r['split'] for r in records})==1
    assert len({r['leakage_group'] for r in records})==1
    assert records==split_records([row('c'),row('b',observation_group='a'),row('a')])


def test_conflicting_duplicate_and_unreviewed_labels_block():
    with pytest.raises(ValueError,match='conflicting'):
        split_records([row('a'),row('b',sha256='a'*64,species_id='other')])
    with pytest.raises(ValueError,match='Unreviewed'):
        split_records([row('a',verification_status='unreviewed')])
