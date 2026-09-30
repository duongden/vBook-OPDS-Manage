import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { Script } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import app from '../src/index';
import { extractFolderId } from '../src/drive';
import { bookKey, hashPassword, checkPassword, seal } from '../src/library-security';
import { libraryClient } from '../src/library-client';
import { libraryCss, libraryHtml } from '../src/library-ui';
import { inferBookLanguage } from '../src/book-language';
import { stripOpdsTitlePrefixes } from '../src/opds-title';

test('removes only leading bracketed source labels', () => {
  assert.equal(stripOpdsTitlePrefixes('[downloadsach.com] Tam vai do - H.epub'), 'Tam vai do - H.epub');
  assert.equal(stripOpdsTitlePrefixes(' [site] [Mirror] Truyện [Tập 1].epub'), 'Truyện [Tập 1].epub');
  assert.equal(stripOpdsTitlePrefixes('[Tên sách]'), '[Tên sách]');
  assert.equal(stripOpdsTitlePrefixes('Truyện [Tập 1].epub'), 'Truyện [Tập 1].epub');
});

test('classifies only sufficiently clear book text', () => {
  assert.equal(inferBookLanguage('Sách tiếng Việt'), 'vi');
  assert.equal(inferBookLanguage('The New Oxford Picture Dictionary'), 'en');
  assert.equal(inferBookLanguage('日本語の本'), 'ja');
  assert.equal(inferBookLanguage('한국어 책'), 'ko');
  assert.equal(inferBookLanguage('中文书籍目录'), 'zh');
  assert.equal(inferBookLanguage('Le Petit Prince'), '');
  assert.equal(inferBookLanguage('Book 1'), '');
});

