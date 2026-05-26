import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (_) {
    const bundledRoot = '/Users/ranjit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
    try {
      const bundledRequire = createRequire(bundledRoot);
      bundledRequire.resolve('playwright');
      return bundledRequire('playwright');
    } catch {
      return null;
    }
  }
}

const playwright = loadPlaywright();
if (!playwright) throw new Error('Playwright is required. Run `npm install` in status/demo first.');

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.csv', 'text/csv; charset=utf-8']
]);

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax2x8UAAAAASUVORK5CYII=',
  'base64'
);

function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const decoded = decodeURIComponent(url.pathname);
      const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(root, safePath === '/' ? '/index.html' : safePath);
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES.get(path.extname(filePath)) || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      res.end(body);
    } catch (_) {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(done => server.close(done))
      });
    });
  });
}

function chromeExecutablePath() {
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return existsSync(macChrome) ? macChrome : undefined;
}

async function withAppPage(testBody) {
  const server = await startStaticServer(demoRoot);
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: chromeExecutablePath()
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });

  const pageErrors = [];
  const failedRequests = [];

  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => {
    const url = request.url();
    if (!url.includes('tile.openstreetmap.org')) failedRequests.push(`${request.failure()?.errorText || 'failed'} ${url}`);
  });
  await page.route('https://tile.openstreetmap.org/**', route => {
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
  });

  try {
    await page.goto(`${server.baseUrl}/earth-health-energy/earth_health_energy_modular.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      window.EarthSystem &&
      window.EarthHealthEnergyApp &&
      window.EarthHealthEnergyApp.getState().healthCityCount > 40000,
    null, { timeout: 45000 });
    await page.waitForTimeout(250);
    await testBody({ page, baseUrl: server.baseUrl, pageErrors, failedRequests });
    assert.deepEqual(pageErrors, [], 'page should not throw uncaught errors');
    assert.deepEqual(failedRequests, [], 'page should not have failed non-tile requests');
  } finally {
    await browser.close();
    await server.close();
  }
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function appState(page) {
  return page.evaluate(() => window.EarthHealthEnergyApp.getState());
}

async function showHealth(page) {
  if (!(await page.locator('#showHealthBtn').isVisible())) return;
  const state = await appState(page);
  if (!state.healthMode) {
    await page.click('#showHealthBtn');
    await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().healthMode);
  }
}

async function showEnergy(page) {
  if (!(await page.locator('#showEnergyBtn').isVisible())) return;
  const state = await appState(page);
  if (!state.energyMode) {
    await page.click('#showEnergyBtn');
    await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().energyMode);
  }
}

async function clickEnergyNode(page, name) {
  await page.waitForFunction(targetName => {
    const state = window.EarthHealthEnergyApp.getState();
    const node = state.energySystems.find(system => system.name === targetName);
    return node && node.visible &&
      Number.isFinite(node.screenX) &&
      Number.isFinite(node.screenY) &&
      node.screenX > 0 &&
      node.screenY > 0;
  }, name, { timeout: 5000 });
  const node = await page.evaluate(targetName =>
    window.EarthHealthEnergyApp.getState().energySystems.find(system => system.name === targetName),
  name);
  await page.mouse.click(node.screenX, node.screenY);
  await page.waitForFunction(targetName => window.EarthHealthEnergyApp.getState().selectedEnergyName === targetName, name);
  return node;
}

async function clickVisibleEnergyNode(page, excludeName = null) {
  await page.waitForFunction(nameToExclude => {
    const state = window.EarthHealthEnergyApp.getState();
    return state.energySystems.some(system => system.name !== nameToExclude &&
      system.visible &&
      system.screenZ < 1 &&
      system.screenX > 40 &&
      system.screenX < window.innerWidth - 40 &&
      system.screenY > 40 &&
      system.screenY < window.innerHeight - 40);
  }, excludeName, { timeout: 5000 });
  const node = await page.evaluate(nameToExclude =>
    window.EarthHealthEnergyApp.getState().energySystems.find(system => system.name !== nameToExclude &&
      system.visible &&
      system.screenZ < 1 &&
      system.screenX > 40 &&
      system.screenX < window.innerWidth - 40 &&
      system.screenY > 40 &&
      system.screenY < window.innerHeight - 40),
  excludeName);
  await page.mouse.click(node.screenX, node.screenY);
  await page.waitForFunction(targetName => window.EarthHealthEnergyApp.getState().selectedEnergyName === targetName, node.name);
  return node;
}

test('boots on earth-core and loads the full city dataset', async ({ page }) => {
  const state = await appState(page);
  assert.equal(windowIsObject(await page.evaluate(() => window.EarthSystem)), true);
  assert.equal(state.healthMode, false);
  assert.equal(state.energyMode, false);
  assert.equal(state.healthCityCount, 47805);
  assert.equal(state.displayedHealthCityCount, 47805);
  assert.equal(state.healthGeoJSONFeatureCount, 47805);
  assert.equal(state.energySystemCount, 17);
  assert.ok(state.fullPopulationMaxPop > 30000000);
  assert.equal(await page.locator('#status-chip').innerText(), 'earth-core layered app');
});

test('Energy mode toggles panel state and remains mutually exclusive with Health', async ({ page }) => {
  await page.click('#showEnergyBtn');
  let state = await appState(page);
  assert.equal(state.energyMode, true);
  assert.equal(state.healthMode, false);
  assert.equal(await page.locator('#showEnergyBtn').innerText(), 'Hide Energy');
  assert.equal(await page.locator('#showHealthBtn').isVisible(), false);
  assert.equal(await page.locator('#inspectPanel').evaluate(el => el.classList.contains('visible')), true);
  assert.match(await page.locator('#inspectTitle').innerText(), /Goa|Inspect System/);
  assert.equal(await page.locator('#heightRangeControl').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('#healthClusterBtn').evaluate(el => getComputedStyle(el).display), 'none');

  await page.click('#closeInspectBtn');
  assert.equal(await page.locator('#inspectPanel').evaluate(el => el.classList.contains('visible')), false);
  assert.equal(await page.locator('#openFiltersBtn').evaluate(el => el.classList.contains('visible')), true);
  await page.click('#openFiltersBtn');
  assert.equal(await page.locator('#inspectPanel').evaluate(el => el.classList.contains('visible')), true);

  await page.click('#showEnergyBtn');
  state = await appState(page);
  assert.equal(state.energyMode, false);
  assert.equal(await page.locator('#showHealthBtn').isVisible(), true);
});

test('Energy controls toggle ascend state with oracle timing and stay active during target flights', async ({ page }) => {
  await showEnergy(page);
  await page.waitForTimeout(250);
  let state = await appState(page);
  assert.equal(state.energyMode, true);
  assert.equal(state.focusedEnergyName, 'Goa');
  assert.equal(state.elevatedEnergy, false);
  assert.equal(state.energyLayerVisible, true);
  assert.equal(await page.locator('#elevateBtn').innerText(), 'Ascend');
  const goaBefore = state.energySystems.find(system => system.name === 'Goa');

  await page.click('#elevateBtn');
  await page.waitForTimeout(80);
  state = await appState(page);
  assert.equal(state.elevatedEnergy, true);
  assert.equal(await page.locator('#elevateBtn').innerText(), 'Descend');
  let goaDuringAscend = state.energySystems.find(system => system.name === 'Goa');
  assert.ok(goaDuringAscend.y > goaBefore.y, 'Goa should begin ascending');
  assert.ok(goaDuringAscend.y < 0.9, 'Ascend should use oracle staged timing, not jump directly to elevated layout');

  await page.waitForTimeout(3500);
  state = await appState(page);
  const goaElevated = state.energySystems.find(system => system.name === 'Goa');
  assert.ok(goaElevated.y > 1.05, 'Goa should finish near the elevated focus position');

  await page.click('#target-btn');
  await page.click('.dropdown-item[data-target="moon"]');
  await page.waitForFunction(() => window.EarthSystem.getState().target === 'moon', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  state = await appState(page);
  assert.equal(state.energyMode, true);
  assert.equal(state.energyLayerVisible, true);

  await page.evaluate(() => window.EarthSystem.flyToTarget('earth'));
  await page.waitForFunction(() => window.EarthSystem.getState().target === 'earth', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  state = await appState(page);
  assert.equal(state.energyLayerVisible, true);

  await page.click('#elevateBtn');
  await page.waitForTimeout(80);
  state = await appState(page);
  assert.equal(state.elevatedEnergy, false);
  assert.equal(await page.locator('#elevateBtn').innerText(), 'Ascend');
  const goaDuringDescend = state.energySystems.find(system => system.name === 'Goa');
  assert.ok(goaDuringDescend.y < goaElevated.y, 'Goa should begin descending');
  assert.ok(goaDuringDescend.y > goaBefore.y, 'Descend should use oracle slower staged return, not snap to Earth');
});

test('Energy node click selects a system and Satisfied/Not Satisfied controls update state', async ({ page }) => {
  await showEnergy(page);
  await page.waitForTimeout(500);
  await clickEnergyNode(page, 'Goa');
  let state = await appState(page);
  assert.equal(state.selectedEnergyName, 'Goa');
  assert.equal(await page.locator('#inspectTitle').innerText(), 'Goa');
  assert.match(await page.locator('#inspectSubtitle').innerText(), /default/);

  await page.click('#satisfiedBtn');
  await page.waitForFunction(() => {
    const goa = window.EarthHealthEnergyApp.getState().energySystems.find(system => system.name === 'Goa');
    return goa && goa.state === 'satisfied' && goa.domeColor === '16a34a';
  });
  state = await appState(page);
  let goa = state.energySystems.find(system => system.name === 'Goa');
  assert.equal(goa.state, 'satisfied');
  assert.equal(goa.domeColor, '16a34a');
  assert.match(await page.locator('#inspectSubtitle').innerText(), /satisfied/);

  await page.click('#notSatisfiedBtn');
  await page.waitForFunction(() => {
    const goa = window.EarthHealthEnergyApp.getState().energySystems.find(system => system.name === 'Goa');
    return goa && goa.state === 'notSatisfied' && goa.domeColor === 'dc2626';
  });
  state = await appState(page);
  goa = state.energySystems.find(system => system.name === 'Goa');
  assert.equal(goa.state, 'notSatisfied');
  assert.equal(goa.domeColor, 'dc2626');
  assert.match(await page.locator('#inspectSubtitle').innerText(), /notSatisfied/);
});

test('Energy Focus control changes the focused node and keeps connection arcs active', async ({ page }) => {
  await showEnergy(page);
  await page.waitForTimeout(500);
  const clicked = await clickVisibleEnergyNode(page, 'Goa');
  await page.click('#focusEnergyBtn');
  await page.waitForFunction(name => window.EarthHealthEnergyApp.getState().focusedEnergyName === name, clicked.name);
  const state = await appState(page);
  const focused = state.energySystems.find(system => system.name === clicked.name);
  const goa = state.energySystems.find(system => system.name === 'Goa');
  assert.equal(state.focusedEnergyName, clicked.name);
  assert.equal(focused.focused, true);
  assert.equal(goa.focused, false);
});

test('Dragging the 3D globe in Energy mode does not select a node on release', async ({ page }) => {
  await showEnergy(page);
  const before = await appState(page);
  await page.mouse.move(620, 420);
  await page.mouse.down();
  await page.mouse.move(820, 560, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const state = await appState(page);
  assert.equal(state.selectedEnergyName, before.selectedEnergyName);
});

test('Energy layer hides in 2D map mode and restores in 3D globe mode', async ({ page }) => {
  await showEnergy(page);
  await page.waitForTimeout(300);
  let state = await appState(page);
  assert.equal(state.energyLayerVisible, true);
  await page.evaluate(() => window.EarthSystem.switchToMicro(15.5588, 73.77, { zoom: 6 }));
  await page.waitForFunction(() => window.EarthSystem.getState().mode === 'map');
  await page.waitForFunction(() => !window.EarthHealthEnergyApp.getState().energyLayerVisible);
  state = await appState(page);
  assert.equal(state.energyMode, true);
  assert.equal(state.energyLayerVisible, false);
  await page.evaluate(() => window.EarthSystem.switchToMacro());
  await page.waitForFunction(() => window.EarthSystem.getState().mode === 'globe');
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().energyLayerVisible);
  state = await appState(page);
  assert.equal(state.energyLayerVisible, true);
});

test('Health mode shows filters, hides Energy, and restores from hamburger', async ({ page }) => {
  await showHealth(page);
  const state = await appState(page);
  assert.equal(state.healthMode, true);
  assert.equal(state.energyMode, false);
  assert.equal(await page.locator('#showEnergyBtn').isVisible(), false);
  assert.equal(await page.locator('#showHealthBtn').innerText(), 'Hide Health');
  assert.equal(await page.locator('#inspectTitle').innerText(), 'Health Filters');
  assert.equal(await page.locator('#healthClusterBtn').isVisible(), true);
  assert.equal(await page.locator('#heightRangeMin').isVisible(), true);
  assert.equal(await page.locator('#heightRangeMax').isVisible(), true);

  await page.click('#closeInspectBtn');
  assert.equal(await page.locator('#openFiltersBtn').evaluate(el => el.classList.contains('visible')), true);
  await page.click('#openFiltersBtn');
  assert.equal(await page.locator('#inspectPanel').evaluate(el => el.classList.contains('visible')), true);
});

test('Health toggles off cleanly and restores neutral app chrome', async ({ page }) => {
  await showHealth(page);
  await page.click('#showHealthBtn');
  await page.waitForFunction(() => !window.EarthHealthEnergyApp.getState().healthMode);
  await page.waitForFunction(() => !window.EarthHealthEnergyApp.getState().healthLayerVisible);
  const state = await appState(page);
  assert.equal(state.healthMode, false);
  assert.equal(state.healthLayerVisible, false);
  assert.equal(await page.locator('#showHealthBtn').innerText(), 'Show Health');
  assert.equal(await page.locator('#showEnergyBtn').isVisible(), true);
  assert.equal(await page.locator('#status-chip').innerText(), 'earth-core layered app');
  assert.equal(await page.locator('#pillarTooltip').evaluate(el => getComputedStyle(el).display), 'none');
});

test('Positive and negative health filters are mutually exclusive', async ({ page }) => {
  await showHealth(page);
  await page.click('#healthPositiveBtn');
  let state = await appState(page);
  assert.equal(state.healthOnlyPositive, true);
  assert.equal(state.healthOnlyNegative, false);
  assert.equal(await page.locator('#healthPositiveBtn').evaluate(el => el.classList.contains('active')), true);

  await page.click('#healthNegativeBtn');
  state = await appState(page);
  assert.equal(state.healthOnlyPositive, false);
  assert.equal(state.healthOnlyNegative, true);
  assert.equal(await page.locator('#healthPositiveBtn').evaluate(el => el.classList.contains('active')), false);
  assert.equal(await page.locator('#healthNegativeBtn').evaluate(el => el.classList.contains('active')), true);
});

test('Cluster mode uses named region labels and can return to raw cities', async ({ page }) => {
  await showHealth(page);
  await page.click('#healthClusterBtn');
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().healthClusterMode);
  let state = await appState(page);
  assert.equal(await page.locator('#healthClusterBtn').innerText(), 'Show Raw Cities');
  assert.ok(state.displayedHealthCityCount < state.healthCityCount);
  const names = state.displayedSample.map(item => item.city);
  assert.equal(names.some(name => /Delhi region|Mumbai region/.test(name)), true);
  assert.equal(names.some(name => /^\d+ cities/.test(name)), false);

  await page.click('#healthClusterBtn');
  await page.waitForFunction(() => !window.EarthHealthEnergyApp.getState().healthClusterMode);
  state = await appState(page);
  assert.equal(state.displayedHealthCityCount, state.healthCityCount);
});

test('Percentile range filters without rescaling remaining column heights', async ({ page }) => {
  await showHealth(page);
  const before = await appState(page);
  const sample = before.displayedSample.find(item => item.pop < 200000 && item.pop > 100000) || before.displayedSample.at(-1);
  assert.ok(sample);

  await page.locator('#heightRangeMax').evaluate(el => {
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().heightMaxPercent === 50);
  const after = await appState(page);
  assert.equal(after.heightMinPercent, 0);
  assert.equal(after.heightMaxPercent, 50);
  assert.ok(after.displayedHealthCityCount < before.displayedHealthCityCount);
  assert.match(await page.locator('#heightRangeReadout').innerText(), /0th - 50th/);
  assert.equal(await page.locator('#heightSliderFill').evaluate(el => el.style.width), '50%');

  const recomputedHeight = 0.01 + Math.sqrt(sample.pop / after.fullPopulationMaxPop) * 0.24;
  assert.ok(Math.abs(recomputedHeight - sample.height) < 1e-12);
});

test('Percentile handles clamp when min crosses max and when max crosses min', async ({ page }) => {
  await showHealth(page);
  await page.locator('#heightRangeMax').evaluate(el => {
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().heightMaxPercent === 30);

  await page.locator('#heightRangeMin').evaluate(el => {
    el.focus();
    el.value = '35';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().heightMinPercent === 29);
  let state = await appState(page);
  assert.equal(state.heightMinPercent, 29);
  assert.equal(state.heightMaxPercent, 30);
  assert.equal(await page.locator('#heightRangeMin').inputValue(), '29');
  assert.equal(await page.locator('#heightRangeMax').inputValue(), '30');

  await page.locator('#heightRangeMax').evaluate(el => {
    el.focus();
    el.value = '20';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().heightMaxPercent === 30);
  state = await appState(page);
  assert.equal(state.heightMinPercent, 29);
  assert.equal(state.heightMaxPercent, 30);
});

test('City search suggestions appear and selecting one starts Health map workflow', async ({ page }) => {
  await page.fill('#flyInput', 'Delhi');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#flySuggestions')).display === 'block');
  const firstSuggestion = page.locator('#flySuggestions > div').first();
  const text = await firstSuggestion.innerText();
  assert.match(text, /Delhi/i);
  await firstSuggestion.click();
  await page.waitForFunction(() => window.EarthHealthEnergyApp.getState().healthMode);
  const state = await appState(page);
  assert.equal(state.healthMode, true);
  assert.equal(state.energyMode, false);
  assert.match(await page.locator('#flyInput').inputValue(), /Delhi/i);
});

test('City search clear button and outside click dismiss suggestions', async ({ page }) => {
  await page.fill('#flyInput', 'Mumbai');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#flySuggestions')).display === 'block');
  assert.equal(await page.locator('#flyClearBtn').evaluate(el => getComputedStyle(el).display), 'block');

  await page.mouse.click(20, 900);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#flySuggestions')).display === 'none');
  assert.equal(await page.locator('#flyInput').inputValue(), 'Mumbai');

  await page.click('#flyClearBtn');
  assert.equal(await page.locator('#flyInput').inputValue(), '');
  assert.equal(await page.locator('#flyClearBtn').evaluate(el => getComputedStyle(el).display), 'none');
});

test('2D Health map layers hover, click, and selected ring work', async ({ page }) => {
  await showHealth(page);
  await page.evaluate(() => window.EarthSystem.switchToMicro(28.6139, 77.2090, { zoom: 5 }));
  await page.waitForFunction(() => {
    const map = window.EarthSystem.map();
    return map &&
      map.getLayer('health2d-red-base') &&
      map.getLayer('health2d-green-inner') &&
      map.getLayer('health2d-selected-ring');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1000);

  const hit = await page.evaluate(() => {
    const map = window.EarthSystem.map();
    const pt = map.project([77.2090, 28.6139]);
    const features = map.queryRenderedFeatures(
      [[pt.x - 120, pt.y - 120], [pt.x + 120, pt.y + 120]],
      { layers: ['health2d-green-inner', 'health2d-red-base'] }
    );
    return { count: features.length, point: { x: pt.x, y: pt.y } };
  });
  assert.ok(hit.count > 0);

  await page.mouse.move(hit.point.x, hit.point.y);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#cityHoverFlag')).display === 'block');
  assert.ok((await page.locator('#cityHoverFlag').innerText()).length > 0);

  await page.mouse.click(hit.point.x, hit.point.y);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pillarTooltip')).display === 'block');
  const selection = await page.evaluate(() => {
    const source = window.EarthSystem.map().getSource('health2d-selected');
    return {
      selectedFeatures: source && source._data && source._data.features ? source._data.features.length : 0,
      selectedCity: window.EarthHealthEnergyApp.getState().selectedCity,
      tooltip: document.querySelector('#pillarTooltip').textContent.replace(/\s+/g, ' ').trim()
    };
  });
  assert.equal(selection.selectedFeatures, 1);
  assert.ok(selection.selectedCity);
  assert.match(selection.tooltip, /Population/);
});

test('Closing the 2D info card clears selected ring and selected app state', async ({ page }) => {
  await showHealth(page);
  await page.evaluate(() => window.EarthSystem.switchToMicro(28.6139, 77.2090, { zoom: 5 }));
  await page.waitForFunction(() => {
    const map = window.EarthSystem.map();
    return map && map.getLayer('health2d-red-base') && map.getLayer('health2d-selected-ring');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  const hit = await page.evaluate(() => {
    const map = window.EarthSystem.map();
    const pt = map.project([77.2090, 28.6139]);
    const features = map.queryRenderedFeatures(
      [[pt.x - 120, pt.y - 120], [pt.x + 120, pt.y + 120]],
      { layers: ['health2d-green-inner', 'health2d-red-base'] }
    );
    return { count: features.length, point: { x: pt.x, y: pt.y } };
  });
  assert.ok(hit.count > 0);
  await page.mouse.click(hit.point.x, hit.point.y);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pillarTooltip')).display === 'block');
  await page.click('#pillarTooltipCloseBtn');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pillarTooltip')).display === 'none');
  const cleared = await page.evaluate(() => {
    const source = window.EarthSystem.map().getSource('health2d-selected');
    return {
      selectedFeatures: source && source._data && source._data.features ? source._data.features.length : 0,
      selectedCity: window.EarthHealthEnergyApp.getState().selectedCity
    };
  });
  assert.equal(cleared.selectedFeatures, 0);
  assert.equal(cleared.selectedCity, null);
});

test('2D health layers hide when Health mode is turned off in map view', async ({ page }) => {
  await showHealth(page);
  await page.evaluate(() => window.EarthSystem.switchToMicro(28.6139, 77.2090, { zoom: 5 }));
  await page.waitForFunction(() => {
    const map = window.EarthSystem.map();
    return map && map.getLayer('health2d-red-base') &&
      map.getLayoutProperty('health2d-red-base', 'visibility') === 'visible';
  }, null, { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelector('#showEnergyBtn').style.pointerEvents = 'auto';
    document.querySelector('#showHealthBtn').style.pointerEvents = 'auto';
  });
  await page.click('#showHealthBtn', { force: true });
  await page.waitForFunction(() => !window.EarthHealthEnergyApp.getState().healthMode);
  const visibility = await page.evaluate(() => {
    const map = window.EarthSystem.map();
    return {
      red: map.getLayoutProperty('health2d-red-base', 'visibility'),
      green: map.getLayoutProperty('health2d-green-inner', 'visibility'),
      ring: map.getLayoutProperty('health2d-selected-ring', 'visibility')
    };
  });
  assert.equal(visibility.red, 'none');
  assert.equal(visibility.green, 'none');
  assert.equal(visibility.ring, 'none');
});

test('Health 3D layer hides away from Earth target and returns on Earth', async ({ page }) => {
  await showHealth(page);
  await page.waitForTimeout(250);
  let state = await appState(page);
  assert.equal(state.healthLayerVisible, true);
  await page.evaluate(() => window.EarthSystem.flyToTarget('sun'));
  await page.waitForFunction(() => window.EarthSystem.getState().target === 'sun', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  state = await appState(page);
  assert.equal(state.healthMode, true);
  assert.equal(state.healthLayerVisible, false);

  await page.evaluate(() => window.EarthSystem.flyToTarget('earth'));
  await page.waitForFunction(() => window.EarthSystem.getState().target === 'earth', null, { timeout: 5000 });
  await page.waitForTimeout(2700);
  state = await appState(page);
  assert.equal(state.healthLayerVisible, true);
});

test('Dragging the 3D globe in Health mode does not select a column on release', async ({ page }) => {
  await showHealth(page);
  await page.mouse.move(640, 430);
  await page.mouse.down();
  await page.mouse.move(780, 520, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const state = await appState(page);
  assert.equal(state.selectedCity, null);
  assert.equal(await page.locator('#pillarTooltip').evaluate(el => getComputedStyle(el).display), 'none');
});

function windowIsObject(value) {
  return value && typeof value === 'object';
}

let failures = 0;
for (const { name, fn } of tests) {
  process.stdout.write(`• ${name} ... `);
  try {
    await withAppPage(fn);
    process.stdout.write('ok\n');
  } catch (error) {
    failures += 1;
    process.stdout.write('failed\n');
    console.error(error);
  }
}

if (failures) {
  console.error(`\n${failures} earth-health-energy test${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} earth-health-energy tests passed.`);
