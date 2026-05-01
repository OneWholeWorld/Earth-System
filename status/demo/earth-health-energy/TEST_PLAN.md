# Earth Health Energy Test Plan

This suite verifies that the modular Health/Energy application remains a faithful app layer on top of
`earth-core`. It should catch both app regressions and integration regressions between the app and core.

## Phase 1 PR Gate

- App boots on top of `earth-core` without page errors.
- Full `assets/data/worldcities.csv` dataset loads.
- `window.EarthHealthEnergyApp.getState()` exposes app status for tests and diagnostics.
- Energy mode toggles on and off.
- Health mode toggles on and off.
- Energy and Health modes remain mutually exclusive.
- Right panel opens, closes into hamburger, and restores.
- Health panel shows positive, negative, cluster, and percentile controls.
- Positive and negative filters are mutually exclusive.
- Cluster Cities toggles to Show Raw Cities and back.
- Cluster mode produces named clusters such as Delhi/Mumbai regions, not generic count-only labels.
- Percentile slider lower and upper handles both exist and preserve the requested min/max.
- Reducing top percentile reduces displayed columns without rescaling remaining column heights.
- Search suggestions appear for city queries.
- Selecting a city search suggestion enters health mode and begins a fly-to-map workflow.
- 2D map health layers install and become visible in map mode.
- Hovering 2D circles shows the city hover flag.
- Clicking 2D circles opens the info card.
- 2D selected ring source receives the clicked city.
- Dragging the 3D globe in Health mode does not accidentally select a column on release.

## Later Coverage

- Energy node selection and info panel state controls.
- Energy focus and ascend/descend behavior.
- Health 3D column hover and click selection.
- Tooltip bar animation widths.
- Cluster and filter behavior across multiple map transitions.
- Mobile viewport layout.
- Visual parity screenshots against the oracle for key states.

