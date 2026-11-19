#!/bin/bash
# usage: preview.sh "frames" [res] [spp]   -> $WORK/prev_jpg/s*.jpg contact sheets   (WORK defaults to /tmp/babypov)
set -e
cd "$(dirname "$0")"
WORK="${WORK:-/tmp/babypov}"
FR="$1"; RES="${2:-640x360}"; SPP="${3:-12}"
rm -rf $WORK/prev $WORK/prev_jpg
python3 render.py --blend $WORK/scene.blend --out $WORK/prev --res $RES --spp $SPP --frames "$FR" 2>&1 | grep -E "Error|error|Traceback" | grep -v CUEW || true
python3 post.py --exr $WORK/prev --stills $WORK/prev_jpg --size $RES > /dev/null
cd $WORK/prev_jpg && python3 -c "
import cv2, numpy as np, glob
fs=sorted(glob.glob('f*.jpg'))
ims=[cv2.resize(cv2.imread(f),(640,360)) for f in fs]
for f,im in zip(fs,ims):
    cv2.putText(im,f[1:5],(8,24),cv2.FONT_HERSHEY_SIMPLEX,0.7,(0,255,255),2)
for k in range(0,len(ims),6):
    c=ims[k:k+6]; c+= [np.zeros_like(ims[0])]*(6-len(c))
    cv2.imwrite('s%d.jpg'%(k//6+1), np.vstack([np.hstack(c[0:3]),np.hstack(c[3:6])]))
"
