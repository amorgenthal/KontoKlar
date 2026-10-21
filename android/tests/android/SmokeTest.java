package de.kontoklar.app;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class SmokeTest extends Instrumentation {
 private WebView web;private Activity activity;
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 private String js(String script)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
  runOnMainSync(()->web.evaluateJavascript(script,value->{result.set(value);latch.countDown();}));
  if(!latch.await(45,TimeUnit.SECONDS))throw new Exception("JS callback timeout");return result.get();
 }
 private void until(String expression,int seconds)throws Exception{
  long end=System.currentTimeMillis()+seconds*1000L;
  while(System.currentTimeMillis()<end){if("true".equals(js(expression)))return;Thread.sleep(700);}
  throw new Exception("Timed out: "+expression+"; status="+js("document.getElementById('status')?.textContent"));
 }
 private void require(boolean value,String message)throws Exception{if(!value)throw new Exception(message);}
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   ActivityMonitor monitor=new ActivityMonitor(){
    @Override public ActivityResult onStartActivity(Intent intent){
     if(Intent.ACTION_CREATE_DOCUMENT.equals(intent.getAction())){
      String file="application/pdf".equals(intent.getType())?"output.pdf":"output.png";
      return new ActivityResult(Activity.RESULT_OK,new Intent().setData(Uri.parse("content://de.kontoklar.app.test.exports/"+file)));
     }
     if(Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return new ActivityResult(Activity.RESULT_CANCELED,null);
     return null;
    }
   };addMonitor(monitor);
   Intent launch=new Intent().setClassName("de.kontoklar.app","de.kontoklar.app.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
   activity=startActivitySync(launch);
   runOnMainSync(()->{
    ViewGroup safeFrame=(ViewGroup)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
    web=(WebView)safeFrame.getChildAt(0);
   });
   until("!!document.getElementById('demo') && !document.getElementById('demo').disabled",120);
   js("document.getElementById('demo').click();document.getElementById('find').click();true");
   until("document.querySelectorAll('.suggestion').length===2",30);
   js("document.querySelectorAll('.suggestion button')[0].click();document.querySelectorAll('.suggestion button')[1].click();const p=document.getElementById('preview');p.checked=true;p.dispatchEvent(new Event('change'));const r=document.getElementById('reviewed');r.checked=true;r.dispatchEvent(new Event('change'));true");
   require("false".equals(js("document.getElementById('export-pdf').disabled")),"Review gate did not open");
   js("document.getElementById('export-pdf').click();true");
   until("document.getElementById('mobile-save-result').textContent.includes('gespeichert')",120);
   Uri pdfUri=Uri.parse("content://de.kontoklar.app.test.exports/output.pdf");
   try(ParcelFileDescriptor fd=getTargetContext().getContentResolver().openFileDescriptor(pdfUri,"r");PdfRenderer pdf=new PdfRenderer(fd)){
    require(pdf.getPageCount()==1,"Native PDF export page count");
   }
   File saved=new File(getTargetContext().getExternalFilesDir(null),"smoke-export.pdf");
   try(InputStream in=getTargetContext().getContentResolver().openInputStream(pdfUri);FileOutputStream out=new FileOutputStream(saved)){byte[] data=new byte[65536];int n;while((n=in.read(data))!=-1)out.write(data,0,n);}
   js("document.getElementById('mobile-save-result').textContent='';document.getElementById('export-png').click();true");
   until("document.getElementById('mobile-save-result').textContent.includes('gespeichert')",90);
   try(InputStream input=getTargetContext().getContentResolver().openInputStream(Uri.parse("content://de.kontoklar.app.test.exports/output.png"))){
    Bitmap image=BitmapFactory.decodeStream(input);require(image!=null,"PNG not decodable");
    require((image.getPixel(200,520)&0xffffff)==0,"Unrelated booking leaked");
    require((image.getPixel(200,700)&0xffffff)==0xffffff,"Relevant booking missing");image.recycle();
   }
   // Actual WebView file chooser must return cleanly when canceled.
   CountDownLatch chooser=new CountDownLatch(1);
   runOnMainSync(()->web.getWebChromeClient().onShowFileChooser(web,uris->{chooser.countDown();},null));
   require(chooser.await(30,TimeUnit.SECONDS),"Native file chooser callback missing");
   // A bitmap input without a text layer forces real offline WebAssembly OCR.
   byte[] png;
   try(InputStream in=getContext().getAssets().open("Beispiel-Kontoauszug.png");ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] chunk=new byte[65536];int n;while((n=in.read(chunk))!=-1)out.write(chunk,0,n);png=out.toByteArray();
   }
   String encoded=Base64.encodeToString(png,Base64.NO_WRAP);
   js("(()=>{const b=Uint8Array.from(atob('"+encoded+"'),c=>c.charCodeAt(0));const d=new DataTransfer();d.items.add(new File([b],'Bild.png',{type:'image/png'}));const input=document.getElementById('files');input.files=d.files;input.dispatchEvent(new Event('change'));return true})()");
   until("document.querySelectorAll('.page-item').length===2 && !document.getElementById('find').disabled",60);
   js("document.getElementById('find').click();true");
   until("!document.getElementById('find').disabled && document.querySelectorAll('.suggestion').length===2",240);
   result.putString("stream","PASS: Android 15 WebView local assets, no INTERNET permission, real offline OCR, review gate, native file chooser callback, PDF/PNG exports through Android ContentResolver.\n");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","FAIL: "+e.toString()+"\n");finish(Activity.RESULT_CANCELED,result);}
 }
}
