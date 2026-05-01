(() => {
  const DATA_URL = './assets/data/worldcities.csv';
  const FLY_TO_CITY_2D_ZOOM = 10.4;
  const ENERGY_SYSTEMS = [
    { name: 'Goa', lat: 15.5588, lng: 73.7700, primary: true },
    { name: 'Portland', lat: 45.5152, lng: -122.6784 },
    { name: 'Pune', lat: 18.5204, lng: 73.8567 },
    { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Victoria', lat: 48.4284, lng: -123.3656 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 }
  ];

  let api;
  let energyMode = false;
  let healthMode = false;
  let healthOnlyPositive = false;
  let healthOnlyNegative = false;
  let healthClusterMode = false;
  let heightMinPercent = 0;
  let heightMaxPercent = 100;
  let healthCities = [];
  let fullPopulationMaxPop = 1;
  let displayedHealthCities = [];
  let selectedEnergySystem = null;
  let focusedEnergySystem = null;
  let elevatedEnergy = false;
  let selectedHealthMeta = null;
  let energyLayer = null;
  let healthLayer = null;
  let healthGeoJSON = { type: 'FeatureCollection', features: [] };
  let mapHealthInteractionsReady = false;

  const els = {
    energyBtn: document.getElementById('showEnergyBtn'),
    healthBtn: document.getElementById('showHealthBtn'),
    statusChip: document.getElementById('status-chip'),
    inspectPanel: document.getElementById('inspectPanel'),
    inspectTitle: document.getElementById('inspectTitle'),
    inspectSubtitle: document.getElementById('inspectSubtitle'),
    closeInspectBtn: document.getElementById('closeInspectBtn'),
    satisfiedBtn: document.getElementById('satisfiedBtn'),
    notSatisfiedBtn: document.getElementById('notSatisfiedBtn'),
    focusEnergyBtn: document.getElementById('focusEnergyBtn'),
    elevateBtn: document.getElementById('elevateBtn'),
    healthPositiveBtn: document.getElementById('healthPositiveBtn'),
    healthNegativeBtn: document.getElementById('healthNegativeBtn'),
    healthClusterBtn: document.getElementById('healthClusterBtn'),
    heightRangeMin: document.getElementById('heightRangeMin'),
    heightRangeMax: document.getElementById('heightRangeMax'),
    heightSliderFill: document.getElementById('heightSliderFill'),
    heightRangeReadout: document.getElementById('heightRangeReadout'),
    heightRangeCount: document.getElementById('heightRangeCount'),
    openFiltersBtn: document.getElementById('openFiltersBtn'),
    tooltip: document.getElementById('pillarTooltip'),
    hoverFlag: document.getElementById('cityHoverFlag'),
    flyInput: document.getElementById('flyInput'),
    flyClearBtn: document.getElementById('flyClearBtn'),
    flySuggestions: document.getElementById('flySuggestions')
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"' && quoted && next === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        row.push(value);
        value = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        value = '';
      } else {
        value += ch;
      }
    }
    if (value || row.length) {
      row.push(value);
      rows.push(row);
    }
    return rows;
  }

  async function loadCities() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load ${DATA_URL}: ${res.status}`);
    const rows = parseCSV(await res.text());
    const header = rows.shift().map(h => h.trim().toLowerCase());
    const idx = key => header.indexOf(key);
    const cityIdx = idx('city');
    const asciiIdx = idx('city_ascii');
    const adminIdx = idx('admin_name');
    const latIdx = idx('lat');
    const lngIdx = idx('lng');
    const popIdx = idx('population');
    return rows.map((row, index) => ({
      id: `city-${index}`,
      city: (row[cityIdx] || row[asciiIdx] || '').trim(),
      cityAscii: (row[asciiIdx] || row[cityIdx] || '').trim(),
      adminName: (row[adminIdx] || '').trim(),
      lat: Number(row[latIdx]),
      lng: Number(row[lngIdx]),
      pop: Number(row[popIdx]) || 0
    })).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.pop > 0)
      .sort((a, b) => b.pop - a.pop);
  }

  function labelForCity(d) {
    if (!d) return '';
    return d.adminName ? `${d.city || d.cityAscii}, ${d.adminName}` : (d.city || d.cityAscii || `${d.lat.toFixed(2)}, ${d.lng.toFixed(2)}`);
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function healthShare(lat, lng) {
    const a = 0.5 + 0.5 * Math.sin((lat + 18.0) * 0.11);
    const b = 0.5 + 0.5 * Math.cos((lng - 22.0) * 0.08);
    const c = 0.5 + 0.5 * Math.sin((lat + lng) * 0.045);
    const d = 0.5 + 0.5 * Math.cos((lat - lng) * 0.035);
    return Math.pow(clamp01(a * 0.34 + b * 0.28 + c * 0.22 + d * 0.16), 1.65);
  }

  function fullPopulationMax() {
    return fullPopulationMaxPop || 1;
  }

  function populationNorm(pop) {
    return Math.sqrt((Number(pop) || 0) / fullPopulationMax());
  }

  function buildDisplayCities() {
    let data = healthCities.filter(d => {
      const percentile = populationNorm(d.pop) * 100;
      return percentile >= heightMinPercent && percentile <= heightMaxPercent;
    });
    if (!healthClusterMode) return data;

    const cells = new Map();
    for (const d of data) {
      const key = `${Math.floor((d.lat + 90) / 2.5)}_${Math.floor((d.lng + 180) / 2.5)}`;
      if (!cells.has(key)) {
        cells.set(key, {
          pop: 0,
          latSum: 0,
          lngSum: 0,
          count: 0,
          largestCity: null,
          largestPop: -Infinity
        });
      }
      const cell = cells.get(key);
      cell.pop += d.pop;
      cell.latSum += d.lat * d.pop;
      cell.lngSum += d.lng * d.pop;
      cell.count += 1;
      if (d.pop > cell.largestPop) {
        cell.largestPop = d.pop;
        cell.largestCity = d;
      }
    }
    return Array.from(cells.values()).filter(d => d.pop && d.largestCity).map((d, i) => {
      const labelBase = d.largestCity.placeLabel || d.largestCity.city || d.largestCity.cityAscii || d.largestCity.adminName || 'Region';
      const placeLabel = d.count > 1 ? `${labelBase} region` : labelBase;
      return {
        id: `cluster-${i}`,
        source: 'cluster',
        city: placeLabel,
        cityAscii: placeLabel,
        adminName: d.largestCity.adminName || null,
        placeLabel,
        lat: d.latSum / d.pop,
        lng: d.lngSum / d.pop,
        pop: d.pop,
        isCluster: d.count > 1,
        clusterCount: d.count
      };
    }).sort((a, b) => b.pop - a.pop);
  }

  function makeHealthGeoJSON(data) {
    return {
      type: 'FeatureCollection',
      features: data.map(d => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          name: labelForCity(d),
          lat: d.lat,
          lng: d.lng,
          pop: d.pop,
          popNorm: populationNorm(d.pop),
          greenShare: healthShare(d.lat, d.lng)
        }
      }))
    };
  }

  function showPanel(mode, payload) {
    els.inspectPanel.classList.add('visible');
    document.body.classList.toggle('health-panel-mode', mode === 'health');
    const healthControls = [els.healthPositiveBtn, els.healthNegativeBtn, els.healthClusterBtn, els.heightRangeMax.parentElement];
    const energyControls = [els.satisfiedBtn, els.notSatisfiedBtn, els.focusEnergyBtn, els.elevateBtn];
    healthControls.forEach(el => { el.style.display = mode === 'health' ? 'block' : 'none'; });
    energyControls.forEach(el => { el.style.display = mode === 'energy' ? 'block' : 'none'; });
    if (mode === 'health') {
      els.inspectTitle.textContent = 'Health Filters';
      els.inspectSubtitle.textContent = 'Filter positive, negative, cluster, and column height.';
    } else {
      els.inspectTitle.textContent = payload ? payload.name : 'Inspect System';
      els.inspectSubtitle.textContent = payload ? `Energy node: ${payload.state || 'default'}` : 'Set the system state.';
    }
  }

  function closePanel() {
    els.inspectPanel.classList.remove('visible');
    if ((healthMode || energyMode) && els.openFiltersBtn) els.openFiltersBtn.classList.add('visible');
  }

  function restorePanel() {
    if (els.openFiltersBtn) els.openFiltersBtn.classList.remove('visible');
    if (healthMode) showPanel('health');
    else if (energyMode) showPanel('energy', selectedEnergySystem || focusedEnergySystem);
  }

  function updateButtons() {
    els.energyBtn.classList.toggle('active', energyMode);
    els.healthBtn.classList.toggle('active', healthMode);
    els.energyBtn.textContent = energyMode ? 'Hide Energy' : 'Show Energy';
    els.healthBtn.textContent = healthMode ? 'Hide Health' : 'Show Health';
    els.energyBtn.style.display = healthMode ? 'none' : 'block';
    els.healthBtn.style.display = energyMode ? 'none' : 'block';
    els.healthPositiveBtn.classList.toggle('active', healthOnlyPositive);
    els.healthNegativeBtn.classList.toggle('active', healthOnlyNegative);
    els.healthClusterBtn.textContent = healthClusterMode ? 'Show Raw Cities' : 'Cluster Cities';
    els.heightRangeReadout.textContent = `Showing ${heightMinPercent}th - ${heightMaxPercent}th percentile column height`;
    els.heightRangeCount.textContent = displayedHealthCities.length
      ? `${displayedHealthCities.length.toLocaleString()} displayed of ${healthCities.length.toLocaleString()} cities`
      : 'No cities in range';
    if (els.heightSliderFill) {
      els.heightSliderFill.style.left = `${heightMinPercent}%`;
      els.heightSliderFill.style.width = `${heightMaxPercent - heightMinPercent}%`;
    }
    els.statusChip.textContent = energyMode ? 'energy layer' : healthMode ? 'health layer' : 'earth-core layered app';
    setMapHealthVisibility();
  }

  function createEnergyLayer() {
    const THREE = api.THREE;
    const group = new THREE.Group();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const systems = ENERGY_SYSTEMS.map((data, index) => {
      const node = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(data.primary ? 0.052 : 0.036, 32, 18), new THREE.MeshBasicMaterial({ color: 0x6fbaff, transparent: true, opacity: 0.95 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(data.primary ? 0.12 : 0.082, 32, 18), new THREE.MeshBasicMaterial({ color: 0x4da6ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(data.primary ? 0.076 : 0.055, 0.003, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.0 }));
      node.add(glow, dome, ring);
      group.add(node);
      return { ...data, index, node, dome, glow, ring, state: 'default', currentAnchor: new THREE.Vector3() };
    });
    focusedEnergySystem = systems[0];
    const arcLines = systems.slice(1).map(system => {
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.7 }));
      group.add(line);
      return { system, line };
    });

    function colorForState(state) {
      if (state === 'satisfied') return { dome: 0x16a34a, glow: 0x16a34a };
      if (state === 'notSatisfied') return { dome: 0xdc2626, glow: 0xdc2626 };
      return { dome: 0x6fbaff, glow: 0x4da6ff };
    }

    function surfacePosition(system) {
      return api.latLngToVec(system.lat, system.lng, 1.045)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), api.earthGroup.rotation.y)
        .multiplyScalar(api.earthGroup.scale.x);
    }

    function elevatedPosition(system) {
      if (system === focusedEnergySystem) return new THREE.Vector3(0, 1.13 * api.earthGroup.scale.x, 0);
      const others = systems.filter(item => item !== focusedEnergySystem);
      const idx = Math.max(0, others.indexOf(system));
      const angle = (idx / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = 0.44 * api.earthGroup.scale.x;
      return new THREE.Vector3(Math.cos(angle) * radius, 1.08 * api.earthGroup.scale.x, Math.sin(angle) * radius);
    }

    function arcPoints(a, b) {
      const start = a.currentAnchor.clone();
      const end = b.currentAnchor.clone();
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const lift = elevatedEnergy ? 0.18 : Math.min(1.4, start.distanceTo(end) * 0.55);
      const control = mid.lengthSq() ? mid.clone().normalize().multiplyScalar(mid.length() + lift) : new THREE.Vector3(0, 1, 0);
      return new THREE.QuadraticBezierCurve3(start, control, end).getPoints(40);
    }

    function setSelected(system) {
      selectedEnergySystem = system;
      showPanel('energy', system);
      if (els.openFiltersBtn) els.openFiltersBtn.classList.remove('visible');
      systems.forEach(item => { item.ring.material.opacity = item === system ? 0.95 : 0; });
    }

    function update() {
      const visible = energyMode && api.getState().mode === 'globe' && api.getState().target === 'earth';
      group.visible = visible;
      if (!visible) return;
      const now = performance.now() * 0.001;
      systems.forEach(system => {
        const target = elevatedEnergy ? elevatedPosition(system) : surfacePosition(system);
        system.node.position.lerp(target, 0.10);
        const outward = system.node.position.lengthSq() ? system.node.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
        system.node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
        system.currentAnchor.copy(system.node.position.clone().add(outward.multiplyScalar(0.035)));
        const colors = colorForState(system.state);
        system.dome.material.color.setHex(colors.dome);
        system.glow.material.color.setHex(colors.glow);
        const pulse = system === focusedEnergySystem ? 1.06 + Math.sin(now * 2.2) * 0.05 : 1 + Math.sin(now + system.index) * 0.025;
        system.dome.scale.setScalar(pulse);
        system.glow.scale.setScalar(pulse * 1.05);
      });
      arcLines.forEach(({ system, line }) => {
        line.visible = !!focusedEnergySystem;
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints(arcPoints(focusedEnergySystem, system));
      });
    }

    const canvas = document.getElementById('c');
    let downX = 0;
    let downY = 0;
    let pointerMoved = false;
    canvas.addEventListener('pointerdown', event => {
      downX = event.clientX;
      downY = event.clientY;
      pointerMoved = false;
    });
    canvas.addEventListener('pointermove', event => {
      if (Math.abs(event.clientX - downX) > 5 || Math.abs(event.clientY - downY) > 5) pointerMoved = true;
    });
    canvas.addEventListener('click', event => {
      if (!energyMode || api.getState().mode !== 'globe') return;
      if (pointerMoved) {
        pointerMoved = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, api.camera);
      const hit = systems.find(system => raycaster.intersectObject(system.dome, false).length);
      if (hit) setSelected(hit);
    });

    return { threeObject: group, threeParent: 'scene', update, systems, setSelected };
  }

  function createHealthLayer() {
    const THREE = api.THREE;
    const group = new THREE.Group();
    group.renderOrder = 10;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const baseGeometry = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
    const greenMaterial = new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.92 });
    const redMaterial = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.88 });
    const selectedRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.0022, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false })
    );
    selectedRing.visible = false;
    const tmpMatrix = new THREE.Matrix4();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    let greenInstances = null;
    let redInstances = null;
    let pickTargets = [];

    function rebuild() {
      while (group.children.length) {
        group.children.pop();
      }
      selectedRing.visible = false;
      pickTargets = [];
      displayedHealthCities = buildDisplayCities();
      healthGeoJSON = makeHealthGeoJSON(displayedHealthCities);
      if (!displayedHealthCities.length) {
        updateMapHealthSource();
        return;
      }
      greenInstances = new THREE.InstancedMesh(baseGeometry, greenMaterial, displayedHealthCities.length);
      redInstances = new THREE.InstancedMesh(baseGeometry, redMaterial, displayedHealthCities.length);
      greenInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      redInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      greenInstances.userData.metas = [];
      redInstances.userData.metas = [];

      displayedHealthCities.forEach((city, index) => {
        const pos = api.latLngToVec(city.lat, city.lng, 1.003);
        const normal = pos.clone().normalize();
        const popNorm = populationNorm(city.pop);
        const totalHeight = 0.01 + popNorm * 0.24;
        const radius = 0.0025 + popNorm * 0.0095;
        const greenShare = healthShare(city.lat, city.lng);
        const greenHeight = Math.max(0.001, totalHeight * greenShare);
        const redHeight = Math.max(0.001, totalHeight - greenHeight);
        const meta = {
          ...city,
          greenShare,
          redShare: 1 - greenShare,
          radius,
          normal,
          basePosition: pos.clone(),
          topPosition: pos.clone().add(normal.clone().multiplyScalar(totalHeight)),
          totalHeight
        };

        tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

        const greenCenter = pos.clone().add(normal.clone().multiplyScalar(greenHeight * 0.5));
        tmpScale.set(radius, greenHeight, radius);
        tmpMatrix.compose(greenCenter, tmpQuat, tmpScale);
        greenInstances.setMatrixAt(index, tmpMatrix);
        greenInstances.userData.metas[index] = meta;

        const redCenter = pos.clone().add(normal.clone().multiplyScalar(greenHeight + redHeight * 0.5));
        tmpScale.set(radius, redHeight, radius);
        tmpMatrix.compose(redCenter, tmpQuat, tmpScale);
        redInstances.setMatrixAt(index, tmpMatrix);
        redInstances.userData.metas[index] = meta;
      });
      greenInstances.instanceMatrix.needsUpdate = true;
      redInstances.instanceMatrix.needsUpdate = true;
      group.add(greenInstances, redInstances, selectedRing);
      pickTargets = [greenInstances, redInstances];
      updateMapHealthSource();
    }

    function update() {
      group.visible = healthMode && api.getState().mode === 'globe' && api.getState().target === 'earth';
      if (greenInstances) greenInstances.visible = group.visible && !healthOnlyNegative;
      if (redInstances) redInstances.visible = group.visible && !healthOnlyPositive;
      if (greenInstances) greenInstances.material.opacity += (((selectedHealthMeta ? 0.76 : 0.92) - greenInstances.material.opacity) * 0.08);
      if (redInstances) redInstances.material.opacity += (((selectedHealthMeta ? 0.72 : 0.88) - redInstances.material.opacity) * 0.08);
      if (selectedRing.visible && selectedHealthMeta) {
        selectedRing.position.copy(selectedHealthMeta.topPosition);
        selectedRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), selectedHealthMeta.normal);
        const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.06;
        selectedRing.scale.setScalar(pulse);
      }
    }

    function pickMeta(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, api.camera);
      const targets = pickTargets.filter(mesh => mesh && mesh.visible);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit || hit.instanceId === undefined) return null;
      return hit.object.userData.metas[hit.instanceId] || null;
    }

    function showSelectionRing(meta) {
      if (!meta) {
        selectedRing.visible = false;
        return;
      }
      if (!meta.topPosition || !meta.normal) {
        const base = api.latLngToVec(meta.lat, meta.lng, 1.003);
        const normal = base.clone().normalize();
        const popNorm = populationNorm(meta.pop || 1);
        meta.normal = normal;
        meta.radius = meta.radius || 0.0025 + popNorm * 0.0095;
        meta.topPosition = base.clone().add(normal.clone().multiplyScalar(0.01 + popNorm * 0.24));
      }
      selectedRing.visible = true;
      selectedRing.position.copy(meta.topPosition);
      selectedRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), meta.normal);
      selectedRing.scale.setScalar(Math.max(0.7, meta.radius * 34));
    }

    const canvas = document.getElementById('c');
    let downX = 0;
    let downY = 0;
    let pointerMoved = false;
    canvas.addEventListener('pointerdown', event => {
      downX = event.clientX;
      downY = event.clientY;
      pointerMoved = false;
    });
    canvas.addEventListener('pointermove', event => {
      if (!healthMode || api.getState().mode !== 'globe') return;
      if (Math.abs(event.clientX - downX) > 5 || Math.abs(event.clientY - downY) > 5) pointerMoved = true;
      const meta = pickMeta(event);
      if (meta) showHoverFlag(meta, event.clientX, event.clientY);
      else hideHoverFlag();
    });
    canvas.addEventListener('click', event => {
      if (!healthMode || api.getState().mode !== 'globe') return;
      if (pointerMoved) {
        pointerMoved = false;
        return;
      }
      const meta = pickMeta(event);
      if (meta) {
        showSelectionRing(meta);
        selectHealthMeta(meta, event.clientX, event.clientY);
      }
    });

    return { threeObject: group, update, rebuild, showSelectionRing };
  }

  function registerHealthMapLayer() {
    api.addMapLayer('health2d', {
      sourceId: 'health2d',
      source: { type: 'geojson', data: healthGeoJSON, generateId: true },
      layers: [
        {
          id: 'health2d-red-base',
          type: 'circle',
          source: 'health2d',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['+', 2, ['*', 9, ['get', 'popNorm']]], 10, ['+', 5, ['*', 24, ['get', 'popNorm']]], 14, ['+', 7, ['*', 38, ['get', 'popNorm']]]],
            'circle-color': '#dc2626',
            'circle-opacity': 0.78,
            'circle-stroke-width': 0.8,
            'circle-stroke-color': 'rgba(255,255,255,0.28)'
          }
        },
        {
          id: 'health2d-green-inner',
          type: 'circle',
          source: 'health2d',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['+', 2, ['*', 9, ['get', 'popNorm']]], ['sqrt', ['max', 0.001, ['get', 'greenShare']]]], 10, ['*', ['+', 5, ['*', 24, ['get', 'popNorm']]], ['sqrt', ['max', 0.001, ['get', 'greenShare']]]], 14, ['*', ['+', 7, ['*', 38, ['get', 'popNorm']]], ['sqrt', ['max', 0.001, ['get', 'greenShare']]]]],
            'circle-color': '#16a34a',
            'circle-opacity': 0.86,
            'circle-stroke-width': 0
          }
        },
        {
          id: 'health2d-center-pin',
          type: 'circle',
          source: 'health2d',
          minzoom: 4.2,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 1.4, 14, 2.4],
            'circle-color': '#f8fafc',
            'circle-opacity': 0.55
          }
        }
      ]
    });
  }

  function ensure2DSelectedLayer() {
    const map = api && api.map && api.map();
    if (!map || !map.getStyle || !map.getStyle()) return;
    try {
      if (!map.getSource('health2d-selected')) {
        map.addSource('health2d-selected', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.getLayer('health2d-selected-halo')) {
        map.addLayer({
          id: 'health2d-selected-halo',
          type: 'circle',
          source: 'health2d-selected',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['+', 5, ['*', 10, ['get', 'popNorm']]], 6, ['+', 7, ['*', 15, ['get', 'popNorm']]], 10, ['+', 10, ['*', 25, ['get', 'popNorm']]], 14, ['+', 14, ['*', 39, ['get', 'popNorm']]]],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 10, 7, 14, 9],
            'circle-opacity': 0.85
          }
        });
      }
      if (!map.getLayer('health2d-selected-ring')) {
        map.addLayer({
          id: 'health2d-selected-ring',
          type: 'circle',
          source: 'health2d-selected',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['+', 5, ['*', 10, ['get', 'popNorm']]], 6, ['+', 7, ['*', 15, ['get', 'popNorm']]], 10, ['+', 10, ['*', 25, ['get', 'popNorm']]], 14, ['+', 14, ['*', 39, ['get', 'popNorm']]]],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 3, 14, 4],
            'circle-opacity': 1
          }
        });
      }
    } catch (_) {}
  }

  function metaFromMapFeature(feature) {
    const p = feature && feature.properties ? feature.properties : {};
    return {
      id: p.id,
      city: p.name,
      lat: Number(p.lat),
      lng: Number(p.lng),
      pop: Number(p.pop) || 0,
      greenShare: Number(p.greenShare) || 0,
      redShare: 1 - (Number(p.greenShare) || 0)
    };
  }

  function set2DSelectedHealthDisk(meta) {
    const map = api && api.map && api.map();
    if (!map) return;
    ensure2DSelectedLayer();
    if (!map.getSource('health2d-selected')) return;
    const data = meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)
      ? {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [meta.lng, meta.lat] },
            properties: { popNorm: populationNorm(meta.pop) }
          }]
        }
      : { type: 'FeatureCollection', features: [] };
    map.getSource('health2d-selected').setData(data);
  }

  function setup2DHealthInteractions() {
    const map = api && api.map && api.map();
    if (!map || mapHealthInteractionsReady || !map.getLayer('health2d-red-base') || !map.getLayer('health2d-green-inner')) return;
    ensure2DSelectedLayer();
    mapHealthInteractionsReady = true;
    ['health2d-red-base', 'health2d-green-inner'].forEach(layerId => {
      map.on('mousemove', layerId, e => {
        if (!healthMode || api.getState().mode !== 'map' || !e.features || !e.features.length) return;
        const meta = metaFromMapFeature(e.features[0]);
        map.getCanvas().style.cursor = 'pointer';
        showHoverFlag(meta, e.originalEvent.clientX, e.originalEvent.clientY);
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        hideHoverFlag();
      });
      map.on('click', layerId, e => {
        if (!healthMode || api.getState().mode !== 'map' || !e.features || !e.features.length) return;
        e.preventDefault();
        const meta = metaFromMapFeature(e.features[0]);
        selectedHealthMeta = meta;
        set2DSelectedHealthDisk(meta);
        selectHealthMeta(meta, e.originalEvent.clientX, e.originalEvent.clientY);
      });
    });
  }

  function updateMapHealthSource() {
    const map = api && api.map && api.map();
    if (map && map.getSource('health2d')) map.getSource('health2d').setData(healthGeoJSON);
    ensure2DSelectedLayer();
    setup2DHealthInteractions();
    if (selectedHealthMeta) set2DSelectedHealthDisk(selectedHealthMeta);
    setMapHealthVisibility();
  }

  function setMapHealthVisibility() {
    if (!api) return;
    const map = api.map();
    if (!map) return;
    const visible = healthMode && api.getState().mode === 'map' ? 'visible' : 'none';
    ensure2DSelectedLayer();
    setup2DHealthInteractions();
    if (selectedHealthMeta) set2DSelectedHealthDisk(selectedHealthMeta);
    ['health2d-red-base', 'health2d-green-inner', 'health2d-center-pin', 'health2d-selected-halo', 'health2d-selected-ring'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible);
    });
  }

  function refreshMapHealthLifecycleSoon() {
    requestAnimationFrame(() => {
      setMapHealthVisibility();
      setTimeout(setMapHealthVisibility, 250);
    });
  }

  function showHoverFlag(meta, x, y) {
    els.hoverFlag.textContent = labelForCity(meta);
    els.hoverFlag.style.left = `${x + 12}px`;
    els.hoverFlag.style.top = `${y + 12}px`;
    els.hoverFlag.style.display = 'block';
  }

  function hideHoverFlag() {
    els.hoverFlag.style.display = 'none';
  }

  function selectHealthMeta(meta, x = window.innerWidth * 0.5, y = window.innerHeight * 0.5) {
    selectedHealthMeta = meta;
    set2DSelectedHealthDisk(meta);
    const green = meta.greenShare || healthShare(meta.lat, meta.lng);
    const red = meta.redShare || 1 - green;
    const city = labelForCity(meta);
    const greenPct = Math.round(green * 100);
    const redPct = Math.max(0, 100 - greenPct);
    els.tooltip.innerHTML = `
      <button class="pillarTooltipClose" id="pillarTooltipCloseBtn" aria-label="Close info card">×</button>
      <div style="display:flex;flex-direction:column;gap:9px;padding-right:18px;">
        <div style="font-size:17px;font-weight:700;color:#ffffff;line-height:1.15;">
          ${city}
        </div>

        <div style="font-size:11px;color:#bcd0f5;">
          ${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)}
        </div>

        ${meta.isCluster ? `<div style="font-size:11px;color:#facc15;">Cluster of ${(meta.clusterCount || 1).toLocaleString()} cities</div>` : ''}

        <div style="height:1px;background:linear-gradient(90deg, rgba(255,255,255,.16), rgba(255,255,255,.04));margin:2px 0;"></div>

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#9fb3d9;">Population</span>
          <span style="font-size:13px;font-weight:650;color:#eef4ff;">${Math.round(meta.pop).toLocaleString()}</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span style="font-size:11px;color:#9fb3d9;">Sentiment</span>
          <span style="font-size:10px;color:#d9e5ff;">Positive / Negative</span>
        </div>

        <div style="height:11px;width:100%;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.055);border-radius:999px;overflow:hidden;box-shadow:inset 0 0 12px rgba(0,0,0,.22);">
          <div id="tooltipGreenBar" style="height:100%;width:0%;background:linear-gradient(90deg,#16a34a,#34d399);float:left;transition:width 320ms ease;"></div>
          <div id="tooltipRedBar" style="height:100%;width:0%;background:linear-gradient(90deg,#dc2626,#fb7185);float:left;transition:width 320ms ease;"></div>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span style="color:#86efac;">Positive ${greenPct}%</span>
          <span style="color:#fca5a5;">Negative ${redPct}%</span>
        </div>
      </div>`;
    els.tooltip.style.display = 'block';
    els.tooltip.style.opacity = '1';
    els.tooltip.style.pointerEvents = 'auto';
    els.tooltip.style.left = Math.min(window.innerWidth - 260, x + 14) + 'px';
    els.tooltip.style.top = Math.min(window.innerHeight - 190, y + 14) + 'px';

    requestAnimationFrame(() => {
      const greenBar = document.getElementById('tooltipGreenBar');
      const redBar = document.getElementById('tooltipRedBar');
      if (greenBar) greenBar.style.width = greenPct + '%';
      if (redBar) redBar.style.width = redPct + '%';
    });

    const closeBtn = document.getElementById('pillarTooltipCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', event => {
        event.stopPropagation();
        clearHealthSelection();
      });
    }
  }

  function clearHealthSelection() {
    selectedHealthMeta = null;
    els.tooltip.style.display = 'none';
    hideHoverFlag();
    set2DSelectedHealthDisk(null);
    if (healthLayer && healthLayer.showSelectionRing) healthLayer.showSelectionRing(null);
  }

  function findFlyMatches(query) {
    const q = normalizeSearch(query);
    if (q.length < 2) return [];
    return healthCities.map(d => {
      const label = labelForCity(d);
      const haystack = normalizeSearch(`${label} ${d.cityAscii}`);
      let score = 999;
      if (haystack === q) score = 0;
      else if (haystack.startsWith(q)) score = 1;
      else if (haystack.includes(q)) score = 2;
      return { d, label, score };
    }).filter(item => item.score < 999).sort((a, b) => a.score - b.score || b.d.pop - a.d.pop).slice(0, 10);
  }

  function renderFlySuggestions() {
    const matches = findFlyMatches(els.flyInput.value);
    els.flySuggestions.innerHTML = '';
    els.flyClearBtn.style.display = els.flyInput.value ? 'block' : 'none';
    if (!matches.length) {
      els.flySuggestions.style.display = 'none';
      return;
    }
    matches.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:9px 11px;cursor:pointer;color:#eef4ff;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:10px';
      row.innerHTML = `<span>${item.label}</span><span style="color:#9fb3d9;font-size:10px">${Math.round(item.d.pop).toLocaleString()}</span>`;
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,.10)');
      row.addEventListener('mouseleave', () => row.style.background = 'transparent');
      row.addEventListener('click', () => flyToDatum(item.d));
      els.flySuggestions.appendChild(row);
    });
    els.flySuggestions.style.display = 'block';
  }

  function flyToDatum(d) {
    if (!d) return;
    els.flyInput.value = labelForCity(d);
    els.flySuggestions.style.display = 'none';
    if (!healthMode) {
      healthMode = true;
      energyMode = false;
      showPanel('health');
      updateButtons();
    }
    api.flyToLocation({ lat: d.lat, lng: d.lng, altitude: 1.39, mapZoom: FLY_TO_CITY_2D_ZOOM, enterMap: true, duration: 7200 });
    setTimeout(() => {
      const meta = { ...d, greenShare: healthShare(d.lat, d.lng), redShare: 1 - healthShare(d.lat, d.lng) };
      if (healthLayer && healthLayer.showSelectionRing) healthLayer.showSelectionRing(meta);
      selectHealthMeta(meta);
    }, 7600);
  }

  function refreshHealth() {
    displayedHealthCities = buildDisplayCities();
    healthGeoJSON = makeHealthGeoJSON(displayedHealthCities);
    if (healthLayer) healthLayer.rebuild();
    updateButtons();
  }

  function getAppState() {
    const selectedCity = selectedHealthMeta ? labelForCity(selectedHealthMeta) : null;
    return {
      energyMode,
      healthMode,
      healthOnlyPositive,
      healthOnlyNegative,
      healthClusterMode,
      heightMinPercent,
      heightMaxPercent,
      healthCityCount: healthCities.length,
      displayedHealthCityCount: displayedHealthCities.length,
      healthGeoJSONFeatureCount: healthGeoJSON.features.length,
      selectedCity,
      selectedIsCluster: !!(selectedHealthMeta && selectedHealthMeta.isCluster),
      selectedClusterCount: selectedHealthMeta ? selectedHealthMeta.clusterCount || 1 : 0,
      selectedEnergyName: selectedEnergySystem ? selectedEnergySystem.name : null,
      focusedEnergyName: focusedEnergySystem ? focusedEnergySystem.name : null,
      elevatedEnergy,
      energyLayerVisible: !!(energyLayer && energyLayer.threeObject && energyLayer.threeObject.visible),
      healthLayerVisible: !!(healthLayer && healthLayer.threeObject && healthLayer.threeObject.visible),
      fullPopulationMaxPop,
      energySystemCount: energyLayer && energyLayer.systems ? energyLayer.systems.length : 0,
      energySystems: energyLayer && energyLayer.systems ? energyLayer.systems.map(system => {
        const world = new api.THREE.Vector3();
        system.node.getWorldPosition(world);
        const projected = world.clone().project(api.camera);
        const rect = api.renderer.domElement.getBoundingClientRect();
        return {
          name: system.name,
          state: system.state,
          focused: system === focusedEnergySystem,
          selected: system === selectedEnergySystem,
          ringOpacity: system.ring.material.opacity,
          domeColor: system.dome.material.color.getHexString(),
          screenX: (projected.x * 0.5 + 0.5) * rect.width + rect.left,
          screenY: (-projected.y * 0.5 + 0.5) * rect.height + rect.top,
          visible: !!(energyLayer.threeObject && energyLayer.threeObject.visible)
        };
      }) : [],
      displayedSample: displayedHealthCities.slice(0, 50).map(d => ({
        id: d.id,
        city: labelForCity(d),
        lat: d.lat,
        lng: d.lng,
        pop: d.pop,
        isCluster: !!d.isCluster,
        clusterCount: d.clusterCount || 1,
        height: 0.01 + populationNorm(d.pop) * 0.24
      }))
    };
  }

  window.EarthHealthEnergyApp = {
    getState: getAppState
  };

  async function boot(event) {
    api = event.detail.api;
    healthCities = await loadCities();
    fullPopulationMaxPop = Math.max(...healthCities.map(d => d.pop), 1);
    displayedHealthCities = buildDisplayCities();
    healthGeoJSON = makeHealthGeoJSON(displayedHealthCities);
    energyLayer = createEnergyLayer();
    healthLayer = createHealthLayer();
    api.registerLayer('energy-app-layer', energyLayer);
    api.registerLayer('health-app-layer', healthLayer);
    healthLayer.rebuild();
    registerHealthMapLayer();

    api.on('viewchange', refreshMapHealthLifecycleSoon);
    api.on('mapload', refreshMapHealthLifecycleSoon);
    els.energyBtn.addEventListener('click', () => {
      energyMode = !energyMode;
      if (energyMode) {
        healthMode = false;
        els.tooltip.style.display = 'none';
        showPanel('energy', selectedEnergySystem || focusedEnergySystem);
        if (els.openFiltersBtn) els.openFiltersBtn.classList.remove('visible');
      } else {
        closePanel();
      }
      updateButtons();
    });
    els.healthBtn.addEventListener('click', () => {
      healthMode = !healthMode;
      if (healthMode) {
        energyMode = false;
        showPanel('health');
        if (els.openFiltersBtn) els.openFiltersBtn.classList.remove('visible');
      } else {
        els.tooltip.style.display = 'none';
        closePanel();
      }
      updateButtons();
    });
    els.closeInspectBtn.addEventListener('click', closePanel);
    els.openFiltersBtn.addEventListener('click', restorePanel);
    els.satisfiedBtn.addEventListener('click', () => { if (selectedEnergySystem) selectedEnergySystem.state = 'satisfied'; showPanel('energy', selectedEnergySystem); });
    els.notSatisfiedBtn.addEventListener('click', () => { if (selectedEnergySystem) selectedEnergySystem.state = 'notSatisfied'; showPanel('energy', selectedEnergySystem); });
    els.focusEnergyBtn.addEventListener('click', () => { if (selectedEnergySystem) focusedEnergySystem = selectedEnergySystem; });
    els.elevateBtn.addEventListener('click', () => { elevatedEnergy = !elevatedEnergy; els.elevateBtn.textContent = elevatedEnergy ? 'Descend' : 'Ascend'; });
    els.healthPositiveBtn.addEventListener('click', () => { healthOnlyPositive = !healthOnlyPositive; if (healthOnlyPositive) healthOnlyNegative = false; updateButtons(); });
    els.healthNegativeBtn.addEventListener('click', () => { healthOnlyNegative = !healthOnlyNegative; if (healthOnlyNegative) healthOnlyPositive = false; updateButtons(); });
    els.healthClusterBtn.addEventListener('click', () => { healthClusterMode = !healthClusterMode; refreshHealth(); });
    function handleHeightRangeInput() {
      let min = Math.max(0, Math.min(100, Number(els.heightRangeMin.value)));
      let max = Math.max(0, Math.min(100, Number(els.heightRangeMax.value)));
      if (min >= max) {
        if (document.activeElement === els.heightRangeMin) min = max - 1;
        else max = min + 1;
      }
      heightMinPercent = min;
      heightMaxPercent = max;
      els.heightRangeMin.value = String(min);
      els.heightRangeMax.value = String(max);
      refreshHealth();
    }
    els.heightRangeMin.addEventListener('input', handleHeightRangeInput);
    els.heightRangeMax.addEventListener('input', handleHeightRangeInput);
    els.flyInput.addEventListener('input', renderFlySuggestions);
    els.flyInput.addEventListener('focus', renderFlySuggestions);
    els.flyClearBtn.addEventListener('click', () => { els.flyInput.value = ''; renderFlySuggestions(); els.flyInput.focus(); });
    document.addEventListener('click', event => {
      if (event.target === els.flyInput || event.target === els.flyClearBtn || els.flySuggestions.contains(event.target)) return;
      els.flySuggestions.style.display = 'none';
    });
    updateButtons();
    console.log(`Modular Health/Energy app mounted on earth-core with ${healthCities.length.toLocaleString()} cities.`);
  }

  if (window.EarthSystem) {
    boot({ detail: { api: window.EarthSystem } });
  } else {
    window.addEventListener('earthsystem:ready', boot, { once: true });
  }
})();
