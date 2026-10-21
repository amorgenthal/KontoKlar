"""Download the pinned, checksum-verified toolchain used for the APK build."""
import hashlib
import os
from pathlib import Path
import sys
import urllib.request
import zipfile

root=Path(sys.argv[1]).resolve();root.mkdir(parents=True,exist_ok=True)
archives=[
 ('platform.zip','https://dl.google.com/android/repository/platform-35_r02.zip','0bb560a90a7a2cbd0dd8348224d518b638fe7949'),
 ('build-tools.zip','https://dl.google.com/android/repository/build-tools_r35_linux.zip','2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc'),
]
for name,url,sha1 in archives:
 p=root/name
 if not p.exists():urllib.request.urlretrieve(url,p)
 if hashlib.sha1(p.read_bytes()).hexdigest()!=sha1:raise ValueError('Checksum mismatch: '+name)
 with zipfile.ZipFile(p) as z:
  for e in z.infolist():
   if not (root/e.filename).resolve().is_relative_to(root):raise ValueError('Unsafe archive path')
  z.extractall(root)
  for e in z.infolist():
   mode=e.external_attr>>16
   if mode&0o111:os.chmod(root/e.filename,mode & 0o777)
 print('Verified and extracted:',name)
ecj=root/'ecj.jar'
url='https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.39.0/ecj-3.39.0.jar'
if not ecj.exists():urllib.request.urlretrieve(url,ecj)
expected=urllib.request.urlopen(url+'.sha1').read().decode().strip()
if hashlib.sha1(ecj.read_bytes()).hexdigest()!=expected:raise ValueError('ECJ checksum mismatch')
print('Verified: ECJ 3.39.0')
