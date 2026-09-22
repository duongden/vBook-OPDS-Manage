// Served as an external script; no user metadata is interpolated into executable code.
export const libraryClient = String.raw`
'use strict';
const $ = s => document.querySelector(s);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const langName = value => ({vi:'Tiếng Việt',en:'English',fr:'Français','zh-Hans':'中文',ja:'日本語',ko:'한국어'}[value] || value || 'Chưa rõ');
const sizeName = value => {if(value === undefined || value === '')return '—';let n=Number(value),u=0;const units=['B','KB','MB','GB'];while(n>=1024&&u<3){n/=1024;u++;}return n.toLocaleString('vi',{maximumFractionDigits:1})+' '+units[u];};
function savedTheme(){try{const value=localStorage.getItem('vbook-theme');if(value==='light'||value==='dark')return value;}catch{}return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
function applyTheme(theme,persist=false){document.documentElement.dataset.theme=theme;const toggle=$('#theme-toggle'),dark=theme==='dark';toggle.textContent=dark?'☀':'☾';toggle.setAttribute('aria-pressed',String(dark));toggle.setAttribute('aria-label',dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối');toggle.title=dark?'Giao diện sáng':'Giao diện tối';if(persist)try{localStorage.setItem('vbook-theme',theme);}catch{}}
let theme=savedTheme();applyTheme(theme);
let library=null,csrf='',pageItems=new Map(),scanItems=new Map(),selected=new Set(),view='grid',scanMode=false;
let trail=[],nextCursor=null,busy=false,editing=null,scanQueue=[],scanSeen=new Set(),scanRunning=false,scanComplete=false,scanPages=0,scanController=null;
let activeOpds=null,recoveryCode='',requestEpoch=0,scanEpoch=0,sources=[];
const svgIcon=name=>({
 copy:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
 trash:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
 download:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
}[name]||'');
function notice(message,error=false){const el=$('#notice');el.textContent=message;el.classList.toggle('error',error);el.hidden=!message;}
async function api(path,method='GET',body,signal){
 const headers={};if(method!=='GET'){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
 const response=await fetch(path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body),signal});
 const data=await response.json();if(!response.ok){const error=new Error(data.error||'Không xử lý được yêu cầu.');error.status=response.status;throw error;}return data;
}
const endpoint = suffix => '/api/libraries/'+library.id+suffix;
function tab(name){document.querySelectorAll('.access-form').forEach(f=>f.hidden=f.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));}
function showSecrets(data){if(data.opds)activeOpds=data.opds;if(data.recoveryCode)recoveryCode=data.recoveryCode;renderConnection();$('#connection').showModal();}
function renderConnection(){
 if(!library)return;$('#opds-url').value=location.origin+(library.shortId?'/o/'+library.shortId:'/library/'+library.id+'/opds');
 $('#secret-values').innerHTML='<div class="secret">Mã thư viện<code>'+escapeHtml(library.id)+'</code></div>'+
 (activeOpds?'<div class="secret">Tài khoản OPDS: <strong>reader</strong><br>Mật khẩu OPDS (lưu lại ngay)<code>'+escapeHtml(activeOpds.password)+'</code></div>':'')+
 (recoveryCode?'<div class="secret">Mã khôi phục — lưu riêng, không nhập vào vBook<code>'+escapeHtml(recoveryCode)+'</code></div>':'');
}
function renderSources(){
 $('#source-count').textContent=String(sources.length+(library?.hasDrive?1:0));
 $('#drive-status').textContent=library?.hasDrive?'Đã kết nối một thư mục Drive. Dán link mới bên dưới để thay thế.':'Chưa kết nối thư mục Drive.';
 $('#drive-save').textContent=library?.hasDrive?'Thay thư mục Drive':'Thêm thư mục Drive';$('#drive-remove').hidden=!library?.hasDrive;
 $('#source-list').innerHTML=sources.length?sources.map(source=>'<article class="source-row"><div><h3>'+escapeHtml(source.name)+'</h3><p>'+escapeHtml(source.host)+(source.hasCredentials?' · Có xác thực':' · Công khai')+'</p><p class="muted">'+escapeHtml(source.url)+'</p></div><div class="source-actions"><label class="source-enabled"><input type="checkbox" data-source-toggle="'+escapeHtml(source.id)+'" '+(source.enabled?'checked':'')+'> Bật</label><button class="icon-button" data-source-copy="'+escapeHtml(source.id)+'" aria-label="Sao chép link '+escapeHtml(source.name)+'" title="Sao chép link">'+svgIcon('copy')+'</button><button class="icon-button danger" data-source-delete="'+escapeHtml(source.id)+'" aria-label="Xóa nguồn '+escapeHtml(source.name)+'" title="Xóa nguồn">'+svgIcon('trash')+'</button></div></article>').join(''):'<p class="muted">Chưa có nguồn OPDS.</p>';
}
async function loadSources(){
 if(!library)return;sources=(await api(endpoint('/sources'))).sources;renderSources();
}
async function enter(data){
 library=data.library;csrf=data.csrf;pageItems.clear();scanItems.clear();selected.clear();trail=[];scanMode=false;scanComplete=false;scanQueue=[];scanSeen.clear();scanPages=0;
 $('#welcome').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false;$('#account-button').hidden=false;$('#library-name').textContent=library.name;
 history.replaceState(null,'','/?library='+encodeURIComponent(library.id));
 $('#account-info').textContent='Mã thư viện: '+library.id+' · Tên đăng nhập: '+library.username;
 $('#scan-status').textContent='Chưa quét toàn thư viện. Số liệu hiện chỉ thuộc dữ liệu đã tải.';scanControls();
 notice('');await Promise.all([browse(false),loadSources()]);if(data.opds||data.recoveryCode)showSecrets(data);
}
function leave(){
 pauseScan();requestEpoch++;library=null;csrf='';activeOpds=null;recoveryCode='';sources=[];pageItems.clear();scanItems.clear();selected.clear();editing=null;scanQueue=[];scanSeen.clear();
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#secret-values').replaceChildren();$('#items').replaceChildren();$('#edit-form').reset();
 $('#welcome').hidden=false;$('#dashboard').hidden=true;$('#logout').hidden=true;$('#account-button').hidden=true;tab('login');
}
function coverMarkup(book){return '<div class="cover"><div class="fallback"><strong>'+escapeHtml(book.isFolder?'Thư mục':book.format)+'</strong><small>'+escapeHtml(book.isFolder?book.title:'Chưa có bìa')+'</small></div>'+(book.coverUrl?'<img src="'+escapeHtml(book.coverUrl)+'" alt="Bìa '+escapeHtml(book.title)+'" loading="lazy" referrerpolicy="no-referrer">':'')+'</div>';}
function attachImageFallback(container){container.querySelectorAll('img').forEach(img=>{img.addEventListener('error',()=>{img.remove();});});}
function source(){return scanMode?scanItems:pageItems;}
function downloadHref(book){return book.external?endpoint('/sources/'+encodeURIComponent(book.sourceId)+'/download')+'?ref='+encodeURIComponent(book.ref):endpoint('/books/'+encodeURIComponent(book.key)+'/download')+'?ref='+encodeURIComponent(book.ref);}
function rowActions(book){
 if(book.isFolder)return '<button data-open="'+escapeHtml(book.key)+'">Mở</button>';
 const download=book.ref?'<a class="icon-button action-button" href="'+escapeHtml(downloadHref(book))+'" aria-label="Tải '+escapeHtml(book.title)+'" title="Tải sách">'+svgIcon('download')+'</a>':'';
 const remove=book.external?'<button class="icon-button danger" data-book-delete="'+escapeHtml(book.key)+'" aria-label="Loại '+escapeHtml(book.title)+'" khỏi catalog" title="Loại khỏi catalog">'+svgIcon('trash')+'</button>':'<button data-open="'+escapeHtml(book.key)+'">Sửa</button>';
 return '<div class="row-actions">'+download+remove+'</div>';
}
function filtered(){
 const q=$('#search').value.trim().toLocaleLowerCase(),language=$('#language').value,format=$('#format').value;
 return [...source().values()].filter(b=>(!q||[b.title,b.name,b.author,b.description,b.category].some(v=>v.toLocaleLowerCase().includes(q)))&&(!language||(language==='unknown'?!b.language:b.language===language))&&(!format||b.format===format)).sort((a,b)=>{
  if(a.isFolder!==b.isFolder)return a.isFolder?-1:1;const sort=$('#sort').value;
  if(sort==='size')return Number(b.size||0)-Number(a.size||0);
  return (sort==='author'?a.author.localeCompare(b.author,'vi'):0)||a.title.localeCompare(b.title,'vi');
 });
}
function fillFilters(){
 const books=[...source().values()].filter(b=>!b.isFolder);const lang=$('#language').value,format=$('#format').value;
 $('#language').innerHTML='<option value="">Tất cả</option><option value="unknown">Chưa rõ</option>'+[...new Set(books.map(b=>b.language).filter(Boolean))].sort().map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(langName(v))+'</option>').join('');
 $('#format').innerHTML='<option value="">Tất cả</option>'+[...new Set(books.map(b=>b.format))].sort().map(v=>'<option>'+escapeHtml(v)+'</option>').join('');
 $('#language').value=[...$('#language').options].some(o=>o.value===lang)?lang:'';$('#format').value=[...$('#format').options].some(o=>o.value===format)?format:'';
}
function render(){
 const all=[...source().values()],books=all.filter(b=>!b.isFolder),list=filtered();
 const counts=[['Sách trong kết quả',books.length],['Định dạng',new Set(books.map(b=>b.format)).size],['Chưa có ngôn ngữ',books.filter(b=>!b.language).length],['Chưa có nguồn bìa',books.filter(b=>!b.coverUrl).length]];
 $('#stats').innerHTML=counts.map(([label,count])=>'<div class="stat"><strong>'+count.toLocaleString('vi')+'</strong><span>'+label+'</span></div>').join('');
 const formats={};books.forEach(b=>formats[b.format]=(formats[b.format]||0)+1);$('#formats').textContent=Object.entries(formats).map(([k,v])=>k+': '+v).join(' · ');
 $('#result-count').textContent=list.length+' mục hiển thị · '+(scanMode?(scanComplete?'Toàn thư viện, theo lần quét vừa xong':'Kết quả quét chưa đầy đủ'):'Thư mục hiện tại, dữ liệu đã tải');
 $('#breadcrumbs').innerHTML='<button data-crumb="-1">Thư viện</button>'+(scanMode?'<span>/ Kết quả quét</span>':trail.map((t,i)=>'<span>/</span><button data-crumb="'+i+'">'+escapeHtml(t.title)+'</button>').join(''));
 if(!list.length)$('#items').innerHTML='<div class="empty">'+(busy?'Đang lấy danh sách nguồn…':'Chưa có mục phù hợp. Thử thay đổi bộ lọc hoặc quét lại các nguồn.')+'</div>';
 else if(view==='grid')$('#items').innerHTML='<div class="books">'+list.map(b=>'<article class="book '+(b.isFolder?'folder':'')+'">'+(!b.isFolder?'<label class="check"><input type="checkbox" data-select="'+escapeHtml(b.key)+'" '+(selected.has(b.key)?'checked':'')+'> Chọn sách</label>':'')+'<button class="book-open" data-open="'+escapeHtml(b.key)+'">'+coverMarkup(b)+'<span class="book-title">'+escapeHtml(b.title)+'</span></button><div class="book-author">'+escapeHtml(b.author||b.sourceName|| (b.isFolder?'Mở thư mục':'Chưa có tác giả'))+'</div>'+(!b.isFolder?'<div class="book-meta"><span class="badge">'+escapeHtml(b.external?'OPDS':b.format)+'</span><span>'+escapeHtml(langName(b.language))+'</span><span>'+sizeName(b.size)+'</span></div>'+rowActions(b):'')+'</article>').join('')+'</div>';
 else $('#items').innerHTML='<div class="table-wrap"><table><thead><tr><th>Chọn</th><th>Tên sách / mã mục</th><th>Ngôn ngữ</th><th>Định dạng</th><th>Dung lượng</th><th></th></tr></thead><tbody>'+list.map(b=>'<tr><td>'+(!b.isFolder?'<input aria-label="Chọn '+escapeHtml(b.title)+'" type="checkbox" data-select="'+escapeHtml(b.key)+'" '+(selected.has(b.key)?'checked':'')+'>':'')+'</td><td><div class="table-title">'+(b.coverUrl?'<img class="thumb" alt="" src="'+escapeHtml(b.coverUrl)+'" referrerpolicy="no-referrer" loading="lazy">':'')+'<div><button data-open="'+escapeHtml(b.key)+'">'+escapeHtml(b.title)+'</button><small>'+escapeHtml(b.author||b.sourceName)+'</small><small>'+(b.external?'<span class="badge">OPDS</span> · ':'')+escapeHtml(b.key)+'</small></div></div></td><td>'+escapeHtml(b.isFolder?'—':langName(b.language))+'</td><td>'+escapeHtml(b.isFolder?'Thư mục':b.format)+'</td><td>'+sizeName(b.size)+'</td><td>'+rowActions(b)+'</td></tr>').join('')+'</tbody></table></div>';
 attachImageFallback($('#items'));$('#load-more').hidden=scanMode||!nextCursor;$('#load-more').disabled=busy;
 const selectedItems=[...selected].map(key=>source().get(key)).filter(Boolean),selectedDrive=selectedItems.filter(b=>!b.external),selectedOpds=selectedItems.filter(b=>b.external);
 $('#selected-count').textContent=selectedItems.length+' đã chọn';$('#bulk-apply').disabled=!selectedDrive.length||busy;$('#bulk-delete-opds').hidden=!selectedOpds.length;$('#bulk-delete-opds').disabled=busy;
 const visibleBooks=list.filter(b=>!b.isFolder);$('#select-all').checked=visibleBooks.length>0&&visibleBooks.every(b=>selected.has(b.key));
 $('#select-all').indeterminate=visibleBooks.some(b=>selected.has(b.key))&&!$('#select-all').checked;
}
async function browse(append){
 const epoch=++requestEpoch;busy=true;scanMode=false;if(!append){pageItems.clear();selected.clear();nextCursor=null;}render();
 try{
  const params=new URLSearchParams();if(trail.length)params.set('folder',trail[trail.length-1].ref);if(append&&nextCursor)params.set('cursor',nextCursor);
  const data=await api(endpoint('/items')+(params.size?'?'+params:''));if(epoch!==requestEpoch||!library)return;
  data.items.forEach(b=>pageItems.set(b.key,b));nextCursor=data.nextCursor;fillFilters();
 }catch(error){if(epoch===requestEpoch)notice(error.message,true);}
 finally{if(epoch===requestEpoch){busy=false;render();}}
}
function scanControls(){$('#scan-pause').hidden=!scanRunning;$('#scan-resume').hidden=scanRunning||!scanQueue.length;$('#scan-results').hidden=!scanPages;$('#scan-start').disabled=scanRunning;}
function pauseScan(){scanEpoch++;scanRunning=false;if(scanController)scanController.abort();scanController=null;scanControls();}
async function scanLoop(){
 if(scanRunning||!scanQueue.length)return;scanRunning=true;scanMode=true;requestEpoch++;busy=false;selected.clear();scanControls();
 const currentLibrary=library.id,epoch=++scanEpoch;
 try{
  while(epoch===scanEpoch&&scanRunning&&scanQueue.length&&library&&library.id===currentLibrary){
   const job=scanQueue[0];scanController=new AbortController();
   const data=await api(endpoint('/scan'),'POST',{...(job.sourceId?{sourceId:job.sourceId}:{}),...(job.ref?(job.sourceId?{target:job.ref}:{folder:job.ref}):{}),...(job.cursor?{cursor:job.cursor}:{})},scanController.signal);
   if(epoch!==scanEpoch||!scanRunning||!library||library.id!==currentLibrary)break;
   scanSeen.add(data.folderKey);scanQueue.shift();scanPages++;
   data.items.forEach(b=>{
    if(b.isFolder){if(!scanSeen.has(b.key)){scanSeen.add(b.key);scanQueue.push({ref:b.ref,...(b.sourceId?{sourceId:b.sourceId}:{})});}}
    else scanItems.set(b.key,b);
   });
   if(data.nextCursor)scanQueue.unshift({...job,cursor:data.nextCursor});
   scanComplete=scanQueue.length===0;
   $('#scan-status').textContent=(scanComplete?'Hoàn tất — ':'Đang quét — ')+scanPages+' trang, '+scanItems.size+' file sách. '+(scanComplete?'Số liệu theo lần quét này; tải lại trang sẽ cần quét lại.':scanQueue.length+' lượt thư mục/trang còn chờ.');
   if(scanMode){fillFilters();render();}scanControls();
  }
 }catch(error){if(epoch===scanEpoch&&error.name!=='AbortError'){$('#scan-status').textContent='Quét chưa hoàn tất. '+error.message+' Kết quả đã tải được giữ lại; bấm Tiếp tục / thử lại.';notice(error.message,true);}}
 finally{if(epoch===scanEpoch){scanRunning=false;scanController=null;scanControls();if(scanMode)render();}}
}
function openBook(key){
 const b=source().get(key);if(!b)return;
 if(b.isFolder){pauseScan();trail.push({title:b.title,ref:b.ref});browse(false);return;}
 if(b.external){notice('Sách này thuộc nguồn OPDS “'+(b.sourceName||'bên ngoài')+'”. Metadata được đọc từ nguồn và không chỉnh sửa tại đây.');return;}
 editing=b;const f=$('#edit-form');f.reset();['title','author','language','category','description','coverUrl'].forEach(k=>f.elements[k].value=b.overrides[k]||'');f.elements.title.placeholder=b.name;
 $('#edit-source').textContent=b.name+' · '+b.format+' · '+sizeName(b.size);$('#edit-error').textContent='';previewCover();$('#editor').showModal();
}
function previewCover(){if(!editing)return;const value=$('#edit-form').elements.coverUrl.value.trim();const safe=/^https:\/\//i.test(value)?value:'';$('#cover-preview').innerHTML=coverMarkup({...editing,coverUrl:safe||editing.sourceCoverUrl||''});attachImageFallback($('#cover-preview'));}
function applyOverrides(key,o){
 [pageItems,scanItems].forEach(map=>{const b=map.get(key);if(!b)return;b.overrides=o;b.title=o.title||b.name;b.author=o.author||'';b.language=o.language||'';b.category=o.category||'';b.description=o.description||'';b.coverUrl=o.coverUrl||b.sourceCoverUrl||'';});fillFilters();render();
}
async function submitForm(form,action){const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await action();}catch(error){if(form.id==='edit-form')$('#edit-error').textContent=error.message;else {notice(error.message,true);const p=form.querySelector('.form-error')||Object.assign(document.createElement('p'),{className:'error form-error'});p.textContent=error.message;p.setAttribute('role','alert');form.append(p);}}finally{buttons.forEach(b=>b.disabled=false);}}
async function hideExternalBooks(books){
 for(let i=0;i<books.length;i+=50){const batch=books.slice(i,i+50);await api(endpoint('/source-books/hide'),'POST',{books:batch.map(book=>({sourceId:book.sourceId,key:book.key}))});batch.forEach(book=>{pageItems.delete(book.key);scanItems.delete(book.key);selected.delete(book.key);});}
 fillFilters();render();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.bookDelete){const book=source().get(button.dataset.bookDelete);if(!book||!book.external||!confirm('Loại “'+book.title+'” khỏi catalog tổng hợp? Sách gốc ở nguồn OPDS không bị xóa.'))return;button.disabled=true;try{await hideExternalBooks([book]);notice('Đã loại sách khỏi catalog tổng hợp.');}catch(e){button.disabled=false;notice(e.message,true);}return;}
 if(button.dataset.tab)tab(button.dataset.tab);
 if(button.dataset.close)$('#'+button.dataset.close).close();
 if(button.dataset.open)openBook(button.dataset.open);
 if(button.dataset.crumb!==undefined){pauseScan();trail=trail.slice(0,Number(button.dataset.crumb)+1);await browse(false);}
});
document.addEventListener('change',event=>{if(event.target.dataset.select){const key=event.target.dataset.select;event.target.checked?selected.add(key):selected.delete(key);render();}});
['create','login','recovery'].forEach(id=>$('#'+id).addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{const data=await api(id==='create'?'/api/libraries':id==='login'?'/api/session':'/api/recovery','POST',Object.fromEntries(new FormData(form)));form.reset();await enter(data);});}));
$('#logout').addEventListener('click',async()=>{try{await api('/api/session','DELETE',{});leave();notice('Đã đăng xuất.');}catch(e){notice(e.message,true);}});
$('#theme-toggle').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';applyTheme(theme,true);});
$('#account-button').addEventListener('click',()=>$('#account').showModal());
$('#sources-button').addEventListener('click',()=>{renderSources();$('#sources').showModal();});
$('#opds-button').addEventListener('click',()=>{renderConnection();$('#connection').showModal();});
$('#copy-opds').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#opds-url').value);$('#copy-opds').textContent='Đã sao chép';}catch{$('#opds-url').select();$('#copy-opds').textContent='Hãy sao chép link đã chọn';}});
$('#rotate-opds').addEventListener('click',async()=>{if(!confirm('Mật khẩu OPDS cũ sẽ hết hiệu lực. Bạn sẽ cần cập nhật lại trong vBook.'))return;$('#rotate-opds').disabled=true;try{const data=await api(endpoint('/opds-credentials'),'POST',{});activeOpds=data.opds;renderConnection();}catch(e){notice(e.message,true);}finally{$('#rotate-opds').disabled=false;}});
$('#password-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const data=await api(endpoint('/password'),'POST',Object.fromEntries(new FormData(f)));csrf=data.csrf;f.reset();$('#account').close();notice('Đã đổi mật khẩu và kết thúc các phiên cũ.');});});
$('#delete-form').addEventListener('submit',event=>{event.preventDefault();if(!confirm('Xóa vĩnh viễn tài khoản thư viện và metadata chỉnh sửa? File Drive không bị ảnh hưởng.'))return;const f=event.currentTarget;submitForm(f,async()=>{await api(endpoint('/delete'),'POST',Object.fromEntries(new FormData(f)));f.reset();leave();notice('Đã xóa dữ liệu quản lý thư viện.');});});
$('#drive-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const data=await api(endpoint('/drive'),'PUT',{drive:new FormData(f).get('drive')});library.hasDrive=data.hasDrive;f.reset();renderSources();pauseScan();trail=[];await browse(false);notice('Đã cập nhật nguồn Google Drive.');});});
$('#drive-remove').addEventListener('click',async()=>{if(!library.hasDrive||!confirm('Gỡ thư mục Drive khỏi catalog này? File trên Drive và metadata đã lưu không bị xóa.'))return;const button=$('#drive-remove');button.disabled=true;try{const data=await api(endpoint('/drive'),'DELETE',{});library.hasDrive=data.hasDrive;renderSources();pauseScan();trail=[];await browse(false);notice('Đã gỡ nguồn Google Drive khỏi catalog.');}catch(e){notice(e.message,true);}finally{button.disabled=false;}});
$('#source-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{
 const values=Object.fromEntries(new FormData(f));const urls=[...new Set(String(values.urls||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean))];
 if(!urls.length||urls.length>10)throw new Error('Mỗi lần nhập từ 1 đến 10 URL, mỗi URL trên một dòng.');
 const data=await api(endpoint('/sources'),'POST',{sources:urls.map(url=>({url,username:values.username||'',password:values.password||''}))});sources=data.sources;f.reset();renderSources();notice('Đã thêm và kiểm tra '+urls.length+' nguồn OPDS.');
 });});
$('#source-list').addEventListener('click',async event=>{
 const copy=event.target.closest('[data-source-copy]');if(copy){const source=sources.find(item=>item.id===copy.dataset.sourceCopy);if(!source)return;try{await navigator.clipboard.writeText(source.url);notice('Đã sao chép link nguồn OPDS.');}catch{notice('Không thể sao chép tự động.',true);}return;}
 const remove=event.target.closest('[data-source-delete]');if(remove){const source=sources.find(item=>item.id===remove.dataset.sourceDelete);if(!source||!confirm('Xóa nguồn OPDS “'+source.name+'”?'))return;const data=await api(endpoint('/sources/'+source.id),'DELETE');sources=data.sources;renderSources();notice('Đã xóa nguồn OPDS.');}
});
$('#source-list').addEventListener('change',async event=>{const input=event.target.closest('[data-source-toggle]');if(!input)return;try{const data=await api(endpoint('/sources/'+input.dataset.sourceToggle),'PATCH',{enabled:input.checked});sources=data.sources;renderSources();}catch(e){input.checked=!input.checked;notice(e.message,true);}});
$('#search').addEventListener('input',render);['language','format','sort'].forEach(id=>$('#'+id).addEventListener('change',render));
['grid','table'].forEach(mode=>$('#view-'+mode).addEventListener('click',()=>{view=mode;['grid','table'].forEach(m=>$('#view-'+m).setAttribute('aria-pressed',String(m===mode)));render();}));
$('#load-more').addEventListener('click',()=>{if(!busy)browse(true);});$('#reload-folder').addEventListener('click',()=>{pauseScan();trail=[];browse(false);});
$('#scan-start').addEventListener('click',()=>{if(scanPages&&!confirm('Quét lại toàn thư viện từ đầu?'))return;scanItems.clear();scanSeen.clear();scanQueue=[...(library.hasDrive?[{}]:[]),...sources.filter(source=>source.enabled).map(source=>({sourceId:source.id}))];scanPages=0;scanComplete=false;if(!scanQueue.length){$('#scan-status').textContent='Chưa có nguồn Drive hoặc OPDS đang bật để quét.';return;}scanLoop();});
$('#scan-pause').addEventListener('click',()=>{pauseScan();$('#scan-status').textContent='Đã tạm dừng. Kết quả chưa đầy đủ; có thể tiếp tục trong phiên trang này.';});$('#scan-resume').addEventListener('click',scanLoop);
$('#scan-results').addEventListener('click',()=>{requestEpoch++;busy=false;scanMode=true;selected.clear();fillFilters();render();});
$('#select-all').addEventListener('change',event=>{filtered().filter(b=>!b.isFolder).forEach(b=>event.target.checked?selected.add(b.key):selected.delete(b.key));render();});
$('#bulk-apply').addEventListener('click',async()=>{
 const books=[...selected].map(k=>source().get(k)).filter(b=>b&&!b.external);if(!books.length)return;busy=true;render();let done=0;
 try{for(let i=0;i<books.length;i+=50){const batch=books.slice(i,i+50);const data=await api(endpoint('/language'),'POST',{refs:batch.map(b=>b.ref),language:$('#bulk-language').value.trim()});batch.forEach(b=>{const o={...b.overrides};if(data.language)o.language=data.language;else delete o.language;applyOverrides(b.key,o);selected.delete(b.key);});done+=batch.length;}notice('Đã cập nhật ngôn ngữ cho '+done+' sách.');}
 catch(e){notice('Đã cập nhật '+done+' sách. '+e.message,true);}finally{busy=false;render();}
});
$('#bulk-delete-opds').addEventListener('click',async()=>{const books=[...selected].map(key=>source().get(key)).filter(book=>book&&book.external);if(!books.length||!confirm('Loại '+books.length+' sách OPDS khỏi catalog tổng hợp? Sách gốc ở các nguồn không bị xóa.'))return;busy=true;render();try{await hideExternalBooks(books);notice('Đã loại '+books.length+' sách OPDS khỏi catalog tổng hợp.');}catch(e){notice(e.message,true);}finally{busy=false;render();}});
$('#edit-form').elements.coverUrl.addEventListener('input',previewCover);
$('#edit-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const data=await api(endpoint('/books/'+editing.key),'PUT',{...Object.fromEntries(new FormData(f)),ref:editing.ref});applyOverrides(editing.key,data.overrides);$('#editor').close();notice('Đã lưu. Làm mới thư viện trong vBook để nhận thông tin mới.');});});
$('#reset-book').addEventListener('click',()=>{if(!editing||!confirm('Xóa các chỉnh sửa và dùng lại thông tin nguồn Drive?'))return;submitForm($('#edit-form'),async()=>{await api(endpoint('/books/'+editing.key),'DELETE',{ref:editing.ref});applyOverrides(editing.key,{});$('#editor').close();notice('Đã khôi phục dữ liệu nguồn.');});});
(async()=>{const id=new URL(location.href).searchParams.get('library');if(id){$('#login').elements.libraryId.value=id;$('#recovery').elements.libraryId.value=id;tab('login');}try{const data=await api('/api/session');await enter(data);}catch(e){if(e.status!==401)notice(e.message,true);}})();
`;
