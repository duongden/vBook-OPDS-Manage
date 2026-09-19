import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/index.js';
const env={OPDS_USERNAME:'reader',OPDS_PASSWORD:'test-only-password'};
const auth='Basic '+btoa(env.OPDS_USERNAME+':'+env.OPDS_PASSWORD);
const req=(path,headers={},method='GET',config=env)=>worker.fetch(new Request('https://private.example'+path,{method,headers}),config);
test('fails closed without configuration',async()=>assert.equal((await req('/opds',{},'GET',{})).status,503));
test('all sensitive routes require authentication',async()=>{
 for(const path of ['/','/api/books','/api/status','/opds','/opds?page=2','/opds/search.xml','/opds/books/cartographers-garden','/covers/cartographers-garden.svg','/books/cartographers-garden.epub']){
  for(const headers of [{},{Authorization:'Basic invalid'},{Authorization:'Basic '+btoa('reader:wrong')}]){
   const r=await req(path,headers);assert.equal(r.status,401,path);assert.match(r.headers.get('WWW-Authenticate'),/^Basic/);assert.ok(!(await r.text()).includes('An unfinished map'));
  }
 }
});
test('browser, catalog, pagination, search and non-Latin search work',async()=>{
 const h={Authorization:auth};
 const page=await req('/',h);assert.equal(page.status,200);assert.match(await page.text(),/On the shelves/);
 const all=await(await req('/api/books',h)).json();assert.equal(all.books.length,8);assert.ok(all.books.every(b=>b.sample&&!b.epub));
 for(const [query,num] of [['',6],['?page=2',2],['?q=Cartographer',1],['?language=fr',2],['?category=Poetry',2],['?q=NOTFOUND',0],['?page=-1',6],['?page=Infinity',6]]){
  const r=await req('/opds'+query,h);assert.equal(r.status,200);const xml=await r.text();assert.equal((xml.match(/<entry>/g)||[]).length,num,query);assert.match(r.headers.get('content-type'),/application\/atom\+xml/);assert.ok(!xml.includes('localhost'));
 }
 const vietnamese=await(await req('/api/books?q='+encodeURIComponent('Mùa gió'),h)).json();assert.equal(vietnamese.books.length,1);
 const xml=await(await req('/opds?q='+encodeURIComponent('<script>&"'),h)).text();assert.ok(!xml.includes('<script>'));
});
test('all samples have working entry, cover and EPUB acquisition',async()=>{
 const h={Authorization:auth};const {books}=await(await req('/api/books',h)).json();
 for(const b of books){
  const entry=await req('/opds/books/'+b.id,h);assert.equal(entry.status,200);assert.match(await entry.text(),/acquisition\/open-access/);
  const cover=await req('/covers/'+b.id+'.svg',h);assert.equal(cover.status,200);assert.match(await cover.text(),/<svg/);
  const epub=await req('/books/'+b.id+'.epub',h);assert.equal(epub.status,200);assert.equal(epub.headers.get('content-type'),'application/epub+zip');const bytes=new Uint8Array(await epub.arrayBuffer());assert.equal(bytes.length,b.size);assert.equal(bytes[0],80);assert.equal(bytes[1],75);
 }
});
test('HEAD, not-found, unsupported methods and private cache headers',async()=>{
 const h={Authorization:auth};const r=await req('/opds',h,'HEAD');assert.equal(r.status,200);assert.equal(await r.text(),'');assert.match(r.headers.get('cache-control'),/private, no-store/);
 assert.equal((await req('/books/not-a-book.epub',h)).status,404);assert.equal((await req('/opds',h,'POST')).status,405);
});
