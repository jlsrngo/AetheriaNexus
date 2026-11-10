# 04-3d-render 

 Blender(5.1, Cycles), `index.html` , , . : 

```bash
python3 blender/make_letters.py                          #  →  assets/mesh/*.ply()
python3 blender/sim.py                                   #  → work/anim.npz,  → out/events.json()
blender -b --factory-startup -P blender/scene.py         #  → work/scene.blend
blender -b work/scene.blend -P blender/render.py -- --range 0:239   # 240  → out/frames/(macOS  Metal; NVIDIA  MG_DEVICE=OPTIX)
python3 audio.py                                         #  → out/audio.wav
cd ../.. && node harness/render.mjs demos/04-3d-render   #  → out/video.mp4
```