// Exercise actual migration/query SQL with SQLite, without emulating query results.
class TestD1 {
  sqlite = new DatabaseSync(':memory:');
  constructor() { this.sqlite.exec(readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort().map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n')); }
  prepare(sql: string) {
    const db = this.sqlite;
    let params: any[] = [];
    const statement = {
      bind(...values: any[]) { params = values; return statement; },
      async first(column?: string) { const row = db.prepare(sql).get(...params); return row ? (column ? row[column] : row) : null; },
      async all() { return { results: db.prepare(sql).all(...params), success: true, meta: {} }; },
      async run() { const r = db.prepare(sql).run(...params); return { success: true, meta: { changes: Number(r.changes) }, results: [] }; },
    };
    return statement;
  }
  async batch(statements: any[]) {
    this.sqlite.exec('BEGIN');
    try { const r = []; for (const s of statements) r.push(await s.run()); this.sqlite.exec('COMMIT'); return r; }
    catch (e) { this.sqlite.exec('ROLLBACK'); throw e; }
  }
}
const ROOT = 'ROOT_LIBRARY_12345';
const rootItem = (id: string, name: string, mimeType: string) => ({id, name, mimeType, size:'1024', modifiedTime:'2026-09-19T00:00:00Z'});
const FOLDER = 'application/vnd.google-apps.folder';
const files = ['epub','pdf','cbz','cbr','mobi','txt'].map((ext,i)=>rootItem('BOOK_ID_000000'+i,'Sách '+i+'.'+ext,'application/octet-stream'));
files[0] = {...files[0], thumbnailLink:'https://images.example/source.jpg'} as any;
const tree = new Map<string, any[]>([[ROOT, files]]);
let quota = false;
let incomplete = false;
let failFolder = '';
let driveCalls = 0;
let unavailableSource = false;
let unavailableStatus = 503;
let disconnectedSource = false;
let disconnectedAttempts = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
  if (url.hostname === 'catalog.example') {
    if (url.pathname === '/invalid' || url.pathname === '/invalid-two') return new Response('Danh mục đã đổi đường dẫn',{status:400});
    if (disconnectedSource && url.pathname === '/broken') { disconnectedAttempts++; throw new TypeError('Failed to fetch'); }
    if (unavailableSource && (url.pathname === '/broken' || url.pathname === '/broken-two')) return new Response('',{status:unavailableStatus});
    const headers = new Headers(init?.headers);
    if (headers.has('authorization')) assert.equal(headers.get('authorization'), 'Basic '+btoa('shared:source-secret'), 'Upstream credential is only sent by the proxy');
    if (url.pathname === '/google-link') return new Response('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>urn:fake:google</id><title>Drive links</title><entry><id>urn:fake:drive-book</id><title>Drive book</title><link rel="http://opds-spec.org/acquisition" href="https://drive.google.com/uc?export=download&amp;id=BOOK_FILE_1234567" type="application/epub+zip"/><link rel="http://opds-spec.org/image" href="https://lh3.googleusercontent.com/private-drive-thumbnail" type="image/jpeg"/></entry></feed>',{headers:{'Content-Type':'application/atom+xml'}});
    if (url.pathname === '/prefixed') return new Response('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>urn:fake:prefixed</id><title>Kho mẫu</title><entry><id>urn:fake:prefixed-book</id><title>[downloadsach.com] [Nguồn khác] Truyện [Tập 1].epub</title><link rel="http://opds-spec.org/acquisition" href="/book.epub" type="application/epub+zip"/></entry></feed>',{headers:{'Content-Type':'application/atom+xml'}});
    if (url.pathname === '/book.epub') return new Response('fake-epub', {headers:{'Content-Type':'application/epub+zip','Content-Disposition':'attachment; filename="sample.epub"'}});
    if (url.pathname === '/redirect.epub') return new Response(null,{status:302,headers:{Location:'https://downloads.example/book.epub'}});
    const title = url.pathname === '/sub' ? 'Kệ con' : url.pathname === '/second' ? 'Kho thứ hai' : 'Kho sách được chia sẻ';
    return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>urn:fake:${url.pathname}</id><title>${title}</title><link rel="subsection" href="/sub"/><entry><id>urn:fake:book</id><title>Sách mẫu</title><link rel="http://opds-spec.org/acquisition" href="/${url.pathname === '/redirect' ? 'redirect' : 'book'}.epub" type="application/epub+zip"/><link rel="http://opds-spec.org/image" href="https://images.example/cover.jpg"/></entry></feed>`, {headers:{'Content-Type':'application/atom+xml;charset=utf-8'}});
  }
  if (url.hostname === 'lh3.googleusercontent.com') return new Response(new Uint8Array([0xff,0xd8,0xff,0xd9]),{headers:{'Content-Type':'image/jpeg','Content-Length':'4'}});
  assert.equal(url.hostname, 'www.googleapis.com', 'Only Google API metadata is fetched by the backend');
  assert.equal(init?.method || 'GET', 'GET', 'Drive remains read-only');
  assert.ok(!url.searchParams.has('alt'), 'No file content fetching');
  driveCalls++;
  if (url.pathname !== '/drive/v3/files') return Response.json({ id: ROOT, mimeType: FOLDER });
  if (quota) return Response.json({ error: 'quotaExceeded' }, {status:429});
  if (incomplete) return Response.json({ files: [], incompleteSearch: true });
  const query = url.searchParams.get('q') || '';
  const parents = [...query.matchAll(/'([\w-]+)' in parents/g)].map(m=>m[1]);
  if (parents.includes(failFolder)) return Response.json({error:'File not found'}, {status:404});
  let result = parents.flatMap(id=>tree.get(id)||[]);
  if (query.includes("mimeType = '")) result = result.filter(i=>i.mimeType===FOLDER);
  const term = query.match(/name contains '([^']*)'/)?.[1];
  if (term) result = result.filter(i=>i.name.includes(term));
  const offset = Number(url.searchParams.get('pageToken') || 0), size = 3; // Force every path to handle pagination.
  return Response.json({ files: result.slice(offset,offset+size), ...(offset+size<result.length?{nextPageToken:String(offset+size)}:{}) });
}) as typeof fetch;
after(()=>{globalThis.fetch=realFetch;});

function harness() {
  const db = new TestD1();
  const env = { DB: db, MASK_SECRET:'test-only-secret-012345678901234567890', GOOGLE_API_KEY:'test-only-key' };
  let cookie='', csrf='';
  const req = async (path: string, method='GET', body?: unknown, headers: Record<string,string> = {}) => {
    const r = await app.request('https://library.example'+path, {method, headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{'Content-Type':'application/json',Origin:'https://library.example','X-CSRF-Token':csrf}:{}),...headers}, body:body===undefined?undefined:JSON.stringify(body)}, env as any);
    return r;
  };
  const signIn = async (r: Response) => {
    const data = await r.json() as any;
    assert.ok(r.ok, JSON.stringify(data));
    cookie=r.headers.get('set-cookie')!.split(';')[0];csrf=data.csrf;
    return data;
  };
  const create = async () => signIn(await req('/api/libraries','POST',{name:'Kho riêng',drive:ROOT,username:'owner',password:'  long-password-123  '}));
  return {db,env,req,create,signIn,get cookie(){return cookie;},get csrf(){return csrf;}};
}
const auth = (data:any) => ({Authorization:'Basic '+btoa('reader:'+data.opds.password)});
const base = (data:any) => '/api/libraries/'+data.library.id;

test('managed UI is available without DB; legacy endpoints remain separate; JS parses', async()=>{
  const response=await app.request('https://library.example/');assert.equal(response.status,200);
  assert.match(await response.text(),/Kiểm tra toàn thư viện/);
  assert.match(response.headers.get('content-security-policy')!,/script-src 'self'/);
  assert.equal((await app.request('https://library.example/api/session')).status,503);
  assert.equal((await app.request('https://library.example/legacy')).status,404);
  assert.equal((await app.request('https://library.example/assets/library.js')).status,200);
  assert.match(libraryCss,/--control-height: 44px/);
  assert.match(libraryCss,/\.view-toggle \{[^}]*height: var\(--control-height\)/s);
  assert.match(libraryCss,/\.shelf-head nav \{[^}]*justify-content: flex-start/s);
  assert.match(libraryCss,/\.source-credentials label \{[^}]*justify-content: flex-end/s);
  assert.match(libraryCss,/@media \(max-width: 759px\)[\s\S]*td:last-child \{[^}]*position: absolute/s);
  const uiDocument=new JSDOM(libraryHtml).window.document;
  for(const button of uiDocument.querySelectorAll('.icon-button')) assert.ok(button.getAttribute('aria-label'));
  new Script(libraryClient);
});
test('creation uses encrypted source and hashes; session CSRF, Origin and account boundaries enforced', async()=>{
  const h=harness();const a=await h.create();
  const stored=h.db.sqlite.prepare('SELECT * FROM libraries').get()!;
  assert.ok(!JSON.stringify(stored).includes(ROOT));
  assert.ok(!JSON.stringify(stored).includes('long-password'));assert.ok(!JSON.stringify(stored).includes(a.opds.password));
  assert.match(stored.root_token as string,/^m_/);
  assert.match(a.library.shortId,/^[\w-]{12}$/);
  assert.match(a.opds.password,/^[\w-]{16}$/);
  assert.match(a.recoveryCode,/^[\w-]{16}$/);
  assert.equal(a.opds.url,'https://library.example/o/'+a.library.shortId);
  assert.equal((await h.req(base(a)+'/items')).status,200);
  assert.equal((await h.req('/api/libraries/another/items')).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {Origin:'https://other.example'})).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {Origin:''})).status,403);
  const noSession=await h.req(base(a)+'/items','GET',undefined,{Cookie:'',...auth(a)});assert.equal(noSession.status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds?auth='+btoa('attacker:pass'),'GET',undefined,{Authorization:'Basic '+btoa('attacker:pass')})).status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds')).status,401);
  const publicFeed=await h.req('/o/'+a.library.shortId,'GET',undefined,{Cookie:''});
  assert.equal(publicFeed.status,200);
  assert.ok(!publicFeed.headers.has('www-authenticate'));
  assert.equal((await h.req('/o/'+a.library.shortId+'/d?ref=invalid','GET',undefined,{Cookie:''})).status,400);
  assert.equal((await h.req('/0/'+a.library.shortId)).status,404);
  assert.equal((await h.req('/api/session','POST',{libraryId:a.library.shortId,username:'owner',password:'  long-password-123  '})).status,200);
  const csrfRes=await h.req('/api/session');assert.match(csrfRes.headers.get('cache-control')!,/no-store/);
});
test('public short OPDS link stays accessible without credentials or a session',async()=>{
  const h=harness();
  const a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kho riêng',drive:ROOT,username:'owner',password:'long-password-123',opdsPassword:'trasua'}));
  assert.equal(a.opds.password,'trasua');
  assert.equal((await h.req('/o/'+a.library.shortId,'GET',undefined,{Cookie:''})).status,200);
  assert.equal((await h.req('/api/session','POST',{libraryId:a.library.shortId,username:'owner',password:'long-password-123'})).status,200);
  const stored=h.db.sqlite.prepare('SELECT opds_hash FROM libraries').get() as {opds_hash:string};assert.ok(!stored.opds_hash.includes('trasua'));
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{opdsPassword:'abc'})).status,400);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{opdsPassword:'bad space'})).status,400);
  const changed=await(await h.req(base(a)+'/opds-credentials','POST',{opdsPassword:'simple123'})).json() as any;
  assert.equal(changed.opds.password,'simple123');
  assert.equal((await h.req('/o/'+a.library.shortId,'GET',undefined,{Cookie:''})).status,200);
  assert.equal((await h.req('/library/'+a.library.id+'/opds','GET',undefined,auth(a))).status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds','GET',undefined,{Authorization:'Basic '+btoa('reader:simple123')})).status,200);
});

test('metadata survives queries, appears in XML and JSON, can be reset; download redirects', async()=>{
  const h=harness(),a=await h.create();
  const page=await(await h.req(base(a)+'/items')).json() as any;
  assert.equal(page.items.length,3);assert.ok(page.nextCursor);
  const b=page.items[0];
  const metadata={title:'Tên sửa <&>',author:'Tác giả',language:'vi',description:'Mô tả & nội dung',category:'Truyện',coverUrl:'https://images.example/new.png'};
  assert.equal((await h.req(base(a)+'/books/'+b.key,'PUT',{ref:b.ref,...metadata})).status,200);
  const updated=await(await h.req(base(a)+'/items')).json() as any;assert.equal(updated.items[0].title,metadata.title);
  const xmlResponse=await h.req('/library/'+a.library.id+'/opds','GET',undefined,auth(a));
  assert.equal(xmlResponse.status,200);const xml=await xmlResponse.text();
  assert.match(xml,/<title>Tên sửa &lt;&amp;&gt;\.epub<\/title>/);assert.match(xml,/<dc:language>vi<\/dc:language>/);
  assert.ok(xml.includes('https://images.example/new.png'));assert.ok(!xml.includes(ROOT));assert.ok(!xml.includes(files[0].id));
  const parserWindow = new JSDOM('').window;
  const parsed = new parserWindow.DOMParser().parseFromString(xml,'application/xml');
  assert.equal(parsed.querySelector('parsererror'),null);
  assert.equal(parsed.getElementsByTagNameNS('http://purl.org/dc/terms/','language')[0].textContent,'vi');
  parserWindow.close();
  const feed=await(await h.req('/o/'+a.library.shortId,'GET',undefined,{...auth(a),Accept:'application/opds+json'})).json() as any;
  assert.deepEqual(feed.publications[0].metadata.language,['vi']);assert.equal(feed.publications[0].metadata.author[0].name,'Tác giả');
  assert.equal(feed.links.find((l:any)=>l.rel[0]==='start').href,'https://library.example/o/'+a.library.shortId);
  assert.match(feed.publications[0].links[0].href,new RegExp('/o/'+a.library.shortId+'/d\\?ref='));
  const next=feed.links.find((l:any)=>l.rel[0]==='next').href;
  const second=await(await h.req(new URL(next).pathname+new URL(next).search,'GET',undefined,{...auth(a),Accept:'application/opds+json'})).json() as any;
  assert.equal(second.publications.length,3);assert.match(second.publications[0].metadata.title,/\.cbr$/);
  const dl=new URL(feed.publications[0].links[0].href);const redirect=await h.req(dl.pathname+dl.search,'GET',undefined,auth(a));
  assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://drive.google.com/uc?export=download&id='+files[0].id+'&confirm=t');
  assert.equal((await h.req(base(a)+'/books/'+b.key,'PUT',{ref:b.ref,coverUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await h.req(base(a)+'/books/'+b.key,'DELETE',{ref:b.ref})).status,200);
  const reset=await(await h.req(base(a)+'/items')).json() as any;assert.equal(reset.items[0].title,files[0].name);assert.equal(reset.items[0].coverUrl,'https://images.example/source.jpg');
});
test('managed XML and JSON hide Google Drive thumbnail URLs behind a signed cover link',async()=>{
  const original=files[0].thumbnailLink;
  files[0].thumbnailLink='https://lh3.googleusercontent.com/private-drive-thumbnail';
  try{
    const h=harness(),a=await h.create();
    const response=await h.req('/o/'+a.library.shortId,'GET',undefined,auth(a));
    assert.equal(response.status,200);
    const xml=await response.text();
    assert.ok(!xml.includes('googleusercontent.com'));
    assert.ok(!xml.includes(files[0].id));
    const href=xml.match(/rel="http:\/\/opds-spec\.org\/image" href="([^"]+)"/)?.[1];assert.ok(href);
    const image=new URL(href);
    assert.equal(image.origin,'https://library.example');
    assert.equal(image.pathname,'/assets/drive-cover');
    const cover=await h.req(image.pathname+image.search);
    assert.equal(cover.status,200);assert.equal(cover.headers.get('content-type'),'image/jpeg');
    assert.deepEqual(Array.from(new Uint8Array(await cover.arrayBuffer())),[0xff,0xd8,0xff,0xd9]);
    const json=await(await h.req('/o/'+a.library.shortId,'GET',undefined,{...auth(a),Accept:'application/opds+json'})).text();
    assert.ok(!json.includes('googleusercontent.com'));
    assert.match(json,/\/assets\/drive-cover\?ref=/);
  }finally{files[0].thumbnailLink=original;}
});
test('individual OPDS source XML masks external Google Drive links',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:'https://catalog.example/google-link',username:'owner',password:'long-password-123'}));
  const source=(await(await h.req(base(a)+'/sources')).json() as any).sources[0];
  const xml=await(await h.req(new URL(source.url).pathname,'GET',undefined,auth(a))).text();
  assert.ok(!xml.includes('drive.google.com'));
  assert.ok(!xml.includes('googleusercontent.com'));
  assert.ok(!xml.includes('BOOK_FILE_1234567'));
  const links=[...xml.matchAll(/href="([^\"]+)"/g)].map(match=>match[1].replace(/&amp;/g,'&'));
  const resource=links.find(href=>href.includes('/assets/drive-resource?ref='));assert.ok(resource);
  const redirected=await h.req(new URL(resource,'https://library.example').pathname+new URL(resource,'https://library.example').search);
  assert.equal(redirected.status,302);
  assert.match(redirected.headers.get('location')||'',/^https:\/\/drive\.google\.com\/uc\?/);
});
test('external OPDS sources aggregate behind public short proxy links', async()=>{
  const h=harness(),a=await h.create();
  const added=await h.req(base(a)+'/sources','POST',{sources:[{url:'https://catalog.example/opds',username:'shared',password:'source-secret'}]});
  assert.equal(added.status,201);const data=await added.json() as any;assert.equal(data.sources.length,1);
  const source=data.sources[0];assert.match(source.shortId,/^[\w-]{12}$/);assert.equal(source.name,'Kho sách được chia sẻ');
  assert.equal(source.host,'catalog.example');assert.equal(source.hasCredentials,true);assert.equal(source.url,'https://library.example/o/'+a.library.shortId+'/s/'+source.shortId);
  assert.ok(!JSON.stringify(source).includes('source-secret'));assert.equal(source.sourceUrl,'https://catalog.example/opds');
  const stored=h.db.sqlite.prepare('SELECT config_token FROM opds_sources').get()!.config_token as string;
  assert.ok(!stored.includes('catalog.example'));assert.ok(!stored.includes('source-secret'));

  const aggregate=await h.req('/o/'+a.library.shortId,'GET',undefined,{Cookie:''});assert.equal(aggregate.status,200);
  const aggregateXml=await aggregate.text();assert.ok(aggregateXml.includes('Kệ tổng hợp'));assert.ok(aggregateXml.includes('/o/'+a.library.shortId+'/all'));
  const shelf=await h.req('/o/'+a.library.shortId+'/all','GET',undefined,{Cookie:''});assert.equal(shelf.status,200);
  const shelfXml=await shelf.text();assert.match(shelfXml,/Sách mẫu/);
  const shelfDownload=shelfXml.match(/rel="http:\/\/opds-spec\.org\/acquisition" href="([^"]+)"/)?.[1];assert.ok(shelfDownload);
  const shelfFile=await h.req(new URL(shelfDownload).pathname+new URL(shelfDownload).search,'GET',undefined,{Cookie:''});assert.equal(shelfFile.status,200);assert.equal(await shelfFile.text(),'fake-epub');
  const proxy=await h.req(new URL(source.url).pathname,'GET',undefined,{Cookie:''});assert.equal(proxy.status,200);
  const xml=await proxy.text();assert.ok(!xml.includes('source-secret'));assert.ok(xml.includes('/s/'+source.shortId+'?target='));assert.ok(xml.includes('https://images.example/cover.jpg'));
  const parserWindow=new JSDOM('').window;const parsed=new parserWindow.DOMParser().parseFromString(xml,'application/xml');
  const acquisition=[...parsed.querySelectorAll('link')].find(link=>link.getAttribute('type')==='application/epub+zip')!;
  const bookUrl=new URL(acquisition.getAttribute('href')!,'https://library.example');
  const book=await h.req(bookUrl.pathname+bookUrl.search,'GET',undefined,{Cookie:''});assert.equal(book.status,200);assert.equal(await book.text(),'fake-epub');
  parserWindow.close();

  const scanned=await h.req(base(a)+'/scan','POST',{sourceId:source.id});assert.equal(scanned.status,200);const scan=await scanned.json() as any;
  const scannedBook=scan.items.find((item:any)=>!item.isFolder),scannedFolder=scan.items.find((item:any)=>item.isFolder);
  assert.equal(scannedBook.title,'Sách mẫu');assert.equal(scannedBook.format,'EPUB');assert.equal(scannedBook.external,true);assert.equal(scannedBook.sourceName,'Kho sách được chia sẻ');assert.equal(scannedBook.language,'vi');assert.equal(scannedBook.languageInferred,true);assert.ok(scannedBook.ref);
  assert.equal(scan.nextCursor,null);assert.ok(scannedFolder.ref);const child=await h.req(base(a)+'/scan','POST',{sourceId:source.id,target:scannedFolder.ref});assert.equal(child.status,200);const childData=await child.json() as any;assert.equal(childData.items.some((item:any)=>item.title==='Sách mẫu'),true);assert.equal(childData.nextCursor,null);assert.equal(childData.folderKey,scannedFolder.key);assert.equal(childData.items.find((item:any)=>item.isFolder).key,scannedFolder.key);
  const managedDownload=await h.req(base(a)+'/sources/'+source.id+'/download?ref='+encodeURIComponent(scannedBook.ref));assert.equal(managedDownload.status,200);assert.equal(await managedDownload.text(),'fake-epub');
  assert.equal((await h.req(base(a)+'/source-books/hide','POST',{books:[{sourceId:source.id,key:scannedBook.key}]})).status,200);
  const hiddenScan=await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any;assert.equal(hiddenScan.items.some((item:any)=>item.title==='Sách mẫu'),false);assert.equal(hiddenScan.items.some((item:any)=>item.isFolder),true);
  const hiddenProxy=await h.req(new URL(source.url).pathname,'GET',undefined,auth(a));assert.equal(hiddenProxy.status,200);assert.ok(!(await hiddenProxy.text()).includes('Sách mẫu'));

  let changed=await h.req(base(a)+'/sources/'+source.id,'PATCH',{enabled:false});assert.equal(changed.status,200);
  assert.equal((await changed.json() as any).sources[0].enabled,false);
  assert.ok(!(await (await h.req('/o/'+a.library.shortId,'GET',undefined,auth(a))).text()).includes('Kho sách được chia sẻ'));
  assert.equal((await h.req(new URL(source.url).pathname,'GET',undefined,auth(a))).status,404);
  await h.req(base(a)+'/sources/'+source.id,'PATCH',{enabled:true});
  changed=await h.req(base(a)+'/sources/'+source.id,'DELETE',{});assert.equal(changed.status,200);assert.deepEqual((await changed.json() as any).sources,[]);
  assert.equal((await h.req(base(a)+'/sources','POST',{sources:[{url:'https://127.0.0.1/opds'}]})).status,400);
  const invalidBatch=await h.req(base(a)+'/sources','POST',{sources:[{url:'https://catalog.example/opds'},{url:'http://invalid.example/opds'}]});
  assert.equal(invalidBatch.status,400);assert.match((await invalidBatch.json() as any).error,/URL OPDS thứ 2\/2/);
  assert.deepEqual((await(await h.req(base(a)+'/sources')).json() as any).sources,[]);
});
test('source download preserves the redirect target for externally hosted book files',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:'https://catalog.example/redirect',username:'owner',password:'long-password-123'}));
  const source=(await(await h.req(base(a)+'/sources')).json() as any).sources[0];
  const scan=await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any;
  const book=scan.items.find((item:any)=>!item.isFolder);
  const managed=await h.req(base(a)+'/sources/'+source.id+'/download?ref='+encodeURIComponent(book.ref));
  assert.equal(managed.status,302);
  assert.equal(managed.headers.get('location'),'https://downloads.example/book.epub');
  const shelf=await(await h.req('/o/'+a.library.shortId+'/all','GET',undefined,auth(a))).text();
  const href=shelf.match(/rel="http:\/\/opds-spec\.org\/acquisition" href="([^"]+)"/)?.[1];assert.ok(href);
  const target=new URL(href);
  const aggregate=await h.req(target.pathname+target.search,'GET',undefined,auth(a));
  assert.equal(aggregate.status,302);
  assert.equal(aggregate.headers.get('location'),'https://downloads.example/book.epub');
});
test('multiple pasted OPDS URLs create one aggregate catalog without Drive',async()=>{
  const h=harness();const before=driveCalls;
  const a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kho OPDS',drive:'https://catalog.example/opds\nhttps://catalog.example/second',username:'owner',password:'long-password-123'}));
  assert.equal(driveCalls,before);const items=await(await h.req(base(a)+'/items')).json() as any;assert.deepEqual(items.items,[]);
  const sources=await(await h.req(base(a)+'/sources')).json() as any;assert.equal(sources.sources.length,2);assert.deepEqual(sources.sources.map((source:any)=>source.name),['Kho sách được chia sẻ','Kho thứ hai']);
  const aggregate=await h.req('/o/'+a.library.shortId,'GET',undefined,auth(a));assert.equal(aggregate.status,200);const xml=await aggregate.text();assert.match(xml,/Kệ tổng hợp/);assert.equal((xml.match(/rel="http:\/\/opds-spec\.org\/acquisition"/g)||[]).length,2);
  const addedDrive=await h.req(base(a)+'/drive','PUT',{drive:'https://drive.google.com/drive/folders/'+ROOT});assert.equal(addedDrive.status,200);assert.equal((await addedDrive.json() as any).hasDrive,true);
  assert.equal((await (await h.req(base(a)+'/items')).json() as any).items.length,3);
  const removedDrive=await h.req(base(a)+'/drive','DELETE',{});assert.equal(removedDrive.status,200);assert.equal((await removedDrive.json() as any).hasDrive,false);
  assert.deepEqual((await (await h.req(base(a)+'/items')).json() as any).items,[]);
});
test('hidden OPDS history retains source association until the source is removed',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:'https://catalog.example/opds',username:'owner',password:'long-password-123'}));
  const source=(await(await h.req(base(a)+'/sources')).json() as any).sources[0];
  const book=(await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any).items.find((item:any)=>!item.isFolder);
  assert.equal((await h.req(base(a)+'/source-books/hide','POST',{books:[{sourceId:source.id,key:book.key}]})).status,200);
  const history=await(await h.req(base(a)+'/source-books/history')).json() as any;
  assert.equal(history.events.length,1);assert.equal(history.events[0].sourceId,source.id);assert.ok(history.events[0].removedAt>0);
  assert.ok(!JSON.stringify(history).includes(source.sourceUrl),'history returns source ids but keeps original URL behind explicit reveal');
  await h.req(base(a)+'/sources/'+source.id,'DELETE',{});
  assert.deepEqual((await(await h.req(base(a)+'/source-books/history')).json() as any).events,[]);
});
test('OPDS title cleanup persists across scan, aggregate feed and source feed',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kho OPDS',drive:'https://catalog.example/prefixed',username:'owner',password:'long-password-123'}));
  const source=(await(await h.req(base(a)+'/sources')).json() as any).sources[0];
  const original=(await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any).items.find((item:any)=>!item.isFolder);
  assert.match(original.title,/^\[downloadsach\.com\]/);
  assert.equal((await h.req(base(a)+'/settings','PATCH',{stripOpdsPrefixes:'yes'})).status,400);
  assert.equal((await h.req(base(a)+'/settings','PATCH',{stripOpdsPrefixes:true})).status,200);
  const cleaned=(await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any).items.find((item:any)=>!item.isFolder);
  assert.equal(cleaned.title,'Truyện [Tập 1].epub');assert.equal(cleaned.name,original.name);assert.equal(cleaned.key,original.key);
  const aggregate=await(await h.req('/o/'+a.library.shortId+'/all','GET',undefined,auth(a))).text();
  assert.match(aggregate,/<title>Truyện \[Tập 1\]\.epub<\/title>/);assert.doesNotMatch(aggregate,/\[downloadsach\.com\]/);
  const sourceFeed=await(await h.req('/o/'+a.library.shortId+'/s/'+source.shortId,'GET',undefined,auth(a))).text();
  assert.match(sourceFeed,/<title>Truyện \[Tập 1\]\.epub<\/title>/);assert.doesNotMatch(sourceFeed,/\[downloadsach\.com\]/);
  const signedIn=await(await h.req('/api/session')).json() as any;assert.equal(signedIn.library.stripOpdsPrefixes,true);
  await h.req(base(a)+'/settings','PATCH',{stripOpdsPrefixes:false});
  const restored=(await(await h.req(base(a)+'/scan','POST',{sourceId:source.id})).json() as any).items.find((item:any)=>!item.isFolder);
  assert.equal(restored.title,original.title);
});
test('aggregate shelf traverses source pages and nested feeds without repeating books',async()=>{
  const h=harness(),links=Array.from({length:13},(_,i)=>`https://catalog.example/opds?source=${i}`);
  const a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:links.slice(0,10).join('\n'),username:'owner',password:'long-password-123'}));
  assert.equal((await h.req(base(a)+'/sources','POST',{sources:links.slice(10).map(url=>({url}))})).status,201);
  let path='/o/'+a.library.shortId,seen=0,pages=0;
  while(path){
    const response=await h.req(path,'GET',undefined,{...auth(a),Accept:'application/opds+json'});assert.equal(response.status,200);
    const feed=await response.json() as any;seen+=feed.publications.length;pages++;
    assert.equal(feed.navigation.some((entry:any)=>entry.title==='Kệ con'),false);
    const next=feed.links.find((link:any)=>link.rel.includes('next'))?.href;
    path=next?new URL(next).pathname+new URL(next).search:'';
    assert.ok(pages<10,'aggregate pagination terminates');
  }
  assert.equal(seen,13);assert.ok(pages>1);
  assert.equal((await h.req('/o/'+a.library.shortId+'/all?cursor=invalid','GET',undefined,auth(a))).status,400);
  const publicInfo=await(await h.req('/api/public/libraries/'+a.library.id,'GET',undefined,{Cookie:''})).json() as any;
  assert.deepEqual(publicInfo.library,{id:a.library.id,shortId:a.library.shortId,name:'Kệ chung',hasDrive:false});
  assert.ok(!JSON.stringify(publicInfo).includes('password'));
  assert.equal((await h.req('/api/public/libraries/unknown','GET',undefined,{Cookie:''})).status,404);
  const search=await(await h.req('/o/'+a.library.shortId+'/all?q=S%C3%A1ch%20m%E1%BA%ABu','GET',undefined,{Cookie:'',Accept:'application/opds+json'})).json() as any;
  assert.ok(search.publications.length>0);
  assert.ok(search.links.some((link:any)=>link.rel.includes('search')));
  const searchNext=search.links.find((link:any)=>link.rel.includes('next'))?.href;
  assert.ok(searchNext);
  const wrongQuery=new URL(searchNext);wrongQuery.searchParams.set('q','khac');
  assert.equal((await h.req(wrongQuery.pathname+wrongQuery.search,'GET',undefined,{Cookie:''})).status,400);
  const noMatch=await(await h.req('/o/'+a.library.shortId+'/all?q=khong-co-sach','GET',undefined,{Cookie:'',Accept:'application/opds+json'})).json() as any;
  assert.equal(noMatch.publications.length,0);
});
test('aggregate shelf keeps working sources visible when another feed becomes unavailable',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:'https://catalog.example/broken\nhttps://catalog.example/opds',username:'owner',password:'long-password-123'}));
  unavailableSource=true;
  try{
    const sources=(await(await h.req(base(a)+'/sources')).json() as any).sources;
    const checks=await h.req(base(a)+'/sources/check','POST',{ids:sources.map((source:any)=>source.id)});
    assert.equal(checks.status,200);
    const results=(await checks.json() as any).checks;
    assert.deepEqual(results.map((item:any)=>item.ok).sort(),[false,true]);
    assert.match(results.find((item:any)=>!item.ok).error,/HTTP 503/);
    assert.equal(results.find((item:any)=>!item.ok).retryable,true);
    const response=await h.req('/o/'+a.library.shortId,'GET',undefined,{...auth(a),Accept:'application/opds+json'});
    assert.equal(response.status,200);
    const feed=await response.json() as any;
    assert.match(feed.metadata.title,/1 nguồn lỗi/);
    assert.equal(feed.publications.length,1);
  }finally{unavailableSource=false;}
});
test('temporary fetch failure is retried and does not mark a valid saved source as broken',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chung',drive:'https://catalog.example/broken',username:'owner',password:'long-password-123'}));
  const id=(await(await h.req(base(a)+'/sources')).json() as any).sources[0].id;
  disconnectedAttempts=0;disconnectedSource=true;
  try{
    const checks=await h.req(base(a)+'/sources/check','POST',{ids:[id]});
    const result=(await checks.json() as any).checks[0];
    assert.equal(result.ok,false);assert.equal(result.retryable,true);
    assert.match(result.error,/Tạm thời không kết nối/);
    assert.equal(disconnectedAttempts,2);
  }finally{disconnectedSource=false;}
  const checks=await h.req(base(a)+'/sources/check','POST',{ids:[id]});
  assert.equal((await checks.json() as any).checks[0].ok,true);
});
test('same Drive file has isolated overrides and capabilities for each library', async()=>{
  const h=harness(),a=await h.create();const aItems=await(await h.req(base(a)+'/items')).json() as any;
  await h.req(base(a)+'/books/'+aItems.items[0].key,'PUT',{ref:aItems.items[0].ref,title:'Only A'});
  const b=await h.create();const bItems=await(await h.req(base(b)+'/items')).json() as any;
  assert.notEqual(aItems.items[0].key,bItems.items[0].key);assert.equal(bItems.items[0].title,files[0].name);
  assert.equal((await h.req(base(b)+'/books/'+bItems.items[0].key,'PUT',{ref:aItems.items[0].ref,title:'Attack'})).status,400);
  assert.equal((await h.req(base(b)+'/items?cursor='+encodeURIComponent(aItems.nextCursor))).status,400);
  assert.equal((await h.req('/library/'+b.library.id+'/download?ref='+encodeURIComponent(aItems.items[0].ref),'GET',undefined,auth(b))).status,400);
  assert.equal((await h.req('/library/'+b.library.id+'/download?ref='+files[0].id,'GET',undefined,auth(b))).status,400);
});
test('scan traverses all pages, >35 folders, >3 levels and can retry without corrupting progress', async()=>{
  const old=tree.get(ROOT)!;
  const folders=Array.from({length:42},(_,i)=>rootItem('FOLDER_ID_'+String(i).padStart(8,'0'),'Thư mục '+i,FOLDER));
  tree.set(ROOT,[...folders,...files]);folders.forEach(f=>tree.set(f.id,[]));
  let parent=folders[0].id;
  for(let i=0;i<5;i++){const id='DEEP_FOLDER_000'+i;tree.set(parent,[rootItem(id,'Cấp '+i,FOLDER)]);parent=id;}
  tree.set(parent,[rootItem('DEEP_BOOK_000001','Sách sâu.epub','application/epub+zip'),files[0]]);
  try {
    const h=harness(),a=await h.create();const queue:any[]=[{}],seen=new Set(),books=new Set();let pages=0;
    while(queue.length){const job=queue[0];
      if(pages===1){quota=true;assert.equal((await h.req(base(a)+'/scan','POST',job)).status,429);quota=false;}
      const response=await h.req(base(a)+'/scan','POST',job);assert.equal(response.status,200);
      const data=await response.json() as any;queue.shift();pages++;seen.add(data.folderKey);
      for(const item of data.items){if(item.isFolder){if(!seen.has(item.key)){seen.add(item.key);queue.push({folder:item.ref});}}else books.add(item.key);}
      if(data.nextCursor)queue.unshift({...job,cursor:data.nextCursor});
    }
    assert.equal(books.size,7);assert.ok(seen.size>35);assert.ok(pages>50);
  } finally {tree.set(ROOT,old);quota=false;}
});
test('bulk language preserves other edits and clearing restores unknown', async()=>{
  const h=harness(),a=await h.create(),page=await(await h.req(base(a)+'/items')).json() as any;
  const b=page.items[0];await h.req(base(a)+'/books/'+b.key,'PUT',{ref:b.ref,title:'Tên mới',author:'Tác giả A'});
  assert.equal((await h.req(base(a)+'/language','POST',{refs:page.items.map((b:any)=>b.ref),language:'zh-Hans'})).status,200);
  let data=await(await h.req(base(a)+'/items')).json() as any;assert.equal(data.items[0].author,'Tác giả A');assert.equal(data.items[0].language,'zh-Hans');
  await h.req(base(a)+'/language','POST',{refs:[b.ref],language:''});data=await(await h.req(base(a)+'/items')).json() as any;
  assert.equal(data.items[0].language,'');assert.equal(data.items[0].title,'Tên mới');
  assert.equal((await h.req(base(a)+'/language','POST',{refs:[b.ref],language:'not a language'})).status,400);
});
test('logout, password change, recovery, OPDS rotation and delete revoke credentials', async()=>{
  const h=harness(),a=await h.create(),oldCookie=h.cookie;
  const changed=await h.req(base(a)+'/password','POST',{currentPassword:'  long-password-123  ',password:'new-password-123456'});
  assert.equal(changed.status,200);await h.signIn(changed);
  assert.equal((await h.req('/api/session','GET',undefined,{Cookie:oldCookie})).status,401);
  const rotated=await(await h.req(base(a)+'/opds-credentials','POST',{})).json() as any;
  assert.equal((await h.req('/library/'+a.library.id+'/opds','GET',undefined,auth(a))).status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds','GET',undefined,auth(rotated))).status,200);
  const rec=await h.signIn(await h.req('/api/recovery','POST',{libraryId:a.library.shortId,code:a.recoveryCode,password:'recovered-password-123'}));
  assert.match(rec.recoveryCode,/^[\w-]{16}$/);assert.match(rec.opds.password,/^[\w-]{16}$/);
  assert.ok(rec.recoveryCode);assert.equal((await h.req('/api/recovery','POST',{libraryId:a.library.id,code:a.recoveryCode,password:'recovered-password-123'})).status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds','GET',undefined,auth(rotated))).status,401);
  assert.equal((await h.req('/api/session','DELETE',{})).status,200);
  assert.equal((await h.req('/api/session')).status,401);
  await h.signIn(await h.req('/api/session','POST',{libraryId:a.library.id,username:'owner',password:'recovered-password-123'}));
  assert.equal((await h.req(base(a)+'/delete','POST',{password:'recovered-password-123'})).status,200);
  assert.equal(h.db.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n,0);
  assert.equal(h.db.sqlite.prepare('SELECT count(*) AS n FROM libraries').get()!.n,0);
});
test('rate limits, expired sessions/cursors, body bounds and Drive errors fail safely', async()=>{
  const h=harness(),a=await h.create();
  const root=await seal(h.env.MASK_SECRET,{lib:a.library.id,kind:'page',id:ROOT,page:'3',exp:1});
  assert.equal((await h.req(base(a)+'/items?cursor='+root)).status,400);
  const wrongQuery=await seal(h.env.MASK_SECRET,{lib:a.library.id,kind:'page',id:ROOT,page:'3',q:'other'});
  assert.equal((await h.req(base(a)+'/items?cursor='+wrongQuery)).status,400);
  assert.equal((await h.req(base(a)+'/scan','POST',{cursor:'x'.repeat(70000)})).status,413);
  failFolder=ROOT;assert.equal((await h.req(base(a)+'/items')).status,404);failFolder='';
  incomplete=true;assert.equal((await h.req(base(a)+'/scan','POST',{})).status,503);incomplete=false;
  h.db.sqlite.prepare('UPDATE sessions SET expires_at = 1').run();assert.equal((await h.req(base(a)+'/items')).status,401);
  let status=0;for(let i=0;i<13;i++)status=(await h.req('/api/session','POST',{libraryId:a.library.id,username:'owner',password:'incorrect-password'})).status;
  assert.equal(status,429);
});
test('hashes use per-password salts and file keys differ by library; Drive remains metadata-only', async()=>{
  const a=await hashPassword('password-123456'),b=await hashPassword('password-123456');assert.notEqual(a,b);
  assert.ok(await checkPassword('password-123456',a));assert.ok(!await checkPassword('password-654321',a));
  assert.notEqual(await bookKey('secret','A',ROOT),await bookKey('secret','B',ROOT));assert.ok(driveCalls>0);
});

test('UI forms, edit/reset, filters, bulk selection, full scan and logout run against the real API', async()=>{
  const h=harness(),errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(libraryHtml,{url:'https://library.example/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,d=w.document;let cookie='',holdScan=false,scanStarted=false;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.confirm=()=>true;
  w.AbortController=globalThis.AbortController as any;
  w.fetch=(async(path:string,init:any={})=>{
    if(holdScan&&path.endsWith('/scan')) {
      scanStarted=true;
      await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    }
    const headers={...(cookie?{Cookie:cookie}:{}),...(init.method&&init.method!=='GET'?{Origin:'https://library.example'}:{}),...init.headers};
    const r=await app.request('https://library.example'+path,{...init,headers},h.env as any);
    if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];
    return r;
  }) as any;
  const wait=async(predicate:()=>boolean)=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.fail('UI condition timed out: '+d.querySelector('#notice')!.textContent+' / scan: '+d.querySelector('#scan-status')!.textContent+' / '+errors.map(String).join(';'));};
  const field=(form:string,name:string,value:string)=>{(d.querySelector(form) as HTMLFormElement).elements.namedItem(name).value=value;};
  const submit=(id:string)=>d.querySelector(id)!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const click=(id:string)=>(d.querySelector(id) as HTMLButtonElement).click();
  try {
    w.eval(libraryClient);
    assert.equal(d.documentElement.dataset.theme,'light');assert.equal(d.querySelector('#theme-toggle')!.textContent,'☾');click('#theme-toggle');assert.equal(d.documentElement.dataset.theme,'dark');assert.equal(d.querySelector('#theme-toggle')!.textContent,'☀');assert.equal(d.querySelector('#theme-toggle')!.getAttribute('aria-pressed'),'true');
    field('#create','drive',ROOT);field('#create','name','Thư viện UI');field('#create','username','owner');field('#create','password','ui-password-12345');submit('#create');
    await wait(()=>d.querySelectorAll('.book').length===3&&d.querySelector('#connection')!.hasAttribute('open'));
    assert.match(d.querySelector('#connection')!.textContent!,/Để trống Tên và Mật khẩu/);
    assert.equal(d.querySelector('#secret-values [data-copy-secret="opds"]'),null);
    assert.ok(d.querySelector('#secret-values [data-copy-secret="library"]'));
    assert.ok((d.querySelector('#opds-url') as HTMLInputElement).value.includes('/o/'));
    click('#copy-opds');await wait(()=>d.querySelector('#notice')!.closest('dialog')?.id==='connection');
    assert.equal(d.querySelector('#custom-opds-password'),null);
    click('[data-close="connection"]');await wait(()=>!d.querySelector('#notice')!.closest('dialog'));
    click('#sources-button');assert.ok(d.querySelector('#sources')!.hasAttribute('open'));assert.match(d.querySelector('#drive-status')!.textContent!,/Đã kết nối/);
    field('#drive-form','drive','https://drive.google.com/drive/folders/'+ROOT);submit('#drive-form');await wait(()=>d.querySelector('#notice')!.textContent==='Đã cập nhật nguồn Google Drive.');assert.equal(d.querySelector('#notice')!.closest('dialog')?.id,'sources');assert.equal((d.querySelector('#drive-remove') as HTMLButtonElement).hidden,false);
    field('#source-form','urls','https://catalog.example/feed/m_TEST-123_Z');field('#source-form','username','shared');field('#source-form','password','source-secret');submit('#source-form');
    await wait(()=>d.querySelectorAll('.source-row').length===1);assert.equal(d.querySelector('#source-count')!.textContent,'2');assert.ok(d.querySelector('#source-list')!.textContent!.includes('Kho sách được chia sẻ'));assert.ok(!d.querySelector('#source-list')!.textContent!.includes('source-secret'));assert.ok(d.querySelector('#source-list')!.textContent!.includes('https://catalog.example/feed/m_TEST-123_Z'));
    assert.equal((d.querySelector('#opds-title-option') as HTMLElement).hidden,false);
    click('#strip-opds-prefixes');await wait(()=>d.querySelector('#notice')!.textContent!.includes('Đã bỏ tiền tố'));
    assert.equal((d.querySelector('#strip-opds-prefixes') as HTMLInputElement).checked,true);
    click('#strip-opds-prefixes');await wait(()=>d.querySelector('#notice')!.textContent!.includes('Đã hiện lại tên gốc'));
    field('#source-form','urls','http://invalid.example/opds');submit('#source-form');
    await wait(()=>Boolean(d.querySelector('#source-form .form-error')));
    assert.equal(d.querySelector('#notice')!.closest('dialog')?.id,'sources');
    assert.match(d.querySelector('#source-form .form-error')!.textContent!,/Có 1 link lỗi/);
    assert.match(d.querySelector('#source-import-errors')!.textContent!,/http:\/\/invalid.example\/opds/);
    click('[data-close="sources"]');await wait(()=>!d.querySelector('#notice')!.closest('dialog'));click('#load-more');await wait(()=>d.querySelector('#page-label')!.textContent!.includes('Trang 2'));
    assert.equal(d.querySelectorAll('.book').length,3);click('#page-prev');assert.equal(d.querySelectorAll('.book').length,3);assert.match(d.querySelector('#page-label')!.textContent!,/Trang 1/);click('#load-more');assert.match(d.querySelector('#page-label')!.textContent!,/Trang 2/);
    click('#view-table');assert.equal(d.querySelectorAll('tbody tr').length,3);
    click('[data-open]');assert.ok(d.querySelector('#editor')!.hasAttribute('open'));
    field('#edit-form','title','Tên sửa UI');field('#edit-form','language','vi');field('#edit-form','coverUrl','https://images.example/ui.jpg');submit('#edit-form');
    await wait(()=>!d.querySelector('#editor')!.hasAttribute('open'));
    assert.ok(d.querySelector('#items')!.textContent!.includes('Tên sửa UI'));
    const search=d.querySelector('#search') as HTMLInputElement;search.value='Tên sửa UI';search.dispatchEvent(new w.Event('input'));
    assert.equal(d.querySelectorAll('tbody tr').length,1);
    click('#select-all');(d.querySelector('#bulk-language') as HTMLInputElement).value='en';click('#bulk-apply');
    await wait(()=>d.querySelector('#notice')!.textContent!.includes('ngôn ngữ cho 1 sách'));
    assert.ok(d.querySelector('#items')!.textContent!.includes('English'));
    click('[data-open]');click('#reset-book');await wait(()=>!d.querySelector('#editor')!.hasAttribute('open'));
    search.value='';search.dispatchEvent(new w.Event('input'));assert.ok(!d.querySelector('#items')!.textContent!.includes('Tên sửa UI'));
    holdScan=true;click('#scan-start');await wait(()=>scanStarted);click('#scan-pause');holdScan=false;click('#scan-resume');
    await wait(()=>d.querySelector('#scan-status')!.textContent!.startsWith('Hoàn tất'));
    assert.match(d.querySelector('#scan-status')!.textContent!,/7 file sách/);assert.ok(d.querySelector('#items')!.textContent!.includes('Sách mẫu'));assert.ok(d.querySelector('#items')!.textContent!.includes('OPDS'));assert.ok(d.querySelector('#items')!.textContent!.includes('ước đoán'));
    assert.ok(!d.querySelector('#items')!.textContent!.includes(' · '+(d.querySelector('[data-book-delete]') as HTMLButtonElement).dataset.bookDelete));
    const externalDelete=d.querySelector('[data-book-delete]') as HTMLButtonElement,externalDownload=d.querySelector('a[href*="/sources/"][href*="/download?ref="]');assert.ok(externalDelete);assert.ok(externalDownload);
    assert.equal(d.querySelector('#items .book-source-code')!.textContent,'/m_TEST-123_Z');
    assert.equal(d.querySelector('#items [data-book-source-copy]'),null);
    click('#select-all');assert.equal(d.querySelector('#selected-count')!.textContent,'7 đã chọn');assert.equal((d.querySelector('#bulk-apply') as HTMLButtonElement).disabled,false);assert.equal((d.querySelector('#bulk-delete-opds') as HTMLButtonElement).hidden,false);assert.equal(d.querySelector('#bulk-delete-opds')!.parentElement?.className,'section-actions');
    (d.querySelector('[data-book-delete]') as HTMLButtonElement).click();await wait(()=>!d.querySelector('#items')!.textContent!.includes('Sách mẫu'));assert.ok(d.querySelector('#notice')!.textContent!.includes('Đã loại sách'));
    click('#sources-button');await wait(()=>d.querySelectorAll('.history-row').length===1);
    assert.match(d.querySelector('#hidden-history-status')!.textContent!,/Đã loại 1 sách/);
    assert.equal(d.querySelector('.history-row .book-source-code')!.textContent,'/m_TEST-123_Z');
    assert.equal(d.querySelector('#hidden-history-list [data-history-copy]'),null);
    click('[data-close="sources"]');
    click('#logout');await wait(()=>!(d.querySelector('#welcome') as HTMLElement).hidden);
    assert.equal(d.querySelector('#secret-values')!.textContent,'');assert.equal(d.querySelectorAll('#items .book').length,0);
    assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});
test('shared library URL opens a read-only searchable shelf without login',async()=>{
  const h=harness(),a=await h.signIn(await h.req('/api/libraries','POST',{name:'Kệ chia sẻ',drive:'https://catalog.example/opds',username:'owner',password:'long-password-123'}));
  const dom=new JSDOM(libraryHtml,{url:'https://library.example/?library='+a.library.id,runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.fetch=(async(path:string,init:any={})=>app.request('https://library.example'+path,{...init,headers:{Cookie:'',...init.headers}},h.env as any)) as any;
  const wait=async(predicate:()=>boolean)=>{for(let i=0;i<300&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(predicate(),'public shelf did not finish loading');};
  try{
    w.eval(libraryClient);
    await wait(()=>!(d.querySelector('#public-library') as HTMLElement).hidden&&d.querySelectorAll('#public-items .public-card').length>0);
    assert.equal((d.querySelector('#dashboard') as HTMLElement).hidden,true);
    assert.equal((d.querySelector('#welcome') as HTMLElement).hidden,true);
    assert.match(d.querySelector('#public-library-name')!.textContent!,/Kệ chia sẻ/);
    assert.ok(d.querySelector('#public-items')!.textContent!.includes('Sách mẫu'));
    assert.ok(d.querySelector('#public-items a[href*="/o/"]'));
    const input=d.querySelector('#public-search-input') as HTMLInputElement;input.value='Sách mẫu';
    d.querySelector('#public-search-form')!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await wait(()=>d.querySelector('#public-status')!.textContent!.includes('1 sách'));
    assert.ok(d.querySelector('#public-items')!.textContent!.includes('Sách mẫu'));
    input.value='khong-co-sach';
    d.querySelector('#public-search-form')!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await wait(()=>d.querySelector('#public-items')!.textContent!.includes('Không tìm thấy sách phù hợp'));
    assert.ok(!d.querySelector('#public-items')!.textContent!.includes('Sách mẫu'));
    (d.querySelector('#public-login') as HTMLButtonElement).click();
    assert.equal((d.querySelector('#welcome') as HTMLElement).hidden,false);
    assert.equal((d.querySelector('#public-library') as HTMLElement).hidden,true);
  }finally{dom.window.close();}
});
test('scan results show 50 books per page and selection stays on the visible page',async()=>{
  const original=tree.get(ROOT);
  tree.set(ROOT,Array.from({length:55},(_,i)=>rootItem('PAGE_BOOK_'+String(i).padStart(8,'0'),'Sách phân trang '+i+'.epub','application/epub+zip')));
  const h=harness(),a=await h.create();
  const dom=new JSDOM(libraryHtml,{url:'https://library.example/?library='+a.library.id,runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.AbortController=globalThis.AbortController as any;
  w.fetch=(async(path:string,init:any={})=>app.request('https://library.example'+path,{...init,headers:{Cookie:h.cookie,...(init.method&&init.method!=='GET'?{Origin:'https://library.example'}:{}),...init.headers}},h.env as any)) as any;
  try{
    w.eval(libraryClient);
    for(let i=0;i<300&&(d.querySelector('#dashboard') as HTMLElement).hidden;i++)await new Promise(resolve=>setTimeout(resolve,5));
    (d.querySelector('#scan-start') as HTMLButtonElement).click();
    for(let i=0;i<300&&!d.querySelector('#scan-status')!.textContent!.startsWith('Hoàn tất');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#scan-status')!.textContent!,/55 file sách/);
    assert.equal(d.querySelectorAll('#items .book').length,50);
    assert.equal(d.querySelector('#page-label')!.textContent,'Trang 1 / 2');
    (d.querySelector('#load-more') as HTMLButtonElement).click();
    assert.equal(d.querySelectorAll('#items .book').length,5);
    assert.equal(d.querySelector('#page-label')!.textContent,'Trang 2 / 2');
    (d.querySelector('#select-all') as HTMLInputElement).click();
    assert.equal(d.querySelector('#selected-count')!.textContent,'5 đã chọn');
    (d.querySelector('#page-prev') as HTMLButtonElement).click();
    assert.equal(d.querySelectorAll('#items .book').length,50);
    assert.equal((d.querySelector('#select-all') as HTMLInputElement).checked,false);
  }finally{tree.set(ROOT,original!);dom.window.close();}
});

test('reopened library identifies a failed saved OPDS URL and lets owner remove it',async()=>{
  const h=harness();const a=await h.signIn(await h.req('/api/libraries','POST',{name:'Nguồn lỗi',drive:'https://catalog.example/broken',username:'owner',password:'long-password-123'}));
  const dom=new JSDOM(libraryHtml,{url:'https://library.example/?library='+a.library.id,runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.confirm=()=>true;
  w.AbortController=globalThis.AbortController as any;
  w.fetch=(async(path:string,init:any={})=>path.endsWith('/scan')?new Response('<!DOCTYPE html><title>Upstream error</title>',{status:502,headers:{'Content-Type':'text/html'}}):app.request('https://library.example'+path,{...init,headers:{Cookie:h.cookie,...(init.method&&init.method!=='GET'?{Origin:'https://library.example'}:{}),...init.headers}},h.env as any)) as any;
  try{
    w.eval(libraryClient);
    for(let i=0;i<300&&!d.querySelector('#notice')!.textContent!.includes('Tạm thời không kết nối');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(!d.querySelector('#notice')!.textContent!.includes('https://catalog.example/broken'));
    assert.match(d.querySelector('#source-list')!.textContent!,/URL gốc: https:\/\/catalog\.example\/broken/);
    assert.match(d.querySelector('#source-list')!.textContent!,/Tạm thời không kết nối: Máy chủ phản hồi HTTP 502/);
    assert.ok(!d.querySelector('#notice')!.textContent!.includes('Unexpected token'));
    assert.equal((d.querySelector('#delete-failed-sources') as HTMLButtonElement).hidden,true);
    assert.match(d.querySelector('#source-list [data-source-delete]')!.getAttribute('aria-label')!,/Xóa nguồn/);
    (d.querySelector('#source-list [data-source-delete]') as HTMLButtonElement).click();
    for(let i=0;i<300&&d.querySelectorAll('#source-list .source-row').length;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(d.querySelectorAll('#source-list .source-row').length,0);
  }finally{dom.window.close();}
});

test('URL counters show unique links and the source form adds more than ten in batches',async()=>{
  const h=harness(),a=await h.create();
  const dom=new JSDOM(libraryHtml,{url:'https://library.example/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.confirm=()=>true;
  let cookie=h.cookie;
  w.fetch=(async(path:string,init:any={})=>{
    const response=await app.request('https://library.example'+path,{...init,headers:{Cookie:cookie,...(init.method&&init.method!=='GET'?{Origin:'https://library.example'}:{}),...init.headers}},h.env as any);
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie')!.split(';')[0];
    return response;
  }) as any;
  try{
    w.eval(libraryClient);
    const create=d.querySelector('#create textarea[name="drive"]') as HTMLTextAreaElement;
    create.value='https://catalog.example/opds\nhttps://catalog.example/opds';create.dispatchEvent(new w.Event('input'));
    assert.match(d.querySelector('#create-url-count')!.textContent!,/1 \/ 99 URL OPDS/);
    assert.match(d.querySelector('#create-url-count')!.textContent!,/1 dòng trùng/);
    create.value=Array.from({length:100},(_,i)=>`https://catalog.example/${i}`).join('\n');create.dispatchEvent(new w.Event('input'));
    assert.match(d.querySelector('#create-url-count')!.textContent!,/Vượt giới hạn/);
    const login=d.querySelector('#login') as HTMLFormElement;
    (login.elements.namedItem('libraryId') as HTMLInputElement).value=a.library.id;(login.elements.namedItem('username') as HTMLInputElement).value='owner';(login.elements.namedItem('password') as HTMLInputElement).value='  long-password-123  ';
    login.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&(d.querySelector('#dashboard') as HTMLElement).hidden;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal((d.querySelector('#dashboard') as HTMLElement).hidden,false);
    const source=d.querySelector('#source-form textarea[name="urls"]') as HTMLTextAreaElement;
    source.value=Array.from({length:11},(_,i)=>`https://catalog.example/opds?item=${i}`).join('\n');source.dispatchEvent(new w.Event('input'));
    assert.match(d.querySelector('#source-url-count')!.textContent!,/11 \/ 99 URL OPDS/);
    const form=d.querySelector('#source-form') as HTMLFormElement;
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&d.querySelector('#notice')!.textContent!=='Đã thêm và kiểm tra 11 nguồn OPDS.';i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(d.querySelector('#notice')!.textContent,'Đã thêm và kiểm tra 11 nguồn OPDS.');
    assert.equal(d.querySelector('#source-url-count')!.textContent,'Đã nhập 0 / 99 URL OPDS');
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources.length,11);
    assert.equal((d.querySelector('#delete-selected-sources') as HTMLButtonElement).textContent,'Xóa hàng loạt (0)');
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources[0].sourceUrl,'https://catalog.example/opds?item=0');
    assert.ok(d.querySelector('#source-list')!.textContent!.includes('https://catalog.example/opds?item=0'));
    const firstSource=d.querySelector('#source-list .source-row')!;
    assert.ok(firstSource.firstElementChild!.classList.contains('source-select'));
    assert.equal(firstSource.querySelector('.source-select')!.textContent,'');
    assert.ok(firstSource.querySelector('.source-select [data-source-select]'));
    assert.equal(d.querySelector('.source-bulk-actions')!.children.length,3);
    assert.equal((d.querySelector('.source-bulk-actions')!.firstElementChild as HTMLElement).id,'check-sources');
    assert.equal((d.querySelector('.source-bulk-actions')!.lastElementChild as HTMLElement).id,'delete-selected-sources');
    assert.deepEqual((await(await h.req(base(a)+'/sources/match','POST',{urls:['https://catalog.example/opds?item=0','https://catalog.example/new']})).json() as any).existing,[0]);
    source.value=Array.from({length:11},(_,i)=>`https://catalog.example/opds?item=${i}`).join('\n');
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&!d.querySelector('#source-form .form-error');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#source-form .form-error')!.textContent!,/11 URL OPDS đã có trong thư viện/);
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources.length,11);
    source.value=Array.from({length:11},(_,i)=>i===7?'https://catalog.example/invalid':i===8?'https://catalog.example/invalid-two':`https://catalog.example/extra?item=${i}`).join('\n');
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&!d.querySelector('[data-import-delete]');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#notice')!.textContent!,/Đã thêm 9 \/ 11 nguồn OPDS/);
    assert.match(d.querySelector('#source-import-errors')!.textContent!,/URL OPDS thứ 8/);
    assert.match(d.querySelector('#source-import-errors')!.textContent!,/https:\/\/catalog.example\/invalid/);
    assert.equal(source.value,'https://catalog.example/invalid\nhttps://catalog.example/invalid-two');
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources.length,20);
    (d.querySelector('[data-import-delete]') as HTMLButtonElement).click();
    assert.equal(source.value,'https://catalog.example/invalid-two');
    assert.equal(d.querySelector('[data-import-delete-all]'),null);
    source.value='https://catalog.example/invalid\nhttps://catalog.example/invalid-two';source.dispatchEvent(new w.Event('input'));
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&!d.querySelector('[data-import-delete-all]');i++)await new Promise(resolve=>setTimeout(resolve,5));
    source.value+='\nhttps://catalog.example/not-yet-submitted';source.dispatchEvent(new w.Event('input'));
    (d.querySelector('[data-import-delete-all]') as HTMLButtonElement).click();
    assert.equal(source.value,'https://catalog.example/not-yet-submitted');assert.equal(d.querySelector('#source-import-errors')!.textContent,'');
    source.value='https://catalog.example/broken\nhttps://catalog.example/broken-two';source.dispatchEvent(new w.Event('input'));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&d.querySelectorAll('#source-list .source-row').length<22;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(d.querySelectorAll('#source-list .source-row').length,22);
    unavailableStatus=400;unavailableSource=true;
    (d.querySelector('#check-sources') as HTMLButtonElement).click();
    for(let i=0;i<300&&!d.querySelector('#source-check-status')!.textContent!.includes('22 / 22');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#source-check-status')!.textContent!,/2 nguồn lỗi/);
    const bulk=d.querySelector('#delete-failed-sources') as HTMLButtonElement;assert.equal(bulk.hidden,false);
    bulk.click();
    for(let i=0;i<300&&d.querySelectorAll('#source-list .source-row').length!==20;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(d.querySelectorAll('#source-list .source-row').length,20);
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources.length,20);
    assert.equal(bulk.hidden,true);
    const choices=d.querySelectorAll('#source-list [data-source-select]');
    (choices[0] as HTMLInputElement).click();(d.querySelectorAll('#source-list [data-source-select]')[1] as HTMLInputElement).click();
    const selectedBulk=d.querySelector('#delete-selected-sources') as HTMLButtonElement;
    assert.equal(selectedBulk.textContent,'Xóa hàng loạt (2)');assert.equal(selectedBulk.disabled,false);
    selectedBulk.click();
    for(let i=0;i<300&&d.querySelectorAll('#source-list .source-row').length!==18;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal((await(await h.req(base(a)+'/sources')).json() as any).sources.length,18);
    assert.equal(selectedBulk.textContent,'Xóa hàng loạt (0)');
    (d.querySelector('#select-all-sources') as HTMLInputElement).click();
    assert.equal(selectedBulk.textContent,'Xóa hàng loạt (18)');
  }finally{unavailableSource=false;unavailableStatus=503;dom.window.close();}
});
test('creating a library with 25 OPDS links finishes import before opening credentials',async()=>{
  const h=harness(),dom=new JSDOM(libraryHtml,{url:'https://library.example/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  let cookie='';
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.AbortController=globalThis.AbortController as any;
  w.fetch=(async(path:string,init:any={})=>{
    if(path.includes('/sources')&&init.method==='POST')assert.equal(d.querySelector('#connection')!.hasAttribute('open'),false,'credentials dialog opens after the import');
    const response=await app.request('https://library.example'+path,{...init,headers:{...(cookie?{Cookie:cookie}:{}),...(init.method&&init.method!=='GET'?{Origin:'https://library.example'}:{}),...init.headers}},h.env as any);
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie')!.split(';')[0];
    return response;
  }) as any;
  try{
    w.eval(libraryClient);
    const form=d.querySelector('#create') as HTMLFormElement;
    (form.elements.namedItem('drive') as HTMLTextAreaElement).value=Array.from({length:25},(_,i)=>i===11?'https://catalog.example/invalid':`https://catalog.example/opds?create=${i}`).join('\n');
    (form.elements.namedItem('name') as HTMLInputElement).value='Kệ chung';
    (form.elements.namedItem('username') as HTMLInputElement).value='owner';
    (form.elements.namedItem('password') as HTMLInputElement).value='long-password-123';
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<300&&!d.querySelector('#notice')!.textContent!.includes('Đã thêm 24 / 25 nguồn OPDS');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#notice')!.textContent!,/Đã thêm 24 \/ 25 nguồn OPDS/);
    assert.equal(d.querySelector('#connection')!.hasAttribute('open'),true);
    assert.equal(d.querySelectorAll('#source-list .source-row').length,24);
    assert.equal((d.querySelector('#source-form textarea[name="urls"]') as HTMLTextAreaElement).value,'https://catalog.example/invalid');
    for(let i=0;i<300&&d.querySelectorAll('.book').length<24;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(d.querySelectorAll('.book').length>=24,'OPDS-only library loads books automatically');
    for(let i=0;i<300&&!d.querySelector('#scan-status')!.textContent!.includes('Hoàn tất');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(d.querySelector('#scan-status')!.textContent!,/Hoàn tất/);
    assert.equal((form.elements.namedItem('drive') as HTMLTextAreaElement).value,'');
  }finally{dom.window.close();}
});


test('legacy is opt-in; query credentials cannot replace server auth; private descriptions require auth', async()=>{
  const env={ENABLE_LEGACY_ROUTES:'true',AUTH_USER:'server',AUTH_PASS:'server-password'};
  const path='/feed/ROOT_LIBRARY_12345/opensearch.xml';
  for(const p of ['/legacy','/api/mask',path,'/download/BOOK_ID_0000000'])
    assert.equal((await app.request(p)).status,404);
  assert.equal((await app.request(path,{},env)).status,401);
  assert.equal((await app.request(path+'?auth='+btoa('attacker:chosen'),{headers:{Authorization:'Basic '+btoa('attacker:chosen')}},env)).status,410);
  const valid=await app.request(path,{headers:{Authorization:'Basic '+btoa('server:server-password')}},env);
  assert.equal(valid.status,200);assert.match(valid.headers.get('cache-control')!,/no-store/);
  assert.equal((await app.request(path,{}, {ENABLE_LEGACY_ROUTES:'true',AUTH_USER:'partial'})).status,401);
});
test('Drive input rejects foreign origins, credentials and oversized IDs',()=>{
  for(const input of ['https://evil.example/drive/folders/ROOT_LIBRARY_12345','https://drive.google.com.evil.example/open?id=ROOT_LIBRARY_12345','http://drive.google.com/open?id=ROOT_LIBRARY_12345','https://user@drive.google.com/open?id=ROOT_LIBRARY_12345','a'.repeat(61)]) assert.equal(extractFolderId(input),null);
  assert.equal(extractFolderId('https://drive.google.com/drive/folders/ROOT_LIBRARY_12345'),'ROOT_LIBRARY_12345');
});
test('peppered hashes require server secret and old hashes upgrade on login',async()=>{
  const h=harness(),a=await h.create();
  const stored=h.db.sqlite.prepare('SELECT password_hash FROM libraries').get()!.password_hash as string;
  assert.match(stored,/^p1\./);
  assert.equal(await checkPassword('  long-password-123  ',stored,'incorrect-secret'),false);
  h.db.sqlite.prepare('UPDATE libraries SET password_hash = ?').run(await hashPassword('old-test-password'));
  const login=await h.req('/api/session','POST',{libraryId:a.library.id,username:'owner',password:'old-test-password'});
  assert.equal(login.status,200);
  assert.match(h.db.sqlite.prepare('SELECT password_hash FROM libraries').get()!.password_hash as string,/^p1\./);
});
test('auth version rejects retained stale sessions and password verification racing revocation',async()=>{
  const h=harness(),a=await h.create();
  h.db.sqlite.prepare('UPDATE libraries SET auth_version = auth_version + 1').run();
  assert.equal((await h.req('/api/session')).status,401);
  const batch=h.db.batch.bind(h.db);
  h.db.batch=async statements=>{h.db.sqlite.prepare('UPDATE libraries SET auth_version = auth_version + 1').run();return batch(statements);};
  const raced=await h.req('/api/session','POST',{libraryId:a.library.id,username:'owner',password:'  long-password-123  '});
  assert.equal(raced.status,401);assert.equal(raced.headers.get('set-cookie'),null);
});
