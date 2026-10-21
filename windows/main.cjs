const {app,BrowserWindow,session}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'src');
for(const option of ['disable-background-networking','disable-component-update','disable-domain-reliability','no-pings'])app.commandLine.appendSwitch(option);
let server;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.gz':'application/gzip','.ttf':'font/ttf','.pfb':'application/octet-stream'};
function serve(req,res){
  try{
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const stat=fs.statSync(file);if(!stat.isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'"});
    fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
}
app.whenReady().then(()=>{
  server=http.createServer(serve);server.listen(0,'127.0.0.1',()=>{
    const origin=`http://127.0.0.1:${server.address().port}`;
    const localSession=session.fromPartition('kontoklar-memory');
    localSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    localSession.webRequest.onBeforeRequest((details,callback)=>{
      const url=details.url;callback({cancel:!(url.startsWith(origin+'/') || /^(blob:|data:)/.test(url))});
    });
    const win=new BrowserWindow({width:1450,height:960,minWidth:980,minHeight:700,title:'KontoKlar',backgroundColor:'#f3f5f8',autoHideMenuBar:true,
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,session:localSession,spellcheck:false}});
    win.setMenu(null);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
    localSession.on('will-download',(_event,item)=>{
      item.setSaveDialogOptions({title:'Geschwärzten Nachweis speichern',defaultPath:path.join(app.getPath('documents'),path.basename(item.getFilename()))});
    });
    win.webContents.on('will-prevent-unload',event=>{
      const {dialog}=require('electron');const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Zurück','App schließen'],defaultId:0,cancelId:0,message:'Sitzung beenden?',detail:'Dokumente und Markierungen werden nicht automatisch gespeichert. Bereits exportierte Dateien bleiben erhalten.'});
      if(choice===1)event.preventDefault();
    });
    win.loadURL(origin+'/');
  });
});
app.on('window-all-closed',()=>{server?.close();app.quit();});
