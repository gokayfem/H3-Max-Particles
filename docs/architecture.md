# Architecture

- `studio.js`: renderer, GLSL simulation, target loading, playback, controls, collection, export orchestration. This is the standalone source snapshot; edit it directly in this repo.
- `studio-settings.js`: parameter validation, defaults and presets.
- `studio-post.js`: image effects and linear/sRGB handling.
- `browser-store.js`: OPFS imports and CDN byte-range/cache reads.
- `browser-analysis.js`: audio curves and local tracking for imports.
- `browser-export.js`: fixed-frame WebCodecs/Mediabunny encoding and offline audio.
- `studio.html`, CSS, and bundled fonts: fixed-viewport interface.

Simulation uses persistent tracks and fixed steps. Global effect amount changes force, density and distortion; it does not simply fade the final image. The source remains visible at zero effects. Face controls independently attenuate effects in tracked regions.

The example MP4 is an automated frame-by-frame rendering of the actual studio DOM and WebGL scene, including its controls and source soundtrack. It is not an OBS desktop capture or a frame-rate benchmark. The demo sequence shows original particles, clean comparison, music matching, flow, and a short scatter/reform.

Generation adapters, owner upload scripts, hosting credentials, local machines' paths, full raw caches, and private production files are deliberately outside this browser application repository.
