# prasunjha8 · portfolio

A static personal site: HTML, CSS and vanilla JS, with three.js loaded from a CDN. There is no build step.

## Run locally
The GLB model has to be served over HTTP, so opening `index.html` as a `file://` won't load it.
```bash
cd ~/Desktop/my_personalportfolio
python3 -m http.server 8765        # then open http://localhost:8765
```
Add `?skipboot` to the URL to skip the boot animation.

## Structure
```
index.html            content (edit projects / text here)
css/style.css         theme tokens at the top (:root)
js/main.js            UI animations + 2D mini-simulations for project cards
js/scene.js           three.js hero: Blender rover + live 2D LiDAR raycast
js/voxelize.js        voxel disintegrate/re-assemble effect (InstancedMesh, surface-sampled)
blender/transcode.py  compresses screen recordings to web MP4 using Blender's bundled FFmpeg
blender/build_rover.py  procedural rover → assets/models/rover.glb + assets/img/rover-render.png
```

## Rebuild the 3D rover
```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_rover.py
```

## Deploy (GitHub Pages)
1. Create a repo named `prasunjha8.github.io`.
2. Push this folder to it.
3. In Settings → Pages, choose to deploy from the `main` branch, `/root`.
4. The site goes live at `https://prasunjha8.github.io`.
