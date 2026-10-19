import pytest
from fastapi import HTTPException
from backend.images import scan


class Scanner:
    def __init__(self,response): self.response=response;self.sent=[]
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def sendall(self,data): self.sent.append(data)
    def recv(self,size): return self.response


def test_clean_scan_uses_instream(monkeypatch,settings):
    settings.clamav_host='scanner'
    scanner=Scanner(b'stream: OK\0')
    monkeypatch.setattr('backend.images.socket.create_connection',lambda *a,**k:scanner)
    scan(b'photo',settings)
    assert scanner.sent[0]==b'zINSTREAM\0'
    assert scanner.sent[-1]==b'\x00\x00\x00\x00'


def test_infected_and_unavailable_scanner_fail_closed(monkeypatch,settings):
    settings.clamav_host='scanner'
    monkeypatch.setattr('backend.images.socket.create_connection',lambda *a,**k:Scanner(b'stream: malware FOUND\0'))
    with pytest.raises(HTTPException) as infected: scan(b'photo',settings)
    assert infected.value.status_code==422
    def unavailable(*a,**k): raise OSError('offline')
    monkeypatch.setattr('backend.images.socket.create_connection',unavailable)
    with pytest.raises(HTTPException) as offline: scan(b'photo',settings)
    assert offline.value.status_code==503
