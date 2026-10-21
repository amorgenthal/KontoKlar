const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../app/src/main/assets/web');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm'};
http.createServer((req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!f.startsWith(root+path.sep))throw Error();const s=fs.statSync(f);if(!s.isFile())throw Error();res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'"});fs.createReadStream(f).pipe(res);}catch{res.writeHead(404);res.end();}
}).listen(4174,'127.0.0.1',()=>console.log('Android interface: http://127.0.0.1:4174'));
