package de.kontoklar.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Insets;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int OPEN_FILES = 41, SAVE_FILE = 42;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ExportBridge bridge = new ExportBridge();
    private boolean closing;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        // Delete abandoned export buffers from a prior terminated session.
        File[] stale = getCacheDir().listFiles((dir,name)->name.startsWith("kk-export-"));
        if(stale!=null) for(File f:stale) f.delete();
        // Android 15 draws target-35 activities behind the system bars. Insets
        // belong on a native parent: WebView padding does not move its CSS
        // viewport, so sticky headers and fixed navigation can still overlap.
        View decor=getWindow().getDecorView();
        int flags=decor.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        else flags|=View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        decor.setSystemUiVisibility(flags);
        getWindow().setStatusBarColor(0xffffffff);
        getWindow().setNavigationBarColor(0xffffffff);
        FrameLayout safeFrame=new FrameLayout(this);
        safeFrame.setBackgroundColor(0xffffffff);
        safeFrame.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                Insets safe=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return WindowInsets.CONSUMED;
            }
            int left=insets.getSystemWindowInsetLeft(),top=insets.getSystemWindowInsetTop(),right=insets.getSystemWindowInsetRight(),bottom=insets.getSystemWindowInsetBottom();
            if(insets.getDisplayCutout()!=null){
                left=Math.max(left,insets.getDisplayCutout().getSafeInsetLeft());
                top=Math.max(top,insets.getDisplayCutout().getSafeInsetTop());
                right=Math.max(right,insets.getDisplayCutout().getSafeInsetRight());
                bottom=Math.max(bottom,insets.getDisplayCutout().getSafeInsetBottom());
            }
            view.setPadding(left,top,right,bottom);
            return insets.consumeDisplayCutout().consumeSystemWindowInsets();
        });
        web = new WebView(this);
        web.setBackgroundColor(0xfff3f5f8);
        safeFrame.addView(web,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(safeFrame);
        safeFrame.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(bridge, "KontoKlarNative");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if(!isLocal(uri) || !"GET".equals(request.getMethod())) return denied();
                String name=uri.getPath().substring("/assets/".length());
                if(name.contains("..") || name.contains("\\")) return denied();
                try {
                    Map<String,String> headers=new HashMap<>();
                    headers.put("Cache-Control","no-store");
                    headers.put("X-Content-Type-Options","nosniff");
                    headers.put("Content-Security-Policy","default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'");
                    return new WebResourceResponse(mime(name), "UTF-8",200,"OK",headers,getAssets().open("web/"+name));
                } catch(Exception e) {return denied();}
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/pdf","image/png","image/jpeg","image/webp","image/bmp"});
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(intent,OPEN_FILES);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;toast("Dateiauswahl konnte nicht geöffnet werden.");}
                return true;
            }
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Ja",(d,w)->result.confirm()).setNegativeButton("Abbrechen",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
            }
        });
        web.loadUrl(ORIGIN+"/assets/index.html");
    }
    private static boolean isLocal(Uri uri){return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPath()!=null && uri.getPath().startsWith("/assets/");}
    private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));}
    private static String mime(String name){
        if(name.endsWith(".html"))return "text/html";if(name.endsWith(".css"))return "text/css";
        if(name.endsWith(".js")||name.endsWith(".mjs"))return "text/javascript";if(name.endsWith(".wasm"))return "application/wasm";
        if(name.endsWith(".png"))return "image/png";if(name.endsWith(".json"))return "application/json";return "application/octet-stream";
    }
    private void toast(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
    private void saveResult(String message,boolean error){runOnUiThread(()->{
        if(!isFinishing())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('kontoklar-save-result',{detail:{error:"+error+",message:"+JSONObject.quote(message)+"}}))",null);
        toast(message);
    });}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILES && fileCallback!=null){
            Uri[] uris=null;
            if(result==RESULT_OK && data!=null){
                ClipData clips=data.getClipData();
                if(clips!=null){uris=new Uri[clips.getItemCount()];for(int i=0;i<uris.length;i++)uris[i]=clips.getItemAt(i).getUri();}
                else if(data.getData()!=null)uris=new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(uris);fileCallback=null;
        }
        if(request==SAVE_FILE){
            if(result!=RESULT_OK || data==null || data.getData()==null){bridge.abortExport();saveResult("Speichern abgebrochen. Du kannst erneut exportieren.",false);return;}
            Uri target=data.getData();
            io.execute(()->{
                try {
                    File pending=bridge.exportFile();
                    if(pending==null)throw new IllegalStateException();
                    try(InputStream input=new FileInputStream(pending);OutputStream output=getContentResolver().openOutputStream(target,"wt")){
                        if(output==null)throw new IllegalStateException();byte[] buffer=new byte[65536];int count;
                        while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
                    }
                    saveResult("Geschwärzter Nachweis gespeichert.",false);
                }catch(Exception e){saveResult("Datei konnte nicht gespeichert werden. Bitte erneut exportieren und einen anderen Zielordner wählen.",true);}
                finally{bridge.abortExport();}
            });
        }
    }
    @Override public void onBackPressed(){
        if(closing){super.onBackPressed();return;}
        web.evaluateJavascript("document.querySelectorAll('.page-item').length",value->{
            if("0".equals(value)){closing=true;finish();return;}
            new AlertDialog.Builder(this).setTitle("Sitzung beenden?").setMessage("Dokumente und Markierungen werden nicht automatisch gespeichert. Bereits exportierte Dateien bleiben erhalten.").setPositiveButton("Beenden",(d,w)->{closing=true;finish();}).setNegativeButton("Zurück",null).show();
        });
    }
    @Override protected void onDestroy(){
        if(fileCallback!=null)fileCallback.onReceiveValue(null);
        bridge.abortExport();io.shutdown();
        if(web!=null){web.removeJavascriptInterface("KontoKlarNative");web.destroy();}
        super.onDestroy();
    }

    public final class ExportBridge {
        private File file;private FileOutputStream stream;private String name,type;private long size;private boolean waiting;
        @JavascriptInterface public synchronized boolean beginExport(String filename,String mime){
            if(file!=null)return false;
            if(filename==null || !filename.matches("[A-Za-z0-9_.-]{1,100}") || !("application/pdf".equals(mime)||"image/png".equals(mime)))return false;
            try{file=new File(getCacheDir(),"kk-export-"+UUID.randomUUID());stream=new FileOutputStream(file);name=filename;type=mime;size=0;waiting=false;return true;}
            catch(Exception e){abortExport();return false;}
        }
        @JavascriptInterface public synchronized boolean appendChunk(String base64){
            if(stream==null || waiting || base64==null || base64.length()>100000)return false;
            try{byte[] bytes=Base64.decode(base64,Base64.NO_WRAP);size+=bytes.length;if(size>150L*1024*1024){abortExport();return false;}stream.write(bytes);return true;}
            catch(Exception e){abortExport();return false;}
        }
        @JavascriptInterface public synchronized boolean finishExport(){
            if(stream==null || waiting || size<8)return false;
            try{
                stream.close();stream=null;
                try(FileInputStream input=new FileInputStream(file)){
                    byte[] header=new byte[8];if(input.read(header)!=8){abortExport();return false;}
                    boolean valid="application/pdf".equals(type)?new String(header,StandardCharsets.US_ASCII).startsWith("%PDF-"):
                        header[0]==(byte)137 && header[1]==80 && header[2]==78 && header[3]==71 && header[4]==13 && header[5]==10 && header[6]==26 && header[7]==10;
                    if(!valid){abortExport();return false;}
                }
                waiting=true;
                runOnUiThread(()->{
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(type);intent.putExtra(Intent.EXTRA_TITLE,name);
                    try{startActivityForResult(intent,SAVE_FILE);}catch(Exception e){abortExport();saveResult("Speicherdialog konnte nicht geöffnet werden.",true);}
                });return true;
            }catch(Exception e){abortExport();return false;}
        }
        @JavascriptInterface public synchronized void abortExport(){
            try{if(stream!=null)stream.close();}catch(Exception ignored){}stream=null;
            if(file!=null)file.delete();file=null;size=0;waiting=false;
        }
        synchronized File exportFile(){return waiting?file:null;}
    }
}
