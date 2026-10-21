package de.kontoklar.app;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;

// Test APK only. Receives exclusively synthetic exports during instrumentation.
public final class ExportTestProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
  String name=uri.getLastPathSegment();if(!"output.pdf".equals(name)&&!"output.png".equals(name))throw new FileNotFoundException();
  File file=new File(getContext().getCacheDir(),name);
  int flags=mode.contains("w")?ParcelFileDescriptor.MODE_CREATE|ParcelFileDescriptor.MODE_TRUNCATE|ParcelFileDescriptor.MODE_READ_WRITE:ParcelFileDescriptor.MODE_READ_ONLY;
  return ParcelFileDescriptor.open(file,flags);
 }
 public String getType(Uri uri){return uri.toString().endsWith(".pdf")?"application/pdf":"image/png";}
 public Cursor query(Uri u,String[] p,String s,String[] a,String o){return null;}
 public Uri insert(Uri u,ContentValues v){return null;}
 public int delete(Uri u,String s,String[] a){return 0;}
 public int update(Uri u,ContentValues v,String s,String[] a){return 0;}
}
