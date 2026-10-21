const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../src');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.png':'image/png'};
http.createServer((req,res)=>{
  try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep))throw Error();const stat=fs.statSync(file);if(!stat.isFile())throw Error();
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'"});fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('KontoKlar: http://127.0.0.1:4173'));
