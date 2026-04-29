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
- `textures/earth-black-marble-2016-8k.jpg`, an 8192x4096 app-friendly working copy of the Black Marble source from `https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/`
- `textures/moon-8k.jpg` from `https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_moon.jpg`
- `textures/earth_normal_2048.jpg` from `https://threejs.org/examples/textures/planets/earth_normal_2048.jpg`
- `textures/earth_specular_2048.jpg` from `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg`

The Moon texture is by Solar System Scope and licensed CC-BY-4.0 via Wikimedia Commons.
The Black Marble texture is from NASA Earth Observatory night-lights imagery.

## Data

- `data/world_population.csv` from `https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/world_population.csv`

## Map Tiles

MapLibre still uses live OpenStreetMap raster tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
Do not bulk-download those tiles into this repository. For a local/offline map, prefer a curated regional MBTiles/vector-tile package or a deliberately bounded raster tile cache with attribution and usage policy reviewed.
