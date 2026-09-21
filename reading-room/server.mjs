import http from 'node:http';
import worker from './dist/index.js';
const env={...process.env};
const server=http.createServer(async(req,res)=>{
  try{
    if(env.LOCAL_PREVIEW==='1' && !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end('Invalid preview host.');return;}
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers});
    const response=await worker.fetch(request,env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error(e);res.writeHead(500);res.end('An error occurred.');}
});
server.listen(Number(env.PORT||4173),env.LOCAL_PREVIEW==='1'?'127.0.0.1':'0.0.0.0',()=>console.log('Reading Room listening on port',server.address().port));
