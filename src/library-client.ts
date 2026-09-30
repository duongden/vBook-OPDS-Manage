// Served as an external script; no user metadata is interpolated into executable code.
export const libraryClient = String.raw`
'use strict';
const $ = s => document.querySelector(s);
const MAX_PASTED_OPDS_URLS=99,OPDS_BATCH_SIZE=10;
const RESULT_PAGE_SIZE=50;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const langName = value => ({vi:'Tiếng Việt',en:'English',fr:'Français',zh:'中文','zh-Hans':'中文',ja:'日本語',ko:'한국어'}[value] || value || 'Chưa rõ');
const bookLangName = book => langName(book.language)+(book.languageInferred?' (ước đoán)':'');
const sizeName = value => {if(value === undefined || value === '')return '—';let n=Number(value),u=0;const units=['B','KB','MB','GB'];while(n>=1024&&u<3){n/=1024;u++;}return n.toLocaleString('vi',{maximumFractionDigits:1})+' '+units[u];};
function savedTheme(){try{const value=localStorage.getItem('vbook-theme');if(value==='light'||value==='dark')return value;}catch{}return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
function applyTheme(theme,persist=false){document.documentElement.dataset.theme=theme;const toggle=$('#theme-toggle'),dark=theme==='dark';toggle.textContent=dark?'☀':'☾';toggle.setAttribute('aria-pressed',String(dark));toggle.setAttribute('aria-label',dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối');toggle.title=dark?'Giao diện sáng':'Giao diện tối';if(persist)try{localStorage.setItem('vbook-theme',theme);}catch{}}
let theme=savedTheme();applyTheme(theme);
let library=null,csrf='',pageItems=new Map(),scanItems=new Map(),selected=new Set(),view='grid',scanMode=false,scanResultPage=1,browsePageIndex=0,browsePages=[];
let trail=[],nextCursor=null,busy=false,editing=null,scanQueue=[],scanSeen=new Set(),scanRunning=false,scanComplete=false,scanPages=0,scanController=null;
let activeOpds=null,recoveryCode='',requestEpoch=0,scanEpoch=0,sources=[],sourceChecks=new Map(),sourceErrors=new Map(),sourceTransient=new Set(),revealedSourceIds=new Set(),sourceImportErrors=[],sourceCheckComplete=false,bulkDeletingFailed=false,selectedSourceIds=new Set(),bulkDeletingSelected=false;
const deleteFailedSourcesButton=document.createElement('button');deleteFailedSourcesButton.id='delete-failed-sources';deleteFailedSourcesButton.type='button';deleteFailedSourcesButton.className='danger';deleteFailedSourcesButton.hidden=true;$('#source-check-status').after(deleteFailedSourcesButton);
const sourceBulkActions=document.createElement('div');sourceBulkActions.className='source-bulk-actions';sourceBulkActions.append($('#check-sources'));sourceBulkActions.insertAdjacentHTML('beforeend','<label><input id="select-all-sources" type="checkbox"> Chọn tất cả</label><button id="delete-selected-sources" type="button" class="danger" disabled>Xóa hàng loạt (0)</button>');$('#source-check-status').before(sourceBulkActions);
const svgIcon=name=>({
 copy:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
 trash:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
 download:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
}[name]||'');
const noticeHome=document.createComment('notice-home');$('#notice').before(noticeHome);
function syncNoticePlacement(){
 const el=$('#notice'),dialogs=[...document.querySelectorAll('dialog[open]')],active=dialogs[dialogs.length-1];
 if(active){const head=active.querySelector('.dialog-head');if(head)head.after(el);else active.prepend(el);}
 else noticeHome.after(el);
}
document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(syncNoticePlacement).observe(dialog,{attributes:true,attributeFilter:['open']}));
function notice(message,error=false){syncNoticePlacement();const el=$('#notice');el.textContent=message;el.classList.toggle('error',error);el.hidden=!message;}
async function api(path,method='GET',body,signal){
 const headers={};if(method!=='GET'){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
 const response=await fetch(path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body),signal});
 let data;try{data=await response.json();}catch{const error=new Error('Máy chủ phản hồi HTTP '+response.status+' nhưng không trả về dữ liệu JSON. Hãy thử kiểm tra lại link nguồn.');error.status=response.status;throw error;}
 if(!response.ok){const error=new Error(data.error||'Không xử lý được yêu cầu.');error.status=response.status;throw error;}return data;
}
const endpoint = suffix => '/api/libraries/'+library.id+suffix;
function tab(name){document.querySelectorAll('.access-form').forEach(f=>f.hidden=f.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));}
function showSecrets(data){if(data.opds)activeOpds=data.opds;if(data.recoveryCode)recoveryCode=data.recoveryCode;renderConnection();$('#connection').showModal();}
function renderConnection(){
 if(!library)return;$('#opds-url').value=location.origin+(library.shortId?'/o/'+library.shortId:'/library/'+library.id+'/opds');
 $('#secret-values').innerHTML='<div class="secret">Tên đăng nhập vBook<code>reader</code><button type="button" data-copy-secret="username">Sao chép tên</button></div>'+
 (activeOpds?'<div class="secret">Mật khẩu OPDS cho vBook<code>'+escapeHtml(activeOpds.password)+'</code><button type="button" data-copy-secret="opds">Sao chép mật khẩu</button></div>':'<p class="muted">Nếu đã quên mật khẩu OPDS, bấm “Tạo lại mật khẩu OPDS” bên dưới.</p>')+
 '<div class="secret">Mã đăng nhập thư viện (dùng trên web, không nhập vào vBook)<code>'+escapeHtml(library.shortId||library.id)+'</code><button type="button" data-copy-secret="library">Sao chép mã</button></div>'+
 (recoveryCode?'<div class="secret">Mã khôi phục (chỉ dùng khi quên mật khẩu quản lý)<code>'+escapeHtml(recoveryCode)+'</code><button type="button" data-copy-secret="recovery">Sao chép mã khôi phục</button></div>':'');
}
function renderSources(){
 $('#source-count').textContent=String(sources.length+(library?.hasDrive?1:0));
 const sourceIds=new Set(sources.map(source=>source.id));for(const id of selectedSourceIds)if(!sourceIds.has(id))selectedSourceIds.delete(id);
 const all=$('#select-all-sources'),selectedButton=$('#delete-selected-sources');all.checked=Boolean(sources.length)&&selectedSourceIds.size===sources.length;all.indeterminate=selectedSourceIds.size>0&&!all.checked;all.disabled=!sources.length||bulkDeletingSelected||bulkDeletingFailed;
 selectedButton.textContent='Xóa hàng loạt ('+selectedSourceIds.size+')';selectedButton.dataset.count=String(selectedSourceIds.size);selectedButton.disabled=!selectedSourceIds.size||bulkDeletingSelected||bulkDeletingFailed;
 const failedCount=sources.filter(source=>sourceChecks.get(source.id)===false&&!sourceTransient.has(source.id)).length,bulkButton=$('#delete-failed-sources');
 bulkButton.hidden=!sourceCheckComplete||!failedCount;bulkButton.disabled=bulkDeletingFailed||bulkDeletingSelected;bulkButton.textContent='Xóa tất cả '+failedCount+' link lỗi';
 $('#drive-status').textContent=library?.hasDrive?'Đã kết nối một thư mục Drive. Dán link mới bên dưới để thay thế.':'Chưa kết nối thư mục Drive.';
 $('#drive-save').textContent=library?.hasDrive?'Thay thư mục Drive':'Thêm thư mục Drive';$('#drive-remove').hidden=!library?.hasDrive;
 $('#source-list').innerHTML=sources.length?sources.map(source=>{
  const temporary=sourceTransient.has(source.id),failed=sourceChecks.get(source.id)===false&&!temporary,checked=sourceChecks.get(source.id)===true;
  return '<article class="source-row">'+
   '<label class="source-select" title="Chọn nguồn '+escapeHtml(source.name)+'"><input type="checkbox" data-source-select="'+escapeHtml(source.id)+'" aria-label="Chọn nguồn '+escapeHtml(source.name)+'" '+(selectedSourceIds.has(source.id)?'checked':'')+(bulkDeletingSelected?' disabled':'')+'></label>'+
   '<div class="source-main"><h3>'+escapeHtml(source.name)+'</h3><p>'+escapeHtml(source.host)+(source.hasCredentials?' · Có xác thực':' · Công khai')+'</p><button type="button" class="source-reveal" data-source-reveal="'+escapeHtml(source.id)+'" aria-expanded="'+revealedSourceIds.has(source.id)+'">'+(revealedSourceIds.has(source.id)?'Ẩn URL gốc':'Hiện URL gốc')+'</button>'+(revealedSourceIds.has(source.id)?'<p class="muted source-error-url">URL gốc: '+escapeHtml(source.sourceUrl||'Không có URL gốc')+'</p>':'')+(failed?'<p class="error">Lỗi: '+escapeHtml(sourceErrors.get(source.id)||'Không đọc được feed OPDS. Link hoặc tài khoản nguồn có thể đã thay đổi.')+'</p>':temporary?'<p class="error">Tạm thời không kết nối: '+escapeHtml(sourceErrors.get(source.id)||'Hãy kiểm tra lại sau.')+'</p>':checked?'<p>Đã kiểm tra: nguồn hoạt động.</p>':'')+'</div>'+
   '<div class="source-actions"><label class="source-enabled"><input type="checkbox" data-source-toggle="'+escapeHtml(source.id)+'" '+(source.enabled?'checked':'')+'> Bật</label><button class="icon-button" data-source-copy="'+escapeHtml(source.id)+'" aria-label="Sao chép link '+escapeHtml(source.name)+'" title="Sao chép link">'+svgIcon('copy')+'</button>'+(failed?'<button class="danger" data-source-delete="'+escapeHtml(source.id)+'">Xóa link lỗi</button>':'<button class="icon-button danger" data-source-delete="'+escapeHtml(source.id)+'" aria-label="Xóa nguồn '+escapeHtml(source.name)+'" title="Xóa nguồn">'+svgIcon('trash')+'</button>')+'</div></article>';
 }).join(''):'<p class="muted">Chưa có nguồn OPDS.</p>';
}
async function loadSources(){
 if(!library)return;sources=(await api(endpoint('/sources'))).sources;renderSources();
}
async function enter(data,autoScan=true){
 library=data.library;csrf=data.csrf;sourceChecks.clear();sourceErrors.clear();sourceTransient.clear();revealedSourceIds.clear();sourceCheckComplete=false;selectedSourceIds.clear();pageItems.clear();scanItems.clear();selected.clear();trail=[];scanMode=false;scanResultPage=1;browsePageIndex=0;browsePages=[];scanComplete=false;scanQueue=[];scanSeen.clear();scanPages=0;
 $('#welcome').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false;$('#account-button').hidden=false;$('#library-name').textContent=library.name;
 history.replaceState(null,'','/?library='+encodeURIComponent(library.id));
 $('#account-info').textContent='Mã thư viện: '+(library.shortId||library.id)+' · Tên đăng nhập: '+library.username;
 $('#scan-status').textContent='Chưa quét toàn thư viện. Số liệu hiện chỉ thuộc dữ liệu đã tải.';scanControls();
 notice('');await Promise.all([browse(false),loadSources()]);if(data.opds||data.recoveryCode)showSecrets(data);
 if(autoScan&&!library.hasDrive&&sources.some(source=>source.enabled))startScan(true);
}
function leave(){
 pauseScan();requestEpoch++;library=null;csrf='';activeOpds=null;recoveryCode='';sources=[];sourceChecks.clear();sourceErrors.clear();sourceTransient.clear();revealedSourceIds.clear();sourceCheckComplete=false;selectedSourceIds.clear();sourceImportErrors=[];renderImportErrors();pageItems.clear();scanItems.clear();selected.clear();editing=null;scanResultPage=1;browsePageIndex=0;browsePages=[];scanQueue=[];scanSeen.clear();
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#secret-values').replaceChildren();$('#items').replaceChildren();$('#edit-form').reset();
 $('#welcome').hidden=false;$('#dashboard').hidden=true;$('#logout').hidden=true;$('#account-button').hidden=true;tab('login');
}
function coverMarkup(book){return '<div class="cover"><div class="fallback"><strong>'+escapeHtml(book.isFolder?'Thư mục':book.format)+'</strong><small>'+escapeHtml(book.isFolder?book.title:'Chưa có bìa')+'</small></div>'+(book.coverUrl?'<img src="'+escapeHtml(book.coverUrl)+'" alt="Bìa '+escapeHtml(book.title)+'" loading="lazy" referrerpolicy="no-referrer">':'')+'</div>';}
function attachImageFallback(container){container.querySelectorAll('img').forEach(img=>{img.addEventListener('error',()=>{img.remove();});});}
function source(){return scanMode?scanItems:pageItems;}
function currentItems(){return scanMode?[...scanItems.values()]:(browsePages[browsePageIndex]||[]).map(key=>pageItems.get(key)).filter(Boolean);}
function downloadHref(book){return book.external?endpoint('/sources/'+encodeURIComponent(book.sourceId)+'/download')+'?ref='+encodeURIComponent(book.ref):endpoint('/books/'+encodeURIComponent(book.key)+'/download')+'?ref='+encodeURIComponent(book.ref);}
function rowActions(book){
 if(book.isFolder)return '<button data-open="'+escapeHtml(book.key)+'">Mở</button>';
 const download=book.ref?'<a class="icon-button action-button" href="'+escapeHtml(downloadHref(book))+'" aria-label="Tải '+escapeHtml(book.title)+'" title="Tải sách">'+svgIcon('download')+'</a>':'';
 const remove=book.external?'<button class="icon-button danger" data-book-delete="'+escapeHtml(book.key)+'" aria-label="Loại '+escapeHtml(book.title)+'" khỏi catalog" title="Loại khỏi catalog">'+svgIcon('trash')+'</button>':'<button data-open="'+escapeHtml(book.key)+'">Sửa</button>';
 return '<div class="row-actions">'+download+remove+'</div>';
}
function filtered(){
 const q=$('#search').value.trim().toLocaleLowerCase(),language=$('#language').value,format=$('#format').value;
 return currentItems().filter(b=>(!q||[b.title,b.name,b.author,b.description,b.category].some(v=>v.toLocaleLowerCase().includes(q)))&&(!language||(language==='unknown'?!b.language:b.language===language))&&(!format||b.format===format)).sort((a,b)=>{
  if(a.isFolder!==b.isFolder)return a.isFolder?-1:1;const sort=$('#sort').value;
  if(sort==='size')return Number(b.size||0)-Number(a.size||0);
  return (sort==='author'?a.author.localeCompare(b.author,'vi'):0)||a.title.localeCompare(b.title,'vi');
 });
}
function fillFilters(){
 const books=currentItems().filter(b=>!b.isFolder);const lang=$('#language').value,format=$('#format').value;
 $('#language').innerHTML='<option value="">Tất cả</option><option value="unknown">Chưa rõ</option>'+[...new Set(books.map(b=>b.language).filter(Boolean))].sort().map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(langName(v))+'</option>').join('');
 $('#format').innerHTML='<option value="">Tất cả</option>'+[...new Set(books.map(b=>b.format))].sort().map(v=>'<option>'+escapeHtml(v)+'</option>').join('');
 $('#language').value=[...$('#language').options].some(o=>o.value===lang)?lang:'';$('#format').value=[...$('#format').options].some(o=>o.value===format)?format:'';
}
function render(){
 const all=currentItems(),books=all.filter(b=>!b.isFolder),list=filtered();
 const pageCount=scanMode?Math.max(1,Math.ceil(list.length/RESULT_PAGE_SIZE)):Math.max(1,browsePages.length);
 if(scanMode)scanResultPage=Math.min(scanResultPage,pageCount);
 const visible=scanMode?list.slice((scanResultPage-1)*RESULT_PAGE_SIZE,scanResultPage*RESULT_PAGE_SIZE):list;
 const counts=[['Sách trong kết quả',books.length],['Định dạng',new Set(books.map(b=>b.format)).size],['Chưa có ngôn ngữ',books.filter(b=>!b.language).length],['Chưa có nguồn bìa',books.filter(b=>!b.coverUrl).length]];
 $('#stats').innerHTML=counts.map(([label,count])=>'<div class="stat"><strong>'+count.toLocaleString('vi')+'</strong><span>'+label+'</span></div>').join('');
 const formats={};books.forEach(b=>formats[b.format]=(formats[b.format]||0)+1);$('#formats').textContent=Object.entries(formats).map(([k,v])=>k+': '+v).join(' · ');
 $('#result-count').textContent=visible.length+' / '+list.length+' mục trên trang · '+(scanMode?(scanComplete?'Toàn thư viện, theo lần quét vừa xong':'Kết quả quét chưa đầy đủ'):'Thư mục hiện tại');
 $('#breadcrumbs').innerHTML='<button data-crumb="-1">Thư viện</button>'+(scanMode?'<span>/ Kết quả quét</span>':trail.map((t,i)=>'<span>/</span><button data-crumb="'+i+'">'+escapeHtml(t.title)+'</button>').join(''));
 if(!visible.length)$('#items').innerHTML='<div class="empty">'+(busy?'Đang lấy danh sách nguồn…':'Chưa có mục phù hợp. Thử thay đổi bộ lọc hoặc quét lại các nguồn.')+'</div>';
 else if(view==='grid')$('#items').innerHTML='<div class="books">'+visible.map(b=>'<article class="book '+(b.isFolder?'folder':'')+'">'+(!b.isFolder?'<label class="check"><input type="checkbox" data-select="'+escapeHtml(b.key)+'" '+(selected.has(b.key)?'checked':'')+'> Chọn sách</label>':'')+'<button class="book-open" data-open="'+escapeHtml(b.key)+'">'+coverMarkup(b)+'<span class="book-title">'+escapeHtml(b.title)+'</span></button><div class="book-author">'+escapeHtml(b.author||b.sourceName|| (b.isFolder?'Mở thư mục':'Chưa có tác giả'))+'</div>'+(!b.isFolder?'<div class="book-meta"><span class="badge">'+escapeHtml(b.external?'OPDS':b.format)+'</span><span>'+escapeHtml(bookLangName(b))+'</span><span>'+sizeName(b.size)+'</span></div>'+rowActions(b):'')+'</article>').join('')+'</div>';
 else $('#items').innerHTML='<div class="table-wrap"><table><thead><tr><th>Chọn</th><th>Tên sách</th><th>Ngôn ngữ</th><th>Định dạng</th><th>Dung lượng</th><th></th></tr></thead><tbody>'+visible.map(b=>'<tr><td>'+(!b.isFolder?'<input aria-label="Chọn '+escapeHtml(b.title)+'" type="checkbox" data-select="'+escapeHtml(b.key)+'" '+(selected.has(b.key)?'checked':'')+'>':'')+'</td><td><div class="table-title">'+(b.coverUrl?'<img class="thumb" alt="" src="'+escapeHtml(b.coverUrl)+'" referrerpolicy="no-referrer" loading="lazy">':'')+'<div><button data-open="'+escapeHtml(b.key)+'">'+escapeHtml(b.title)+'</button><small>'+escapeHtml(b.author||b.sourceName)+'</small>'+(b.external?'<small><span class="badge">OPDS</span></small>':'')+'</div></div></td><td>'+escapeHtml(b.isFolder?'—':bookLangName(b))+'</td><td>'+escapeHtml(b.isFolder?'Thư mục':b.format)+'</td><td>'+sizeName(b.size)+'</td><td>'+rowActions(b)+'</td></tr>').join('')+'</tbody></table></div>';
 attachImageFallback($('#items'));
 $('#page-label').textContent='Trang '+(scanMode?scanResultPage:browsePageIndex+1)+' / '+pageCount+(scanMode||!nextCursor?'':' đã tải');
 $('#page-prev').hidden=scanMode?scanResultPage<=1:browsePageIndex<=0;
 $('#load-more').hidden=scanMode?scanResultPage>=pageCount:!(browsePageIndex<browsePages.length-1||nextCursor);
 $('#page-prev').disabled=busy;$('#load-more').disabled=busy;
 const selectedItems=[...selected].map(key=>source().get(key)).filter(Boolean),selectedDrive=selectedItems.filter(b=>!b.external),selectedOpds=selectedItems.filter(b=>b.external);
 $('#selected-count').textContent=selectedItems.length+' đã chọn';$('#bulk-apply').disabled=!selectedDrive.length||busy;$('#bulk-delete-opds').hidden=!selectedOpds.length;$('#bulk-delete-opds').disabled=busy;
 const visibleBooks=visible.filter(b=>!b.isFolder);$('#select-all').checked=visibleBooks.length>0&&visibleBooks.every(b=>selected.has(b.key));
 $('#select-all').indeterminate=visibleBooks.some(b=>selected.has(b.key))&&!$('#select-all').checked;
}
async function browse(append){
 const epoch=++requestEpoch;busy=true;scanMode=false;if(!append){pageItems.clear();selected.clear();nextCursor=null;browsePages=[];browsePageIndex=0;}render();
 try{
  const params=new URLSearchParams();if(trail.length)params.set('folder',trail[trail.length-1].ref);if(append&&nextCursor)params.set('cursor',nextCursor);
  const data=await api(endpoint('/items')+(params.size?'?'+params:''));if(epoch!==requestEpoch||!library)return;
  data.items.forEach(b=>pageItems.set(b.key,b));browsePages.push(data.items.map(b=>b.key));browsePageIndex=browsePages.length-1;nextCursor=data.nextCursor;fillFilters();
 }catch(error){if(epoch===requestEpoch)notice(error.message,true);}
 finally{if(epoch===requestEpoch){busy=false;render();}}
}
function scanControls(){$('#scan-pause').hidden=!scanRunning;$('#scan-resume').hidden=scanRunning||!scanQueue.length;$('#scan-results').hidden=!scanPages;$('#scan-start').disabled=scanRunning;}
function pauseScan(){scanEpoch++;scanRunning=false;if(scanController)scanController.abort();scanController=null;scanControls();}
function startScan(auto=false){
 if(!auto&&scanPages&&!confirm('Quét lại toàn thư viện từ đầu?'))return;
 pauseScan();scanItems.clear();scanSeen.clear();scanResultPage=1;scanQueue=[...(library.hasDrive?[{}]:[]),...sources.filter(source=>source.enabled).map(source=>({sourceId:source.id}))];scanPages=0;scanComplete=false;
 if(!scanQueue.length){$('#scan-status').textContent='Chưa có nguồn Drive hoặc OPDS đang bật để quét.';return;}
 $('#scan-status').textContent='Đang tải sách từ '+sources.filter(source=>source.enabled).length+' nguồn OPDS...';scanLoop();
}
async function scanLoop(){
 if(scanRunning||!scanQueue.length)return;scanRunning=true;scanMode=true;requestEpoch++;busy=false;selected.clear();scanControls();
 const currentLibrary=library.id,epoch=++scanEpoch;
 try{
  while(epoch===scanEpoch&&scanRunning&&scanQueue.length&&library&&library.id===currentLibrary){
   const job=scanQueue[0];scanController=new AbortController();
   let data;
   try{data=await api(endpoint('/scan'),'POST',{...(job.sourceId?{sourceId:job.sourceId}:{}),...(job.ref?(job.sourceId?{target:job.ref}:{folder:job.ref}):{}),...(job.cursor?{cursor:job.cursor}:{})},scanController.signal);}
   catch(error){
    if(error.name==='AbortError'||!job.sourceId)throw error;
    scanQueue.shift();const failedSource=sources.find(source=>source.id===job.sourceId),childPage=Boolean(job.ref||job.cursor),temporary=!error.status||error.status===408||error.status===429||error.status>=500;if(!childPage){sourceChecks.set(job.sourceId,false);sourceErrors.set(job.sourceId,error.message);if(temporary)sourceTransient.add(job.sourceId);else sourceTransient.delete(job.sourceId);renderSources();}$('#scan-status').textContent=(childPage?'Không đọc được trang con OPDS: ':temporary?'Tạm thời không kết nối được nguồn OPDS: ':'Nguồn OPDS lỗi: ')+(failedSource?.name||'Không rõ tên')+'. '+error.message+' Đang tiếp tục quét các nguồn khác. Mở Nguồn sách và bấm Hiện URL gốc nếu cần đối chiếu.';notice($('#scan-status').textContent,true);continue;
   }
   if(epoch!==scanEpoch||!scanRunning||!library||library.id!==currentLibrary)break;
   if(job.sourceId&&!job.ref&&!job.cursor){sourceChecks.set(job.sourceId,true);sourceErrors.delete(job.sourceId);sourceTransient.delete(job.sourceId);renderSources();}
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
async function submitForm(form,action){const buttons=form.querySelectorAll('button');form.querySelector('.form-error')?.remove();buttons.forEach(b=>b.disabled=true);try{await action();}catch(error){if(form.id==='edit-form')$('#edit-error').textContent=error.message;else {notice(error.message,true);const p=Object.assign(document.createElement('p'),{className:'error form-error'});p.textContent=error.message;p.setAttribute('role','alert');form.append(p);}}finally{buttons.forEach(b=>b.disabled=false);}}
function splitUrls(value){return String(value||'').split(/\r?\n/).map(url=>url.trim()).filter(Boolean);}
function isDriveInput(value){if(!value.includes('://'))return true;try{return new URL(value).hostname==='drive.google.com';}catch{return false;}}
function pastedUrls(value,max=MAX_PASTED_OPDS_URLS){const urls=[...new Set(splitUrls(value))];if(urls.length>max)throw new Error(max===MAX_PASTED_OPDS_URLS?'Mỗi lần nhập tối đa 99 URL OPDS, mỗi URL trên một dòng.':'Mỗi lần nhập tối đa 99 URL OPDS và một link Drive, mỗi link trên một dòng.');return urls;}
function renderImportErrors(){
 $('#source-import-errors').innerHTML=(sourceImportErrors.length>1?'<button type="button" class="danger" data-import-delete-all>Xóa tất cả '+sourceImportErrors.length+' link lỗi</button>':'')+sourceImportErrors.map((item,index)=>'<article class="source-row"><div><strong>URL OPDS thứ '+item.index+'</strong><p class="error">'+escapeHtml(item.message)+'</p><code class="source-error-url">'+escapeHtml(item.url)+'</code></div><button type="button" class="danger" data-import-delete="'+index+'">Xóa link lỗi</button></article>').join('');
}
function updateUrlCount(){
 const createLines=splitUrls($('#create textarea[name="drive"]').value),createUnique=[...new Set(createLines)],drive=createUnique.filter(isDriveInput).length,opds=createUnique.length-drive;
 const createCount=$('#create-url-count');createCount.textContent='Đã nhập '+opds+' / 99 URL OPDS · '+drive+' / 1 link Drive'+(createLines.length>createUnique.length?' · '+(createLines.length-createUnique.length)+' dòng trùng sẽ bỏ qua':'')+(opds>99||drive>1?' · Vượt giới hạn':'');createCount.classList.toggle('error',opds>99||drive>1);
 const sourceLines=splitUrls($('#source-form textarea[name="urls"]').value),sourceUnique=new Set(sourceLines),sourceCount=$('#source-url-count');sourceCount.textContent='Đã nhập '+sourceUnique.size+' / 99 URL OPDS'+(sourceLines.length>sourceUnique.size?' · '+(sourceLines.length-sourceUnique.size)+' dòng trùng sẽ bỏ qua':'')+(sourceUnique.size>99?' · Vượt giới hạn':'');sourceCount.classList.toggle('error',sourceUnique.size>99);
 sourceImportErrors=sourceImportErrors.filter(item=>sourceUnique.has(item.url));renderImportErrors();
}
['#create textarea[name="drive"]','#source-form textarea[name="urls"]'].forEach(selector=>$(selector).addEventListener('input',updateUrlCount));updateUrlCount();
async function addSourceBatches(urls,username='',password='',offset=0){
 sourceCheckComplete=false;sourceChecks.clear();sourceErrors.clear();sourceTransient.clear();renderSources();
 const failed=[];let added=0;
 for(let i=0;i<urls.length;i+=OPDS_BATCH_SIZE){
  const batch=urls.slice(i,i+OPDS_BATCH_SIZE);
  try{const data=await api(endpoint('/sources'),'POST',{sources:batch.map(url=>({url,username,password}))});sources=data.sources;renderSources();added+=batch.length;}
  catch(error){
   if(error.status!==400&&error.status!==413){error.failed=failed;error.remainingUrls=[...failed.map(item=>item.url),...urls.slice(i)];error.addedCount=added;throw error;}
   for(let j=0;j<batch.length;j++){
    try{const data=await api(endpoint('/sources'),'POST',{sources:[{url:batch[j],username,password}]});sources=data.sources;renderSources();added++;}
    catch(single){
     if(single.status!==400&&single.status!==413){single.failed=failed;single.remainingUrls=[...failed.map(item=>item.url),...batch.slice(j),...urls.slice(i+batch.length)];single.addedCount=added;throw single;}
     failed.push({url:batch[j],index:offset+i+j+1,message:single.message});
    }
   }
  }
  $('#source-progress').textContent='Đã kiểm tra '+(offset+Math.min(i+batch.length,urls.length))+' / '+(offset+urls.length)+' URL OPDS · đã thêm '+(offset+added)+'.';notice($('#source-progress').textContent);
 }
 if(failed.length){const error=new Error('Có '+failed.length+' link lỗi. Xem URL và chọn “Xóa link lỗi” bên dưới.');error.failed=failed;error.remainingUrls=failed.map(item=>item.url);error.addedCount=added;throw error;}
 return added;
}
async function hideExternalBooks(books){
 for(let i=0;i<books.length;i+=50){const batch=books.slice(i,i+50);await api(endpoint('/source-books/hide'),'POST',{books:batch.map(book=>({sourceId:book.sourceId,key:book.key}))});batch.forEach(book=>{pageItems.delete(book.key);scanItems.delete(book.key);selected.delete(book.key);});}
 fillFilters();render();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-import-delete-all')){
  const failed=new Set(sourceImportErrors.map(item=>item.url)),input=$('#source-form textarea[name="urls"]'),count=failed.size;
  input.value=splitUrls(input.value).filter(url=>!failed.has(url)).join('\n');sourceImportErrors=[];updateUrlCount();notice('Đã xóa '+count+' link lỗi khỏi ô nhập. Các nguồn đã thêm vẫn được giữ.');return;
 }
 if(button.dataset.importDelete!==undefined){
  const item=sourceImportErrors[Number(button.dataset.importDelete)];if(!item)return;
  const input=$('#source-form textarea[name="urls"]');input.value=splitUrls(input.value).filter(url=>url!==item.url).join('\n');
  sourceImportErrors.splice(Number(button.dataset.importDelete),1);updateUrlCount();notice('Đã xóa link lỗi khỏi ô nhập. Các nguồn đã thêm vẫn được giữ.');return;
 }
 if(button.dataset.bookDelete){const book=source().get(button.dataset.bookDelete);if(!book||!book.external||!confirm('Loại “'+book.title+'” khỏi catalog tổng hợp? Sách gốc ở nguồn OPDS không bị xóa.'))return;button.disabled=true;try{await hideExternalBooks([book]);notice('Đã loại sách khỏi catalog tổng hợp.');}catch(e){button.disabled=false;notice(e.message,true);}return;}
 if(button.dataset.tab)tab(button.dataset.tab);
 if(button.dataset.close)$('#'+button.dataset.close).close();
 if(button.dataset.open)openBook(button.dataset.open);
 if(button.dataset.crumb!==undefined){pauseScan();trail=trail.slice(0,Number(button.dataset.crumb)+1);await browse(false);}
});
document.addEventListener('change',event=>{if(event.target.dataset.select){const key=event.target.dataset.select;event.target.checked?selected.add(key):selected.delete(key);render();}});
['create','login','recovery'].forEach(id=>$('#'+id).addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{
 const values=Object.fromEntries(new FormData(form));
 if(id==='create'){
  const lines=pastedUrls(values.drive,MAX_PASTED_OPDS_URLS+1),drive=lines.filter(isDriveInput),opds=lines.filter(value=>!isDriveInput(value));
  if(drive.length>1)throw new Error('Mỗi thư viện chỉ dùng tối đa một thư mục Drive.');
  if(opds.length>MAX_PASTED_OPDS_URLS)throw new Error('Tối đa 99 URL OPDS khi tạo thư viện.');
  notice(opds.length?'Đang kiểm tra '+Math.min(opds.length,OPDS_BATCH_SIZE)+' URL OPDS đầu và tạo thư viện...':'Đang tạo thư viện...');
  const data=await api('/api/libraries','POST',{...values,drive:[...drive,...opds.slice(0,OPDS_BATCH_SIZE)].join('\n')});
  library=data.library;csrf=data.csrf;let importError=null;
  if(opds.length>OPDS_BATCH_SIZE){
   try{await addSourceBatches(opds.slice(OPDS_BATCH_SIZE),'','',OPDS_BATCH_SIZE);}
   catch(error){importError=error;}
  }
  form.reset();updateUrlCount();await enter(data,false);
  if(importError){$('#source-form').elements.urls.value=importError.remainingUrls.join('\n');sourceImportErrors=importError.failed||[];updateUrlCount();notice('Thư viện đã tạo. Đã thêm '+(OPDS_BATCH_SIZE+importError.addedCount)+' / '+opds.length+' nguồn OPDS. Mở Nguồn sách để xem và xử lý link chưa thêm. '+importError.message,true);}
  else if(opds.length)notice('Đã thêm và kiểm tra '+opds.length+' nguồn OPDS.');
  if(!library.hasDrive&&sources.some(source=>source.enabled))startScan(true);
  return;
 }
 const data=await api(id==='login'?'/api/session':'/api/recovery','POST',values);form.reset();await enter(data);
 });}));
$('#logout').addEventListener('click',async()=>{try{await api('/api/session','DELETE',{});leave();notice('Đã đăng xuất.');}catch(e){notice(e.message,true);}});
$('#theme-toggle').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';applyTheme(theme,true);});
$('#account-button').addEventListener('click',()=>$('#account').showModal());
$('#sources-button').addEventListener('click',()=>{revealedSourceIds.clear();renderSources();$('#sources').showModal();});
$('#opds-button').addEventListener('click',()=>{renderConnection();$('#connection').showModal();});
$('#copy-opds').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#opds-url').value);$('#copy-opds').textContent='Đã sao chép';notice('Đã sao chép URL OPDS.');}catch{$('#opds-url').select();$('#copy-opds').textContent='Hãy sao chép link đã chọn';notice('Trình duyệt không cho sao chép tự động. URL đã được chọn, hãy sao chép thủ công.',true);}});
$('#secret-values').addEventListener('click',async event=>{const button=event.target.closest('[data-copy-secret]');if(!button)return;const kind=button.dataset.copySecret,value=kind==='username'?'reader':kind==='opds'?activeOpds?.password:kind==='library'?(library?.shortId||library?.id):recoveryCode;if(!value)return;try{await navigator.clipboard.writeText(value);notice('Đã sao chép '+(kind==='opds'?'mật khẩu OPDS':kind==='username'?'tên đăng nhập':'mã')+'.');}catch{const code=button.parentElement.querySelector('code'),range=document.createRange();range.selectNodeContents(code);getSelection().removeAllRanges();getSelection().addRange(range);notice('Trình duyệt không cho sao chép tự động. Nội dung đã được chọn để bạn sao chép thủ công.',true);}});
$('#rotate-opds').addEventListener('click',async()=>{const input=$('#custom-opds-password'),custom=input.value;if(custom&&!input.checkValidity()){input.reportValidity();return;}if(!confirm('Mật khẩu OPDS cũ sẽ hết hiệu lực. Bạn sẽ cần cập nhật lại trong vBook.'))return;$('#rotate-opds').disabled=true;try{const data=await api(endpoint('/opds-credentials'),'POST',{opdsPassword:custom});activeOpds=data.opds;input.value='';renderConnection();notice('Đã '+(custom?'đặt':'tạo')+' mật khẩu OPDS mới. Hãy cập nhật trong vBook.');}catch(e){notice(e.message,true);}finally{$('#rotate-opds').disabled=false;}});
$('#password-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const data=await api(endpoint('/password'),'POST',Object.fromEntries(new FormData(f)));csrf=data.csrf;f.reset();$('#account').close();notice('Đã đổi mật khẩu và kết thúc các phiên cũ.');});});
$('#delete-form').addEventListener('submit',event=>{event.preventDefault();if(!confirm('Xóa vĩnh viễn tài khoản thư viện và metadata chỉnh sửa? File Drive không bị ảnh hưởng.'))return;const f=event.currentTarget;submitForm(f,async()=>{await api(endpoint('/delete'),'POST',Object.fromEntries(new FormData(f)));f.reset();leave();notice('Đã xóa dữ liệu quản lý thư viện.');});});
$('#drive-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const data=await api(endpoint('/drive'),'PUT',{drive:new FormData(f).get('drive')});library.hasDrive=data.hasDrive;f.reset();renderSources();pauseScan();trail=[];await browse(false);notice('Đã cập nhật nguồn Google Drive.');});});
$('#drive-remove').addEventListener('click',async()=>{if(!library.hasDrive||!confirm('Gỡ thư mục Drive khỏi catalog này? File trên Drive và metadata đã lưu không bị xóa.'))return;const button=$('#drive-remove');button.disabled=true;try{const data=await api(endpoint('/drive'),'DELETE',{});library.hasDrive=data.hasDrive;renderSources();pauseScan();trail=[];await browse(false);notice('Đã gỡ nguồn Google Drive khỏi catalog.');}catch(e){notice(e.message,true);}finally{button.disabled=false;}});
$('#source-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{
 const values=Object.fromEntries(new FormData(f)),allUrls=pastedUrls(values.urls);
 if(!allUrls.length)throw new Error('Nhập ít nhất một URL OPDS.');
 const existing=new Set((await api(endpoint('/sources/match'),'POST',{urls:allUrls})).existing),urls=allUrls.filter((_,index)=>!existing.has(index)),skipped=allUrls.length-urls.length;
 if(!urls.length)throw new Error('Tất cả '+skipped+' URL OPDS đã có trong thư viện; không cần thêm lại.');
 try{sourceImportErrors=[];renderImportErrors();$('#source-progress').textContent='Đang kiểm tra 0 / '+urls.length+' URL OPDS'+(skipped?' · bỏ qua '+skipped+' link đã lưu':'')+'.';notice($('#source-progress').textContent);await addSourceBatches(urls,values.username||'',values.password||'');f.reset();updateUrlCount();$('#source-progress').textContent='Đã thêm và kiểm tra '+urls.length+' nguồn OPDS.'+(skipped?' Bỏ qua '+skipped+' link đã có.':'');notice($('#source-progress').textContent);if(!library.hasDrive)startScan(true);}
 catch(error){if(error.remainingUrls)f.elements.urls.value=error.remainingUrls.join('\n');sourceImportErrors=error.failed||[];updateUrlCount();error.message='Đã thêm '+(error.addedCount||0)+' / '+urls.length+' nguồn OPDS mới. '+(skipped?'Bỏ qua '+skipped+' link đã có. ':'')+(error.remainingUrls?'Các URL lỗi/chưa xử lý được giữ trong ô nhập. ':'')+error.message;if(error.addedCount&&!library.hasDrive)startScan(true);throw error;}
 });});
$('#check-sources').addEventListener('click',async()=>{
 const button=$('#check-sources'),status=$('#source-check-status'),ids=sources.map(source=>source.id);
 if(!ids.length){status.textContent='Chưa có nguồn OPDS để kiểm tra.';notice(status.textContent);return;}
 button.disabled=true;sourceCheckComplete=false;sourceChecks.clear();sourceErrors.clear();sourceTransient.clear();renderSources();
 status.textContent='Đang kiểm tra 0 / '+ids.length+' nguồn OPDS.';notice(status.textContent);
 try{
  for(let i=0;i<ids.length;i+=5){
   const data=await api(endpoint('/sources/check'),'POST',{ids:ids.slice(i,i+5)});
   data.checks.forEach(check=>{sourceChecks.set(check.id,check.ok);if(check.retryable)sourceTransient.add(check.id);else sourceTransient.delete(check.id);if(check.error)sourceErrors.set(check.id,check.error);else sourceErrors.delete(check.id);});renderSources();
   const failed=[...sourceChecks].filter(([id,ok])=>!ok&&!sourceTransient.has(id)).length,temporary=sourceTransient.size;status.textContent='Đã kiểm tra '+Math.min(i+5,ids.length)+' / '+ids.length+' nguồn · '+failed+' nguồn lỗi · '+temporary+' nguồn tạm thời không kết nối.'+(failed?' Xem dòng lỗi để tắt hoặc xóa link.':'')+(temporary?' Hãy kiểm tra lại sau; chưa kết luận link hỏng.':'');notice(status.textContent,Boolean(failed||temporary));
  }
  sourceCheckComplete=true;renderSources();
 }catch(error){status.textContent='Kiểm tra chưa hoàn tất. '+error.message;notice(error.message,true);}
 finally{button.disabled=false;}
});
$('#delete-failed-sources').addEventListener('click',async()=>{
 const ids=sources.filter(source=>sourceChecks.get(source.id)===false&&!sourceTransient.has(source.id)).map(source=>source.id);
 if(!sourceCheckComplete||!ids.length||bulkDeletingFailed||!confirm('Xóa '+ids.length+' nguồn OPDS đã kiểm tra bị lỗi khỏi thư viện? Sách trên máy chủ nguồn không bị xóa.'))return;
 bulkDeletingFailed=true;renderSources();let deleted=0,errors=0;
 for(const id of ids){
  try{const data=await api(endpoint('/sources/'+id),'DELETE');sources=data.sources;sourceChecks.delete(id);sourceErrors.delete(id);sourceTransient.delete(id);deleted++;}
  catch{errors++;}
  $('#source-check-status').textContent='Đang xóa '+(deleted+errors)+' / '+ids.length+' nguồn lỗi · đã xóa '+deleted+'.';renderSources();
 }
 bulkDeletingFailed=false;renderSources();
 const message='Đã xóa '+deleted+' / '+ids.length+' nguồn OPDS lỗi.'+(errors?' '+errors+' nguồn chưa xóa được; thử lại.':' Sách ở nguồn gốc được giữ nguyên.');
 $('#source-check-status').textContent=message;notice(message,Boolean(errors));
});
$('#select-all-sources').addEventListener('change',event=>{
 selectedSourceIds=event.target.checked?new Set(sources.map(source=>source.id)):new Set();renderSources();
});
$('#delete-selected-sources').addEventListener('click',async()=>{
 const ids=sources.filter(source=>selectedSourceIds.has(source.id)).map(source=>source.id);
 if(!ids.length||bulkDeletingSelected||bulkDeletingFailed||!confirm('Xóa '+ids.length+' nguồn OPDS đã chọn khỏi thư viện? Sách trên máy chủ nguồn không bị xóa.'))return;
 bulkDeletingSelected=true;renderSources();let deleted=0,errors=0;
 for(const id of ids){
  try{const data=await api(endpoint('/sources/'+id),'DELETE');sources=data.sources;sourceChecks.delete(id);sourceErrors.delete(id);sourceTransient.delete(id);selectedSourceIds.delete(id);deleted++;}
  catch{errors++;}
  $('#source-check-status').textContent='Đang xóa '+(deleted+errors)+' / '+ids.length+' nguồn đã chọn · đã xóa '+deleted+'.';renderSources();
 }
 bulkDeletingSelected=false;renderSources();
 const message='Đã xóa '+deleted+' / '+ids.length+' nguồn OPDS đã chọn.'+(errors?' '+errors+' nguồn chưa xóa được; vẫn được chọn để thử lại.':' Sách trên máy chủ nguồn được giữ nguyên.');
 $('#source-check-status').textContent=message;notice(message,Boolean(errors));
});
$('#source-list').addEventListener('click',async event=>{
 const reveal=event.target.closest('[data-source-reveal]');if(reveal){const id=reveal.dataset.sourceReveal;revealedSourceIds.has(id)?revealedSourceIds.delete(id):revealedSourceIds.add(id);renderSources();return;}
 const copy=event.target.closest('[data-source-copy]');if(copy){const source=sources.find(item=>item.id===copy.dataset.sourceCopy);if(!source)return;try{await navigator.clipboard.writeText(source.url);notice('Đã sao chép link nguồn OPDS.');}catch{notice('Không thể sao chép tự động.',true);}return;}
 const remove=event.target.closest('[data-source-delete]');if(remove){const source=sources.find(item=>item.id===remove.dataset.sourceDelete);if(bulkDeletingSelected||bulkDeletingFailed||!source||!confirm('Gỡ nguồn OPDS “'+source.name+'” khỏi kệ tổng hợp? Sách ở nguồn gốc không bị xóa.'))return;remove.disabled=true;try{const data=await api(endpoint('/sources/'+source.id),'DELETE');sources=data.sources;sourceChecks.delete(source.id);sourceErrors.delete(source.id);sourceTransient.delete(source.id);selectedSourceIds.delete(source.id);renderSources();$('#source-check-status').textContent='Đã xóa nguồn. Bấm kiểm tra lại nếu cần.';notice('Đã gỡ link OPDS khỏi thư viện; sách ở nguồn gốc được giữ nguyên.');}catch(error){remove.disabled=false;notice('Không xóa được link OPDS. '+error.message,true);}}
});
$('#source-list').addEventListener('change',async event=>{
 const selectedInput=event.target.closest('[data-source-select]');if(selectedInput){selectedInput.checked?selectedSourceIds.add(selectedInput.dataset.sourceSelect):selectedSourceIds.delete(selectedInput.dataset.sourceSelect);renderSources();return;}
 const input=event.target.closest('[data-source-toggle]');if(!input)return;try{const data=await api(endpoint('/sources/'+input.dataset.sourceToggle),'PATCH',{enabled:input.checked});sources=data.sources;renderSources();}catch(e){input.checked=!input.checked;notice(e.message,true);}
});
$('#search').addEventListener('input',()=>{scanResultPage=1;render();});['language','format','sort'].forEach(id=>$('#'+id).addEventListener('change',()=>{scanResultPage=1;render();}));
['grid','table'].forEach(mode=>$('#view-'+mode).addEventListener('click',()=>{view=mode;['grid','table'].forEach(m=>$('#view-'+m).setAttribute('aria-pressed',String(m===mode)));render();}));
$('#page-prev').addEventListener('click',()=>{if(busy)return;if(scanMode)scanResultPage=Math.max(1,scanResultPage-1);else browsePageIndex=Math.max(0,browsePageIndex-1);fillFilters();render();});
$('#load-more').addEventListener('click',()=>{if(busy)return;if(scanMode){scanResultPage++;render();}else if(browsePageIndex<browsePages.length-1){browsePageIndex++;fillFilters();render();}else if(nextCursor)browse(true);});$('#reload-folder').addEventListener('click',()=>{pauseScan();trail=[];browse(false);});
$('#scan-start').addEventListener('click',()=>startScan());
$('#scan-pause').addEventListener('click',()=>{pauseScan();$('#scan-status').textContent='Đã tạm dừng. Kết quả chưa đầy đủ; có thể tiếp tục trong phiên trang này.';});$('#scan-resume').addEventListener('click',scanLoop);
$('#scan-results').addEventListener('click',()=>{requestEpoch++;busy=false;scanMode=true;scanResultPage=1;selected.clear();fillFilters();render();});
$('#select-all').addEventListener('change',event=>{const list=filtered(),visible=scanMode?list.slice((scanResultPage-1)*RESULT_PAGE_SIZE,scanResultPage*RESULT_PAGE_SIZE):list;visible.filter(b=>!b.isFolder).forEach(b=>event.target.checked?selected.add(b.key):selected.delete(b.key));render();});
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
