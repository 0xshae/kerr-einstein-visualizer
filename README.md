# Event Horizon

A real-time Kerr and Schwarzschild black hole visualizer. Light rays are traced
backward through the exact Kerr spacetime on the GPU, so the shadow, the lensed
accretion disk and the photon ring come straight from Einstein's equations.

## Features

- **Visualizer:** full-screen WebGL2 geodesic ray tracer with Doppler beaming,
  gravitational redshift and blackbody disk colors. Drag to orbit, scroll to zoom.
- **Theory:** live, substituted equations plus horizon, ergosphere and
  curvature (Kretschmann scalar) plots.
- **Presets:** 1916 Schwarzschild, moderate Kerr, near-extremal Kerr, and a
  custom (non-vacuum) metric sandbox.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL in a browser with WebGL2 (any recent Chrome, Firefox or Safari).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm test` | Run the physics test suite |
