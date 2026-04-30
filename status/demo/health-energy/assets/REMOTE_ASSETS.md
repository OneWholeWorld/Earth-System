# Runtime Asset Policy

The health-energy demo uses a hybrid asset strategy:

- pinned CDNs for third-party JS/CSS libraries
- local files for visual textures and app data

## Libraries

Libraries are intentionally loaded from pinned CDN URLs:

- `https://unpkg.com/three@0.160.0/build/three.min.js`
- `https://unpkg.com/maplibre-gl@4.1.2/dist/maplibre-gl.js`
- `https://unpkg.com/maplibre-gl@4.1.2/dist/maplibre-gl.css`

Keep these versions pinned. Upgrade deliberately after testing rather than using floating latest URLs.

## Textures

- `textures/earth-blue-marble.jpg` from `https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg`
- `textures/earth-night.jpg` from `https://unpkg.com/three-globe/example/img/earth-night.jpg`
- `textures/moon-8k.jpg` from `https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_moon.jpg`
- `textures/earth_normal_2048.jpg` from `https://threejs.org/examples/textures/planets/earth_normal_2048.jpg`
- `textures/earth_specular_2048.jpg` from `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg`

The Moon texture is by Solar System Scope and licensed CC-BY-4.0 via Wikimedia Commons.

## Texture Experiment Notes

We tried several Earth texture directions before settling back on the original pairing:

- Solar System Scope 8K day/night maps were sharper, but the Earth felt flatter and less cinematic.
- NASA SVS day imagery had impressive detail, but the baked-in clouds changed the mood too much for this demo.
- NASA Blue Marble Next Generation cloud-free imagery was clean, but it lost some of the organic atmosphere of the original day map.
- NASA Black Marble night imagery was technically strong, but the city lights felt too flat and separate from the planet.
- The higher-resolution DMSP night map had more detail, both at full brightness and with a darker shader treatment, but it still felt more artificial than the original night side.

The version we liked most is the original `earth-blue-marble.jpg` day texture with the original `earth-night.jpg` night texture and the simple release-file night shader. It feels more unified, warmer, and more one-with-nature than the higher-resolution experiments. If future us wants to revisit this, recreate the experiment as a temporary switcher and compare against this baseline before changing the default.

## Data

- `data/world_population.csv` from `https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/world_population.csv`

## Map Tiles

MapLibre still uses live OpenStreetMap raster tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
Do not bulk-download those tiles into this repository. For a local/offline map, prefer a curated regional MBTiles/vector-tile package or a deliberately bounded raster tile cache with attribution and usage policy reviewed.
