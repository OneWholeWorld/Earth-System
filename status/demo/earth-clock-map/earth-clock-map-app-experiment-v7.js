(() => {
  const DATA_URL = '../earth-health-energy/assets/data/worldcities.csv';
  const DEFAULT_CITY = 'New York';
  const CENTER = 110;
  const clocks = {};
  const els = {
    citySearch: document.getElementById('citySearch'),
    clearCity: document.getElementById('clearCity'),
    suggestions: document.getElementById('citySuggestions'),
    status: document.getElementById('statusChip'),
    dayNightMeta: document.getElementById('dayNightMeta'),
    dayNightValue: document.getElementById('dayNightValue'),
    seasonMeta: document.getElementById('seasonMeta'),
    seasonValue: document.getElementById('seasonValue'),
    wstcMeta: document.getElementById('wstcMeta'),
    wstcValue: document.getElementById('wstcValue'),
  };

  let cities = [];
  let selectedCity = null;
  let activeSuggestion = -1;
  let lastClock = null;

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"' && inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(value);
        value = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i += 1;
        row.push(value);
        if (row.some(Boolean)) rows.push(row);
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
    const countryIdx = idx('country');
    const isoIdx = idx('iso2');
    const adminIdx = idx('admin_name');
    const latIdx = idx('lat');
    const lngIdx = idx('lng');
    const popIdx = idx('population');
    return rows.map((row, index) => {
      const city = (row[cityIdx] || row[asciiIdx] || '').trim();
      const cityAscii = (row[asciiIdx] || row[cityIdx] || '').trim();
      const adminName = (row[adminIdx] || '').trim();
      const country = (row[countryIdx] || '').trim();
      const iso2 = (row[isoIdx] || '').trim();
      const lat = Number(row[latIdx]);
      const lng = Number(row[lngIdx]);
      const pop = Number(row[popIdx]) || 0;
      const placeLabel = labelForParts(city, cityAscii, adminName, country);
      return {
        id: `city-${index}`,
        city,
        cityAscii,
        adminName,
        country,
        iso2,
        lat,
        lng,
        pop,
        placeLabel,
        searchText: normalizeSearch(`${placeLabel} ${cityAscii} ${country} ${iso2}`),
      };
    }).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.pop > 0)
      .sort((a, b) => b.pop - a.pop);
  }

  function labelForParts(city, cityAscii, adminName, country) {
    const name = city || cityAscii || 'Unknown city';
    const region = adminName ? `${adminName}, ${country}` : country;
    return region ? `${name}, ${region}` : name;
  }

  function labelForCity(city) {
    return city ? city.placeLabel : '';
  }

  function shortPlace(city) {
    const label = city?.city || city?.cityAscii || 'Earth';
    return label.length > 16 ? `${label.slice(0, 14)}...` : label;
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function svg(tag, attrs = {}, text = '') {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }

  function polar(angleDegrees, radius) {
    const radians = (angleDegrees - 90) * Math.PI / 180;
    return {
      x: CENTER + Math.cos(radians) * radius,
      y: CENTER + Math.sin(radians) * radius,
    };
  }

  function arcPath(radius, startDegrees, endDegrees) {
    const start = polar(startDegrees, radius);
    const end = polar(endDegrees, radius);
    const sweep = ((endDegrees - startDegrees) % 360 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
  }

  function prepareCircle(circle, radius) {
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${circumference}`;
    circle.style.transformOrigin = `${CENTER}px ${CENTER}px`;
    circle.style.transform = 'rotate(-90deg)';
  }

  function setCircleArc(circle, radius, degrees) {
    const circumference = 2 * Math.PI * radius;
    const normalized = ((degrees % 360) + 360) % 360;
    circle.style.strokeDashoffset = `${circumference * (1 - normalized / 360)}`;
  }

  function setHand(line, degrees, radius) {
    const point = polar(degrees, radius);
    line.setAttribute('x1', CENTER);
    line.setAttribute('y1', CENTER);
    line.setAttribute('x2', point.x.toFixed(3));
    line.setAttribute('y2', point.y.toFixed(3));
  }

  function drawTicks(group, outer = 100) {
    for (let degree = 0; degree < 360; degree += 15) {
      const major = degree % 90 === 0;
      const a = polar(degree, outer);
      const b = polar(degree, major ? outer - 10 : outer - 5);
      group.appendChild(svg('line', {
        class: major ? 'tick major' : 'tick',
        x1: a.x.toFixed(3),
        y1: a.y.toFixed(3),
        x2: b.x.toFixed(3),
        y2: b.y.toFixed(3),
      }));
    }
  }

  function createConcentricClock(svgId, labels) {
    const root = document.getElementById(svgId);
    root.innerHTML = '';
    const tickGroup = svg('g');
    drawTicks(tickGroup);
    root.appendChild(svg('circle', { cx: CENTER, cy: CENTER, r: 104, fill: 'rgba(3,8,14,.34)', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 1 }));
    root.appendChild(tickGroup);
    const defs = [
      { key: 'outer', radius: 82, color: labels.outer.color, width: 11 },
      { key: 'middle', radius: 57, color: labels.middle.color, width: 9 },
      { key: 'inner', radius: 34, color: labels.inner.color, width: 7 },
    ];
    const parts = { hands: {} };
    defs.forEach(def => {
      root.appendChild(svg('circle', { class: 'ring-bg', cx: CENTER, cy: CENTER, r: def.radius }));
      root.appendChild(svg('circle', { class: 'arc-track', cx: CENTER, cy: CENTER, r: def.radius, 'stroke-width': def.width }));
      const arc = svg('circle', { class: 'arc', cx: CENTER, cy: CENTER, r: def.radius, 'stroke-width': def.width, stroke: def.color, style: `color:${def.color}` });
      prepareCircle(arc, def.radius);
      root.appendChild(arc);
      parts[`${def.key}Arc`] = arc;
      parts[`${def.key}Radius`] = def.radius;
    });
    defs.forEach(def => {
      const hand = svg('line', { class: 'hand', stroke: def.color, 'stroke-width': def.key === 'outer' ? 3 : 2.3 });
      root.appendChild(hand);
      parts.hands[def.key] = hand;
    });
    root.appendChild(svg('circle', { class: 'pin', cx: CENTER, cy: CENTER, r: 5 }));
    root.appendChild(svg('text', { class: 'svg-label', x: CENTER, y: CENTER - 4 }, labels.center));
    root.appendChild(svg('text', { class: 'svg-small', x: CENTER, y: CENTER + 10 }, labels.sub));
    return parts;
  }

  function createSeasonClock() {
    const root = document.getElementById('seasonClock');
    root.innerHTML = '';
    const tickGroup = svg('g');
    drawTicks(tickGroup);
    root.appendChild(svg('circle', { cx: CENTER, cy: CENTER, r: 104, fill: 'rgba(3,8,14,.34)', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 1 }));
    root.appendChild(tickGroup);
    root.appendChild(svg('path', { class: 'arc-track', d: arcPath(80, 0, 359.99), 'stroke-width': 14 }));
    [
      { label: 'spring', start: 0, end: 90, color: 'var(--spring)' },
      { label: 'summer', start: 90, end: 180, color: 'var(--summer)' },
      { label: 'autumn', start: 180, end: 270, color: 'var(--autumn)' },
      { label: 'winter', start: 270, end: 359.99, color: 'var(--winter)' },
    ].forEach(season => {
      root.appendChild(svg('path', {
        class: 'arc',
        d: arcPath(80, season.start, season.end),
        stroke: season.color,
        style: `color:${season.color}`,
        'stroke-width': 14,
      }));
    });
    const progress = svg('circle', { class: 'arc', cx: CENTER, cy: CENTER, r: 56, stroke: '#f9fdff', style: 'color:#f9fdff', 'stroke-width': 7 });
    prepareCircle(progress, 56);
    const hand = svg('line', { class: 'hand', stroke: '#f9fdff', 'stroke-width': 3.4 });
    root.appendChild(progress);
    root.appendChild(hand);
    root.appendChild(svg('circle', { class: 'pin', cx: CENTER, cy: CENTER, r: 5 }));
    const topLabel = svg('text', { class: 'svg-small', x: CENTER, y: 33 }, 'spring');
    const rightLabel = svg('text', { class: 'svg-small', x: 184, y: CENTER + 3 }, 'summer');
    const bottomLabel = svg('text', { class: 'svg-small', x: CENTER, y: 192 }, 'autumn');
    const leftLabel = svg('text', { class: 'svg-small', x: 36, y: CENTER + 3 }, 'winter');
    const centerLabel = svg('text', { class: 'svg-label', x: CENTER, y: CENTER - 4 }, 'SEASON');
    const centerSub = svg('text', { class: 'svg-small', x: CENTER, y: CENTER + 10 }, 'O / S arc');
    root.append(topLabel, rightLabel, bottomLabel, leftLabel, centerLabel, centerSub);
    return { progress, progressRadius: 56, hand, centerSub };
  }

  function createDayNightClock() {
    const root = document.getElementById('dayNightClock');
    root.innerHTML = '';
    const tickGroup = svg('g');
    drawTicks(tickGroup);
    root.appendChild(svg('circle', { cx: CENTER, cy: CENTER, r: 104, fill: 'rgba(3,8,14,.34)', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 1 }));
    root.appendChild(tickGroup);
    root.appendChild(svg('path', { class: 'arc-track', d: arcPath(78, 0, 359.99), 'stroke-width': 24 }));
    const skyGroup = svg('g');
    const skySegments = [];
    for (let i = 0; i < 5; i += 1) {
      const segment = svg('path', {
        class: 'arc',
        d: arcPath(78, 0, 1),
        stroke: 'var(--day)',
        style: 'color:var(--day)',
        'stroke-width': 22,
      });
      skySegments.push(segment);
      skyGroup.appendChild(segment);
    }
    const nowDot = svg('circle', { cx: CENTER, cy: 32, r: 4.5, fill: '#f9fdff', stroke: 'rgba(3,8,14,.85)', 'stroke-width': 2 });
    const hand = svg('line', { class: 'hand', stroke: '#f9fdff', 'stroke-width': 3.4 });
    root.appendChild(skyGroup);
    root.appendChild(hand);
    root.appendChild(nowDot);
    root.appendChild(svg('circle', { class: 'pin', cx: CENTER, cy: CENTER, r: 5 }));
    const topLabel = svg('text', { class: 'svg-small', x: CENTER, y: 33 }, 'T0 sunrise');
    const bottomLabel = svg('text', { class: 'svg-small', x: CENTER, y: 192 }, 'T6 noon');
    const centerLabel = svg('text', { class: 'svg-label', x: CENTER, y: CENTER - 4 }, 'CITY');
    const centerSub = svg('text', { class: 'svg-small', x: CENTER, y: CENTER + 10 }, 'T0 - T12');
    root.appendChild(topLabel);
    root.appendChild(bottomLabel);
    root.appendChild(centerLabel);
    root.appendChild(centerSub);
    return { skySegments, nowDot, hand, topLabel, bottomLabel, centerSub };
  }

  function dayOfYear(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  }

  function solarEventUTC(date, lat, lng, sunrise) {
    const zenith = 90.833;
    const n = dayOfYear(date);
    const lngHour = lng / 15;
    const t = n + ((sunrise ? 6 : 18) - lngHour) / 24;
    const meanAnomaly = (0.9856 * t) - 3.289;
    let trueLongitude = meanAnomaly + (1.916 * Math.sin(degToRad(meanAnomaly))) + (0.020 * Math.sin(2 * degToRad(meanAnomaly))) + 282.634;
    trueLongitude = normalize360(trueLongitude);
    let rightAscension = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(trueLongitude))));
    rightAscension = normalize360(rightAscension);
    const lQuadrant = Math.floor(trueLongitude / 90) * 90;
    const raQuadrant = Math.floor(rightAscension / 90) * 90;
    rightAscension = (rightAscension + lQuadrant - raQuadrant) / 15;
    const sinDec = 0.39782 * Math.sin(degToRad(trueLongitude));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosHour = (Math.cos(degToRad(zenith)) - (sinDec * Math.sin(degToRad(lat)))) / (cosDec * Math.cos(degToRad(lat)));
    if (cosHour > 1 || cosHour < -1) return null;
    const hourAngle = sunrise ? 360 - radToDeg(Math.acos(cosHour)) : radToDeg(Math.acos(cosHour));
    const localMeanTime = (hourAngle / 15) + rightAscension - (0.06571 * t) - 6.622;
    const rawUtcHour = localMeanTime - lngHour;
    const dayOffset = Math.floor(rawUtcHour / 24);
    const utcHour = normalizeHour(rawUtcHour);
    const event = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    event.setUTCDate(event.getUTCDate() + dayOffset);
    event.setUTCMinutes(Math.round(utcHour * 60));
    return event;
  }

  function pAt(date, city) {
    return window.getESTC({
      isoTime: date.toISOString(),
      latitude: city.lat,
      longitude: city.lng,
      altitudeMeters: 0,
      humanPrecision: { G: 6, S: 2, P: 2, E: 3, M: 3, V: 0 },
    }).wstc.machine.P;
  }

  function pPhaseFraction(currentP, startP, endP) {
    const span = normalize360(endP - startP) || 360;
    return clamp01(normalize360(currentP - startP) / span);
  }

  function skyArcsForMode(mode) {
    if (mode === 'day') {
      return [
        { start: 0, end: 34, color: 'var(--dawn)' },
        { start: 34, end: 132, color: 'var(--morning)' },
        { start: 132, end: 228, color: 'var(--noon)' },
        { start: 228, end: 326, color: 'var(--afternoon)' },
        { start: 326, end: 359.99, color: 'var(--dusk)' },
      ];
    }
    return [
      { start: 0, end: 32, color: 'var(--twilight)' },
      { start: 32, end: 132, color: 'var(--deep-night)' },
      { start: 132, end: 228, color: 'var(--moonlight)' },
      { start: 228, end: 328, color: 'var(--deep-night)' },
      { start: 328, end: 359.99, color: 'var(--dawn)' },
    ];
  }

  function skyLabelFor(mode, fraction) {
    if (mode === 'day') {
      if (fraction < 0.10) return 'sunrise glow';
      if (fraction < 0.37) return 'blue morning';
      if (fraction < 0.63) return 'full sun';
      if (fraction < 0.90) return 'blue afternoon';
      return 'dusk glow';
    }
    if (fraction < 0.10) return 'evening twilight';
    if (fraction < 0.37) return 'deep night';
    if (fraction < 0.63) return 'moonlit arc';
    if (fraction < 0.90) return 'pre-dawn night';
    return 'dawn edge';
  }

  function setSkyBand(clock, mode) {
    skyArcsForMode(mode).forEach((arc, index) => {
      const node = clock.skySegments[index];
      node.setAttribute('d', arcPath(78, arc.start, arc.end));
      node.setAttribute('stroke', arc.color);
      node.setAttribute('style', `color:${arc.color}`);
    });
  }

  function dayNightState(now, city, currentP) {
    const todayRise = solarEventUTC(now, city.lat, city.lng, true);
    let todaySet = solarEventUTC(now, city.lat, city.lng, false);
    if (todayRise && todaySet && todaySet <= todayRise) {
      todaySet = new Date(todaySet.getTime() + 86400000);
    }
    if (!todayRise || !todaySet) {
      const syntheticAngle = normalize360(((now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400) * 360);
      return {
        mode: 'polar arc',
        t: syntheticAngle / 30,
        degrees: syntheticAngle,
        meta: 'polar daylight model',
        topLabel: 'T0',
        bottomLabel: 'T6',
        skyLabel: 'polar sky',
      };
    }
    let start;
    let end;
    let mode;
    if (now >= todayRise && now < todaySet) {
      start = todayRise;
      end = todaySet;
      mode = 'day';
    } else if (now < todayRise) {
      const yesterday = new Date(now.getTime() - 86400000);
      start = solarEventUTC(yesterday, city.lat, city.lng, false);
      end = todayRise;
      mode = 'night';
    } else {
      const tomorrow = new Date(now.getTime() + 86400000);
      start = todaySet;
      end = solarEventUTC(tomorrow, city.lat, city.lng, true);
      mode = 'night';
    }
    const fraction = start && end ? pPhaseFraction(currentP, pAt(start, city), pAt(end, city)) : 0;
    return {
      mode,
      t: fraction * 12,
      degrees: fraction * 360,
      meta: `${formatClock(start)} to ${formatClock(end)}`,
      topLabel: mode === 'day' ? 'T0 sunrise / T12 sunset' : 'T0 sunset / T12 sunrise',
      bottomLabel: mode === 'day' ? 'T6 noon' : 'T6 midnight',
      skyLabel: skyLabelFor(mode, fraction),
    };
  }

  function degToRad(v) {
    return v * Math.PI / 180;
  }

  function radToDeg(v) {
    return v * 180 / Math.PI;
  }

  function normalize360(v) {
    return ((v % 360) + 360) % 360;
  }

  function normalizeHour(v) {
    return ((v % 24) + 24) % 24;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function formatClock(date) {
    if (!date) return '--:--';
    return date.toISOString().slice(11, 16);
  }

  function formatDeg(value, places = 2) {
    return `${Number(value).toFixed(places)} deg`;
  }

  function seasonForS(s, latitude) {
    const northern = latitude >= 0;
    const northSeasons = [
      { name: 'spring', start: 0, end: 90 },
      { name: 'summer', start: 90, end: 180 },
      { name: 'autumn', start: 180, end: 270 },
      { name: 'winter', start: 270, end: 360 },
    ];
    const southName = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
    const base = northSeasons.find(item => s >= item.start && s < item.end) || northSeasons[3];
    const seasonName = northern ? base.name : southName[base.name];
    const fraction = (s - base.start) / (base.end - base.start);
    return {
      name: seasonName,
      hemisphere: northern ? 'north' : 'south',
      progress: clamp01(fraction),
    };
  }

  function findMatches(query) {
    const q = normalizeSearch(query);
    if (q.length < 2) return [];
    return cities.map(city => {
      let score = 999;
      if (city.searchText === q) score = 0;
      else if (normalizeSearch(city.city).startsWith(q)) score = 1;
      else if (city.searchText.startsWith(q)) score = 2;
      else if (city.searchText.includes(q)) score = 3;
      return { city, score };
    }).filter(item => item.score < 999)
      .sort((a, b) => a.score - b.score || b.city.pop - a.city.pop)
      .slice(0, 10);
  }

  function renderSuggestions() {
    const matches = findMatches(els.citySearch.value);
    activeSuggestion = -1;
    els.suggestions.innerHTML = '';
    els.citySearch.setAttribute('aria-expanded', matches.length ? 'true' : 'false');
    if (!matches.length) {
      els.suggestions.style.display = 'none';
      return;
    }
    matches.forEach(({ city }) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'suggestion';
      row.setAttribute('role', 'option');
      const text = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = city.city || city.cityAscii;
      const meta = document.createElement('span');
      meta.textContent = [city.adminName, city.country].filter(Boolean).join(', ');
      text.append(strong, meta);
      const pop = document.createElement('em');
      pop.textContent = city.pop ? Math.round(city.pop).toLocaleString() : '';
      row.append(text, pop);
      row.addEventListener('click', () => selectCity(city, true));
      els.suggestions.appendChild(row);
    });
    els.suggestions.style.display = 'block';
  }

  function updateActiveSuggestion(nextIndex) {
    const rows = Array.from(els.suggestions.querySelectorAll('.suggestion'));
    if (!rows.length) return;
    activeSuggestion = (nextIndex + rows.length) % rows.length;
    rows.forEach((row, index) => row.classList.toggle('active', index === activeSuggestion));
  }

  function selectCity(city, updateInput) {
    selectedCity = city;
    if (updateInput) els.citySearch.value = labelForCity(city);
    els.clearCity.style.display = 'block';
    els.suggestions.style.display = 'none';
    els.citySearch.setAttribute('aria-expanded', 'false');
    if (window.EarthSystem?.flyToLocation) {
      window.EarthSystem.flyToLocation({ lat: city.lat, lng: city.lng, altitude: 2.8, duration: 1600 });
    }
    updateClock();
  }

  function clearCity() {
    els.citySearch.value = '';
    els.suggestions.style.display = 'none';
    els.clearCity.style.display = 'none';
    els.citySearch.focus();
  }

  function updateClock() {
    if (!selectedCity || typeof window.getESTC !== 'function') return;
    const now = new Date();
    const clock = window.getESTC({
      isoTime: now.toISOString(),
      latitude: selectedCity.lat,
      longitude: selectedCity.lng,
      altitudeMeters: 0,
      humanPrecision: { G: 6, S: 2, P: 2, E: 3, M: 3, V: 0 },
    });
    lastClock = clock;
    const P = clock.wstc.machine.P;
    const S = clock.wstc.machine.S;
    const G = clock.wstc.machine.G;
    const dayNight = dayNightState(now, selectedCity, P);
    const season = seasonForS(S, selectedCity.lat);

    setSkyBand(clocks.dayNight, dayNight.mode);
    setHand(clocks.dayNight.hand, dayNight.degrees, 78);
    const dotPoint = polar(dayNight.degrees, 78);
    clocks.dayNight.nowDot.setAttribute('cx', dotPoint.x.toFixed(3));
    clocks.dayNight.nowDot.setAttribute('cy', dotPoint.y.toFixed(3));
    clocks.dayNight.topLabel.textContent = dayNight.topLabel;
    clocks.dayNight.bottomLabel.textContent = dayNight.bottomLabel;
    clocks.dayNight.centerSub.textContent = dayNight.skyLabel.toUpperCase();
    els.dayNightMeta.textContent = `${shortPlace(selectedCity)} | ${dayNight.skyLabel} | UTC ${dayNight.meta}`;
    els.dayNightValue.textContent = `T${dayNight.t.toFixed(2)}`;

    setCircleArc(clocks.season.progress, clocks.season.progressRadius, season.progress * 360);
    setHand(clocks.season.hand, S, 78);
    clocks.season.centerSub.textContent = `${season.hemisphere.toUpperCase()} ${season.name.toUpperCase()}`;
    els.seasonMeta.textContent = `${season.hemisphere} ${season.name} | ${clock.estc.human.O}`;
    els.seasonValue.textContent = `S ${formatDeg(S)}`;

    setCircleArc(clocks.wstc.outerArc, clocks.wstc.outerRadius, P);
    setCircleArc(clocks.wstc.middleArc, clocks.wstc.middleRadius, S);
    setCircleArc(clocks.wstc.innerArc, clocks.wstc.innerRadius, G);
    setHand(clocks.wstc.hands.outer, P, 80);
    setHand(clocks.wstc.hands.middle, S, 55);
    setHand(clocks.wstc.hands.inner, G, 33);
    els.wstcMeta.textContent = `${clock.estc.human.Y} | ${clock.estc.human.O} | ${clock.estc.human.P}`;
    els.wstcValue.textContent = `G ${formatDeg(G, 6)}`;
    els.status.textContent = `${labelForCity(selectedCity)} | ${cities.length.toLocaleString()} cities`;
  }

  function bindEvents() {
    els.citySearch.addEventListener('input', renderSuggestions);
    els.citySearch.addEventListener('focus', renderSuggestions);
    els.citySearch.addEventListener('keydown', event => {
      const rows = Array.from(els.suggestions.querySelectorAll('.suggestion'));
      if (event.key === 'ArrowDown' && rows.length) {
        event.preventDefault();
        updateActiveSuggestion(activeSuggestion + 1);
      } else if (event.key === 'ArrowUp' && rows.length) {
        event.preventDefault();
        updateActiveSuggestion(activeSuggestion - 1);
      } else if (event.key === 'Enter' && activeSuggestion >= 0 && rows[activeSuggestion]) {
        event.preventDefault();
        rows[activeSuggestion].click();
      } else if (event.key === 'Escape') {
        els.suggestions.style.display = 'none';
      }
    });
    els.clearCity.addEventListener('click', clearCity);
    document.addEventListener('click', event => {
      if (event.target === els.citySearch || event.target === els.clearCity || els.suggestions.contains(event.target)) return;
      els.suggestions.style.display = 'none';
      els.citySearch.setAttribute('aria-expanded', 'false');
    });
  }

  async function boot() {
    clocks.dayNight = createDayNightClock();
    clocks.season = createSeasonClock();
    clocks.wstc = createConcentricClock('wstcClock', {
      center: 'ESTC',
      sub: 'WSTC P/S/G',
      outer: { color: 'var(--planet)' },
      middle: { color: 'var(--orbit)' },
      inner: { color: 'var(--galaxy)' },
    });
    bindEvents();
    try {
      cities = await loadCities();
      const defaultCity = cities.find(city => city.cityAscii === DEFAULT_CITY && city.iso2 === 'US') || cities[0];
      window.EarthClockMapApp = {
        getState: () => ({
          cityCount: cities.length,
          selectedCity: selectedCity ? labelForCity(selectedCity) : null,
          lastClock,
        }),
      };
      selectCity(defaultCity, true);
      setInterval(updateClock, 1000);
    } catch (error) {
      els.status.textContent = 'City data unavailable';
      console.error(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
