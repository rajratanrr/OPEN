#!/usr/bin/env python3
"""Start the compiled Java app with the local, ignored environment file."""
import os, shutil, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env=root/'.env.local'
if env.exists():
    for line in env.read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            key,value=line.split('=',1);os.environ.setdefault(key,value)
java=Path(os.environ.get('JAVA_HOME','/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home'))/'bin/java'
os.chdir(root)
runtime=root/'.runtime'
runtime.mkdir(exist_ok=True)
jar=runtime/('api-'+str(int(time.time()))+'.jar')
shutil.copy2(root/'backend/target/roadsaathi-api-1.0.0.jar',jar)
os.execvp(str(java) if java.exists() else 'java',[str(java) if java.exists() else 'java','-jar',str(jar)])
