/* Local platform adapter. Native interface is available only in the Android APK. */
window.KontoKlarPlatform = {
  mobile:true,
  async saveFile(blob,name){
    const bridge=window.KontoKlarNative;
    if(!bridge)throw new Error('Android-Speicherdialog ist nicht verfügbar.');
    if(!bridge.beginExport(name,blob.type))throw new Error('Ein Speicherdialog ist noch geöffnet. Bitte zuerst abschließen oder abbrechen.');
    try{
      const buffer=new Uint8Array(await blob.arrayBuffer());
      for(let i=0;i<buffer.length;i+=49152){
        const part=buffer.subarray(i,Math.min(i+49152,buffer.length));
        let binary='';for(let j=0;j<part.length;j++)binary+=String.fromCharCode(part[j]);
        if(!bridge.appendChunk(btoa(binary)))throw new Error('Datei konnte nicht für Android vorbereitet werden.');
        if(i%(49152*8)===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(!bridge.finishExport())throw new Error('Speicherdialog konnte nicht geöffnet werden.');
    }catch(e){bridge.abortExport();throw e;}
  }
};
document.addEventListener('DOMContentLoaded',()=>{
  document.body.dataset.tab='documents';
  const tabs=document.querySelectorAll('[data-tab-target]');
  function tab(name){
    document.body.dataset.tab=name;
    tabs.forEach(b=>{b.classList.toggle('active',b.dataset.tabTarget===name);b.setAttribute('aria-selected',String(b.dataset.tabTarget===name));});
    if(name==='edit')requestAnimationFrame(zoom);
    window.scrollTo(0,0);
  }
  tabs.forEach(b=>b.onclick=()=>tab(b.dataset.tabTarget));
  let searching=false,importing=false;
  const find=document.getElementById('find'),files=document.getElementById('files');
  find.addEventListener('click',()=>{searching=true;},true);
  document.getElementById('query').addEventListener('keydown',e=>{if(e.key==='Enter')searching=true;},true);
  files.addEventListener('change',()=>{importing=true;},true);
  new MutationObserver(()=>{
    if(find.disabled)return;
    if(importing){importing=false;tab('edit');}
    if(searching){searching=false;if(document.querySelector('.suggestion'))tab('review');}
  }).observe(find,{attributes:true,attributeFilter:['disabled']});
  document.getElementById('pages').addEventListener('click',e=>{if(e.target.closest('.page-item'))tab('edit');});
  document.getElementById('suggestions').addEventListener('click',e=>{if(e.target.closest('button'))tab('edit');});
  document.getElementById('demo').addEventListener('click',()=>{if(!find.disabled)tab('edit');});
  document.getElementById('mobile-preview').onclick=()=>{
    const preview=document.getElementById('preview');if(preview.disabled)return;
    preview.checked=true;preview.dispatchEvent(new Event('change'));tab('edit');
  };
  function zoom(){
    const stage=document.getElementById('stage'),paper=document.getElementById('paper');
    if(paper.hidden || !stage.clientWidth)return;
    const ratio=Number(document.getElementById('mobile-zoom').value);
    paper.style.width=`${Math.max(200,stage.clientWidth-26)*ratio}px`;
  }
  document.getElementById('mobile-zoom').onchange=zoom;
  window.addEventListener('resize',zoom);
  new MutationObserver(zoom).observe(document.getElementById('paper'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('kontoklar-save-result',e=>{
    const status=document.getElementById('status');status.textContent=e.detail.message;status.classList.toggle('error',Boolean(e.detail.error));
    const result=document.getElementById('mobile-save-result');result.textContent=e.detail.message;result.classList.toggle('error',Boolean(e.detail.error));
  });
  tab('documents');
});
