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
import { libraryHtml } from '../src/library-ui';

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
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
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
  new Script(libraryClient);
});
test('creation uses encrypted source and hashes; session CSRF, Origin and account boundaries enforced', async()=>{
  const h=harness();const a=await h.create();
  const stored=h.db.sqlite.prepare('SELECT * FROM libraries').get()!;
  assert.ok(!JSON.stringify(stored).includes(ROOT));
  assert.ok(!JSON.stringify(stored).includes('long-password'));assert.ok(!JSON.stringify(stored).includes(a.opds.password));
  assert.match(stored.root_token as string,/^m_/);
  assert.match(a.library.shortId,/^[\w-]{12}$/);
  assert.equal(a.opds.url,'https://library.example/o/'+a.library.shortId);
  assert.equal((await h.req(base(a)+'/items')).status,200);
  assert.equal((await h.req('/api/libraries/another/items')).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {Origin:'https://other.example'})).status,403);
  assert.equal((await h.req(base(a)+'/opds-credentials','POST',{}, {Origin:''})).status,403);
  const noSession=await h.req(base(a)+'/items','GET',undefined,{Cookie:'',...auth(a)});assert.equal(noSession.status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds?auth='+btoa('attacker:pass'),'GET',undefined,{Authorization:'Basic '+btoa('attacker:pass')})).status,401);
  assert.equal((await h.req('/library/'+a.library.id+'/opds')).status,401);
  assert.equal((await h.req('/o/'+a.library.shortId)).status,401);
  const csrfRes=await h.req('/api/session');assert.match(csrfRes.headers.get('cache-control')!,/no-store/);
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
  const rec=await h.signIn(await h.req('/api/recovery','POST',{libraryId:a.library.id,code:a.recoveryCode,password:'recovered-password-123'}));
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
  const wait=async(predicate:()=>boolean)=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.fail('UI condition timed out: '+d.querySelector('#notice')!.textContent+' / '+errors.map(String).join(';'));};
  const field=(form:string,name:string,value:string)=>{(d.querySelector(form) as HTMLFormElement).elements.namedItem(name).value=value;};
  const submit=(id:string)=>d.querySelector(id)!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const click=(id:string)=>(d.querySelector(id) as HTMLButtonElement).click();
  try {
    w.eval(libraryClient);
    field('#create','drive',ROOT);field('#create','name','Thư viện UI');field('#create','username','owner');field('#create','password','ui-password-12345');submit('#create');
    await wait(()=>d.querySelectorAll('.book').length===3&&d.querySelector('#connection')!.hasAttribute('open'));
    assert.ok(d.querySelector('#secret-values')!.textContent!.includes('reader'));
    click('[data-close="connection"]');click('#load-more');await wait(()=>d.querySelectorAll('.book').length===6);
    click('#view-table');assert.equal(d.querySelectorAll('tbody tr').length,6);
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
    assert.match(d.querySelector('#scan-status')!.textContent!,/6 file sách/);
    click('#logout');await wait(()=>!(d.querySelector('#welcome') as HTMLElement).hidden);
    assert.equal(d.querySelector('#secret-values')!.textContent,'');assert.equal(d.querySelectorAll('#items .book').length,0);
    assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
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
