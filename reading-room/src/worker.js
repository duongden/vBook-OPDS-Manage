const BOOKS=/*__BOOKS__*/;
const APP=/*__APP__*/;
const TYPE='application/atom+xml;profile=opds-catalog;kind=acquisition';
const UPDATED='2026-09-16T00:00:00Z';
const esc=v=>String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const clean=b=>{const {epub,...rest}=b;return rest};
function filtered(params){
 const q=(params.get('q')||'').trim().toLocaleLowerCase();
 return BOOKS.filter(b=>(!q||[b.title,b.author,b.summary,b.category].some(v=>v.toLocaleLowerCase().includes(q)))&&(!params.get('language')||b.language===params.get('language'))&&(!params.get('category')||b.category===params.get('category'))).sort((a,b)=>params.get('sort')==='title'?a.title.localeCompare(b.title):params.get('sort')==='author'?a.author.localeCompare(b.author)||a.title.localeCompare(b.title):0);
}
function entry(b,base,standalone=false){return `<entry${standalone?' xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/"':''}>
 <id>urn:reading-room:entry:${b.id}</id><title>${esc(b.title)} (Sample)</title><updated>${b.updated}</updated>
 <author><name>${esc(b.author)}</name></author><dc:language>${b.language}</dc:language><dc:issued>${b.issued}</dc:issued><dc:publisher>Reading Room</dc:publisher><dc:identifier>urn:reading-room:book:${b.id}</dc:identifier>
 <category term="${esc(b.category)}" label="${esc(b.category)}"/><category term="sample" label="Sample book"/>
 <summary type="text">SAMPLE — Original short demonstration text. ${esc(b.summary)}</summary><rights>${esc(b.rights)}</rights>
 <link rel="alternate" type="text/html" href="${esc(base)}/?book=${b.id}"/>
 <link rel="alternate" type="application/atom+xml;type=entry;profile=opds-catalog" href="${esc(base)}/opds/books/${b.id}"/>
 <link rel="http://opds-spec.org/image" type="image/svg+xml" href="${esc(base)}/covers/${b.id}.svg"/>
 <link rel="http://opds-spec.org/image/thumbnail" type="image/svg+xml" href="${esc(base)}/covers/${b.id}.svg"/>
 <link rel="http://opds-spec.org/acquisition/open-access" type="application/epub+zip" href="${esc(base)}/books/${b.id}.epub" length="${b.size}"/>
</entry>`}
function feed(url){
 const base=url.origin;const results=filtered(url.searchParams);const query=url.searchParams.toString();
 const pageRaw=Number(url.searchParams.get('page')||1);const page=Number.isSafeInteger(pageRaw)&&pageRaw>0?pageRaw:1;const per=6;const selected=results.slice((page-1)*per,page*per);
 const pageLink=p=>{const u=new URL(url);u.pathname='/opds';u.searchParams.set('page',p);return esc(u.href)};
 return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
 <id>${esc(base)}/opds${query?'?'+esc(query):''}</id><title>Reading Room · ${url.searchParams.get('q')?'Search results':'Sample library'}</title><updated>${UPDATED}</updated>
 <author><name>Reading Room</name></author><subtitle>Eight original sample books. Private catalog.</subtitle>
 <link rel="self" type="${TYPE}" href="${esc(base)}/opds${query?'?'+esc(query):''}"/>
 <link rel="start" type="${TYPE}" href="${esc(base)}/opds"/>
 <link rel="search" type="application/opensearchdescription+xml" href="${esc(base)}/opds/search.xml"/>
 ${page>1?`<link rel="previous" type="${TYPE}" href="${pageLink(page-1)}"/>`:''}
 ${page*per<results.length?`<link rel="next" type="${TYPE}" href="${pageLink(page+1)}"/>`:''}
 <opensearch:totalResults>${results.length}</opensearch:totalResults><opensearch:startIndex>${(page-1)*per+1}</opensearch:startIndex><opensearch:itemsPerPage>${per}</opensearch:itemsPerPage>
 ${['en','fr','vi'].map(l=>`<link rel="http://opds-spec.org/facet" type="${TYPE}" opds:facetGroup="Language" ${url.searchParams.get('language')===l?'opds:activeFacet="true" ':''}title="${{en:'English',fr:'French',vi:'Vietnamese'}[l]}" href="${esc(base)}/opds?language=${l}"/>`).join('\n ')}
 ${selected.map(b=>entry(b,base)).join('\n')}
</feed>`;
}
function cover(b){
 const c=b.accent;let art='';
 if(b.pattern==='garden'||b.pattern==='leaves')art=`<path d="M150 305Q137 242 158 185M151 270Q100 265 98 228Q136 228 151 270M151 244Q197 231 197 195Q160 200 151 244M152 291Q204 284 215 253Q173 252 152 291" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="150" cy="244" r="82" fill="none" stroke="${c}" stroke-opacity=".35"/>`;
 if(b.pattern==='waves')art=Array.from({length:9},(_,i)=>`<path d="M28 ${196+i*13}Q89 ${155+i*13} 150 ${196+i*13}T272 ${196+i*13}" fill="none" stroke="${c}" stroke-opacity="${.4+i*.06}" stroke-width="1.7"/>`).join('');
 if(b.pattern==='windows')art=Array.from({length:6},(_,i)=>`<path d="M${66+i%3*59} ${190+Math.floor(i/3)*65}v-16a19 19 0 0138 0v16z" fill="none" stroke="${c}" stroke-width="1.5"/>`).join('');
 if(b.pattern==='rain')art=`<path d="M90 275v-64l60-52 60 52v64z" fill="none" stroke="${c}" stroke-width="2"/>`+Array.from({length:30},(_,i)=>`<path d="M${39+(i*37)%227} ${183+(i*29)%143}l-5 10" stroke="${c}" stroke-opacity=".45"/>`).join('');
 if(b.pattern==='moon')art=`<circle cx="150" cy="244" r="70" fill="${c}"/><circle cx="175" cy="221" r="61" fill="${b.color}"/><path d="M40 324h220" stroke="${c}" stroke-opacity=".4"/>`;
 if(b.pattern==='stars')art=`<rect x="96" y="185" width="108" height="136" rx="54" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M150 190v130M99 253h102" stroke="${c}" stroke-opacity=".5"/>`+Array.from({length:11},(_,i)=>`<circle cx="${43+(i*53)%221}" cy="${170+(i*31)%166}" r="${i%2+1}" fill="${c}"/>`).join('');
 const words=b.title.split(' ');let lines=[],line='';for(const w of words){if((line+' '+w).length>20){lines.push(line);line=w}else line+=(line?' ':'')+w}lines.push(line);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="430" viewBox="0 0 300 430" role="img" aria-label="${esc(b.title)} sample cover"><rect width="300" height="430" fill="${b.color}"/><path d="M9 0v430" stroke="#000" stroke-opacity=".18" stroke-width="8"/><rect x="23" y="23" width="254" height="384" fill="none" stroke="${c}" stroke-opacity=".35"/><text x="150" y="56" text-anchor="middle" font-family="sans-serif" font-size="8" letter-spacing="3" fill="${c}">READING ROOM EDITIONS</text>${lines.map((l,i)=>`<text x="150" y="${94+i*31}" text-anchor="middle" font-family="Georgia,serif" font-size="25" fill="${c}">${esc(l)}</text>`).join('')}${art}<text x="150" y="372" text-anchor="middle" font-family="sans-serif" font-size="9" letter-spacing="2" fill="${c}">ORIGINAL SAMPLE</text><text x="150" y="391" text-anchor="middle" font-family="sans-serif" font-size="8" letter-spacing="1" fill="${c}">${b.language.toUpperCase()} · READING ROOM STUDIO</text></svg>`;
}
async function equal(a,b){const enc=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);let d=0;const u=new Uint8Array(x),v=new Uint8Array(y);for(let i=0;i<u.length;i++)d|=u[i]^v[i];return d===0}
function response(body,type,status=200,extra={}){return new Response(body,{status,headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',...extra}})}
async function route(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(p==='/robots.txt')return response('User-agent: *\nDisallow: /\n','text/plain');
 if(!env.OPDS_USERNAME||!env.OPDS_PASSWORD)return response('Private library is not configured. Set OPDS_USERNAME and OPDS_PASSWORD.','text/plain',503);
 let supplied='';try{const h=req.headers.get('Authorization')||'';if(/^Basic /i.test(h))supplied=atob(h.slice(6))}catch{}
 if(!await equal(supplied,env.OPDS_USERNAME+':'+env.OPDS_PASSWORD))return response(JSON.stringify({id:url.origin+'/auth',title:'Reading Room',authentication:[{type:'http://opds-spec.org/auth/basic',labels:{login:'Username',password:'Password'}}]}),'application/opds-authentication+json',401,{'WWW-Authenticate':'Basic realm="Reading Room", charset="UTF-8"'});
 if(!['GET','HEAD'].includes(req.method))return response('Method not allowed','text/plain',405,{'Allow':'GET, HEAD'});
 if(p==='/')return response(APP,'text/html; charset=utf-8',200,{'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self'"});
 if(p==='/api/books')return response(JSON.stringify({books:filtered(url.searchParams).map(clean),updated:UPDATED}),'application/json; charset=utf-8');
 if(p==='/api/status')return response(JSON.stringify({auth:'basic',readerAccess:'basic-auth',feed:'/opds',sampleCount:BOOKS.length,updated:UPDATED}),'application/json');
 if(p==='/opds'||p==='/opds/')return response(feed(url),TYPE+';charset=utf-8');
 if(p==='/opds/search.xml')return response(`<?xml version="1.0" encoding="UTF-8"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>Reading Room</ShortName><Description>Search the private sample library</Description><InputEncoding>UTF-8</InputEncoding><Url type="${TYPE}" template="${esc(url.origin)}/opds?q={searchTerms}"/></OpenSearchDescription>`,'application/opensearchdescription+xml; charset=utf-8');
 let m=p.match(/^\/opds\/books\/([a-z0-9-]+)$/);if(m){const b=BOOKS.find(x=>x.id===m[1]);return b?response('<?xml version="1.0" encoding="UTF-8"?>'+entry(b,url.origin,true),'application/atom+xml;type=entry;profile=opds-catalog;charset=utf-8'):response('Book not found','text/plain',404)}
 m=p.match(/^\/covers\/([a-z0-9-]+)\.svg$/);if(m){const b=BOOKS.find(x=>x.id===m[1]);return b?response(cover(b),'image/svg+xml; charset=utf-8'):response('Cover not found','text/plain',404)}
 m=p.match(/^\/books\/([a-z0-9-]+)\.epub$/);if(m){const b=BOOKS.find(x=>x.id===m[1]);return b?response(Uint8Array.from(atob(b.epub),c=>c.charCodeAt(0)),'application/epub+zip',200,{'Content-Disposition':`attachment; filename="${b.id}-sample.epub"`,'Content-Length':String(b.size)}):response('Book not found','text/plain',404)}
 return response('Not found','text/plain',404);
}
export default {async fetch(req,env={}){const res=await route(req,env);return req.method==='HEAD'?new Response(null,{status:res.status,headers:res.headers}):res;}};
