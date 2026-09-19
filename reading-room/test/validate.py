import urllib.request, xml.etree.ElementTree as E, zipfile, io, os
base=os.environ.get('TEST_ORIGIN','http://127.0.0.1:4173');ns={'a':'http://www.w3.org/2005/Atom'}
entries=[];path='/opds';pages=0
while path:
    r=urllib.request.urlopen(base+path if path.startswith('/') else path);root=E.fromstring(r.read());entries+=root.findall('a:entry',ns);pages+=1
    link=root.find("a:link[@rel='next']",ns);path=link.get('href') if link is not None else None
assert len(entries)==8 and pages==2
for e in entries:
    for n in ['id','title','updated','author','summary']: assert len(e.findall('a:'+n,ns))==1
    url=e.find("a:link[@rel='http://opds-spec.org/acquisition/open-access']",ns).get('href')
    data=urllib.request.urlopen(url).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.infolist()[0].filename=='mimetype' and z.infolist()[0].compress_type==0
        assert z.read('mimetype')==b'application/epub+zip'
        for n in z.namelist():
            if n.endswith(('.opf','.xml','.xhtml')): E.fromstring(z.read(n))
        p=E.fromstring(z.read('EPUB/package.opf'));assert p.get('version')=='3.0'
print('PASS: independent XML parser, 8 entries across 2 pages, all 8 EPUB packages, uncompressed mimetype and XHTML.')
