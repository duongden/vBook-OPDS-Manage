import json, pathlib, zipfile, io, base64, html, re
root=pathlib.Path(__file__).resolve().parent.parent
books=json.loads((root/'src/books.json').read_text())
updated='2026-09-16T00:00:00Z'
for b in books:
    b.update(sample=True,updated=updated,issued='2026-09-16',publisher='Reading Room',rights='Original demonstration text. Free to read and share.',format='EPUB',wordCount=sum(len(p.split()) for p in b['paragraphs']))
    esc=html.escape
    content=''.join('<p>'+esc(p)+'</p>' for p in b['paragraphs'])
    xhtml=f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{b['language']}"><head><title>{esc(b['title'])}</title><style>body{{font-family:serif;line-height:1.7;margin:7%;}}h1{{line-height:1.2}}.notice{{font-family:sans-serif;font-size:.85em;border-bottom:1px solid #aaa;padding-bottom:1em}}</style></head><body><p class="notice">SAMPLE BOOK · Original demonstration text, not a published full-length book.</p><h1>{esc(b['title'])}</h1><p>{esc(b['author'])}</p>{content}</body></html>'''
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w') as z:
        def put(name,data,compress=zipfile.ZIP_DEFLATED):
            zi=zipfile.ZipInfo(name,(2026,9,16,0,0,0));zi.compress_type=compress;z.writestr(zi,data)
        put('mimetype','application/epub+zip',zipfile.ZIP_STORED)
        put('META-INF/container.xml','''<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>''')
        put('EPUB/package.opf',f'''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:reading-room:book:{b['id']}</dc:identifier><dc:title>{esc(b['title'])} (Sample)</dc:title><dc:creator>{esc(b['author'])}</dc:creator><dc:language>{b['language']}</dc:language><dc:rights>{b['rights']}</dc:rights><meta property="dcterms:modified">{updated}</meta></metadata><manifest><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>''')
        put('EPUB/text.xhtml',xhtml)
        put('EPUB/nav.xhtml',f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{b['language']}"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="text.xhtml">{esc(b['title'])}</a></li></ol></nav></body></html>''')
    b['size']=len(buf.getvalue());b['epub']=base64.b64encode(buf.getvalue()).decode()
app=(root/'src/index.html').read_text()
worker=(root/'src/worker.js').read_text().replace('/*__BOOKS__*/',json.dumps(books,ensure_ascii=False)).replace('/*__APP__*/',json.dumps(app,ensure_ascii=False))
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.js').write_text(worker)
print('Built self-contained Worker with',len(books),'sample EPUBs:',len(worker.encode()),'bytes')
