#!/bin/bash
# Full pipeline: build scene -> render EXR frames -> synthesise audio -> grade + encode MP4.
# Rendering is resumable: re-run to continue. ~17 s/frame on 4 CPU cores (912 frames).
# Look: photoreal by default; BABYPOV_STYLE=pixar ./make.sh baby_pov_adi_pixar.mp4 for the 3D-animation version.
set -e
cd "$(dirname "$0")"
WORK="${WORK:-/tmp/babypov${BABYPOV_STYLE:+/$BABYPOV_STYLE}}"
mkdir -p "$WORK/exr"
[ -f "$WORK/scene_final.blend" ] || python3 build.py "$WORK/scene_final.blend"
python3 render.py --blend "$WORK/scene_final.blend" --out "$WORK/exr" --res 1280x720 --spp 10 --frames "0-911:8,0-911"
python3 audio.py "$WORK/audio.wav"
python3 post.py --exr "$WORK/exr" --audio "$WORK/audio.wav" --size 1920x1080 --out "${1:-baby_pov_adi.mp4}"
