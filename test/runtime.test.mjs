import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const outboundService = async request => {
  const url=new URL(request.url);
  assert.equal(url.origin,'https://www.googleapis.com');
  assert.equal(request.method,'GET');assert.equal(url.searchParams.has('alt'),false);
  if(url.pathname==='/drive/v3/files/ROOT_LIBRARY_12345') return Response.json({id:'ROOT_LIBRARY_12345',mimeType:'application/vnd.google-apps.folder'});
  assert.equal(url.pathname,'/drive/v3/files');
  return Response.json({files:[{id:'BOOK_FILE_1234567',name:'Runtime book.epub',mimeType:'application/epub+zip',size:'1234'}]});
};
const mf = new Miniflare(convertV4MiniflareOptions({
  modules:true,scriptPath:new URL('../dist/index.js',import.meta.url).pathname,
  compatibilityDate:'2024-09-23',compatibilityFlags:['nodejs_compat'],
  d1Databases:['DB'],bindings:{MASK_SECRET:'runtime-test-secret-01234567890123456789',GOOGLE_API_KEY:'test-only'},outboundService,
}));
try {
  const db=await mf.getD1Database('DB');
  const statements=readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort().map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n').split(';').map(s=>s.trim()).filter(s=>s&&!s.startsWith('PRAGMA'));
  await db.batch(statements.map(s=>db.prepare(s)));
  const origin='https://runtime.example';
  const created=await mf.dispatchFetch(origin+'/api/libraries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Runtime test',drive:'ROOT_LIBRARY_12345',username:'owner',password:'runtime-test-password'})});
  const data=await created.json();assert.equal(created.status,201,JSON.stringify(data));
  const cookie=created.headers.get('set-cookie').split(';')[0];assert.match(created.headers.get('set-cookie'),/Secure/);assert.match(created.headers.get('set-cookie'),/HttpOnly/);
  const base=origin+'/api/libraries/'+data.library.id;
  const browse=await mf.dispatchFetch(base+'/items',{headers:{Cookie:cookie}});assert.equal(browse.status,200);
  const book=(await browse.json()).items[0];
  const updated=await mf.dispatchFetch(base+'/books/'+book.key,{method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':data.csrf},body:JSON.stringify({ref:book.ref,title:'Tên sửa',language:'vi',author:'Tác giả',coverUrl:'https://images.example/book.png'})});
  assert.equal(updated.status,200,await updated.text());
  const feed=await mf.dispatchFetch(data.opds.url,{headers:{Authorization:'Basic '+btoa('reader:'+data.opds.password)}});assert.equal(feed.status,200);const xml=await feed.text();assert.match(xml,/Tên sửa.epub/);assert.match(xml,/<dc:language>vi<\/dc:language>/);
  const rows=await db.prepare('SELECT data FROM book_overrides WHERE library_id = ?').bind(data.library.id).all();assert.equal(rows.results.length,1);
  console.log('PASS: bundled Worker, real local D1 migration, Web Crypto, session cookies, metadata update and OPDS XML.');
} finally {await mf.dispose();}
