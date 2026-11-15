import { describe, expect, it } from 'vitest';
import {
  computeKerrShadowOutline,
  createDefaultParams,
  deriveQuantities,
  ergosphereRadiusM,
  kerrDelta,
  kerrIscoM,
  kerrPhotonOrbitM,
  kretschmannDimless,
  solveHorizons,
} from '../kerr';

describe('Schwarzschild limit (a* = 0)', () => {
  it('reproduces exact 1916 Schwarzschild horizons, photon sphere, ISCO, and shadow', () => {
    const params = createDefaultParams();
    params.spin = 0;
    const derived = deriveQuantities(params);

    expect(derived.regime).toBe('schwarzschild');
    expect(derived.isExactVacuum).toBe(true);
    expect(derived.rPlusM).toBeCloseTo(2.0, 6);
    expect(derived.rMinusM).toBeCloseTo(0.0, 6);
    expect(derived.rErgoEquatorialM).toBeCloseTo(2.0, 6);
    expect(derived.rPhotonProgradeM).toBeCloseTo(3.0, 6);
    expect(derived.rPhotonRetrogradeM).toBeCloseTo(3.0, 6);
    expect(derived.rIscoProgradeM).toBeCloseTo(6.0, 6);
    expect(derived.rIscoRetrogradeM).toBeCloseTo(6.0, 6);
    expect(derived.omegaHorizonPerM).toBeCloseTo(0.0, 6);

    const expectedShadowRadius = 3 * Math.sqrt(3);
    expect(derived.shadowMetrics.alphaMin).toBeCloseTo(-expectedShadowRadius, 5);
    expect(derived.shadowMetrics.alphaMax).toBeCloseTo(expectedShadowRadius, 5);
    expect(derived.shadowMetrics.betaMax).toBeCloseTo(expectedShadowRadius, 5);
    expect(derived.shadowMetrics.centerShift).toBeCloseTo(0, 6);
  });

  it('matches Kretschmann scalar K = 48 M^2 / r^6 identically', () => {
    for (const r of [2.0, 3.0, 6.0, 10.0]) {
      expect(kretschmannDimless(r, Math.PI / 2, 0)).toBeCloseTo(48 / Math.pow(r, 6), 10);
      expect(kretschmannDimless(r, 0.2, 0)).toBeCloseTo(48 / Math.pow(r, 6), 10);
    }
  });
});

describe('Spinning & extremal Kerr (a* -> 1)', () => {
  it('computes horizons, ergosphere, photon orbits, and Bardeen ISCO accurately', () => {
    const a = 0.998;
    const { rPlus, rMinus } = solveHorizons(a);
    expect(rPlus).toBeCloseTo(1 + Math.sqrt(1 - a * a), 6);
    expect(rMinus).toBeCloseTo(1 - Math.sqrt(1 - a * a), 6);

    // Ergosphere touches outer horizon at pole and equals 2M at equator
    expect(ergosphereRadiusM(0, a)).toBeCloseTo(rPlus!, 6);
    expect(ergosphereRadiusM(Math.PI / 2, a)).toBeCloseTo(2.0, 6);

    // Known Bardeen-Press-Teukolsky values at a* = 0.998
    expect(kerrPhotonOrbitM(a, true)).toBeCloseTo(1.074, 2);
    expect(kerrPhotonOrbitM(a, false)).toBeCloseTo(3.998, 2);
    expect(kerrIscoM(a, true)).toBeCloseTo(1.237, 2);
    expect(kerrIscoM(a, false)).toBeCloseTo(8.994, 2);
  });

  it('produces an asymmetric shifted D-shaped shadow for edge-on high spin', () => {
    const shadow = computeKerrShadowOutline(0.998, Math.PI / 2);
    const centerShift = 0.5 * (shadow.alphaMin + shadow.alphaMax);
    // At high prograde spin, shadow shifts toward +alpha (prograde side flattened near +2M)
    expect(centerShift).toBeGreaterThan(1.5);
    expect(shadow.alphaMin).toBeGreaterThan(-3.0);
    expect(shadow.alphaMax).toBeGreaterThan(6.5);
  });

  it('distinguishes Kerr ring singularity (theta=pi/2) from finite polar axis (theta=0)', () => {
    const a = 0.9;
    // On equator, Kretschmann diverges as r -> 0 (ring singularity)
    expect(kretschmannDimless(0.05, Math.PI / 2, a)).toBeGreaterThan(1e9);
    // Along spin axis (theta = 0), K stays finite at r = 0: -48 / a^6
    expect(kretschmannDimless(0, 0, a)).toBeCloseTo(-48 / Math.pow(a, 6), 6);
  });
});

describe('Custom non-vacuum metric sandbox', () => {
  it('flags R_uv != 0 and solves modified horizon roots cleanly', () => {
    const params = createDefaultParams();
    params.metricMode = 'custom';
    params.spin = 0.5;
    params.customMetric = {
      potentialExponent: 1.0,
      frameDragFactor: 1.0,
      chargeLikeQ: 0.4,
    };

    const derived = deriveQuantities(params);
    expect(derived.regime).toBe('custom');
    expect(derived.isExactVacuum).toBe(false);
    // Reissner-Nordstrom/Kerr-Newman-like horizon: 1 + sqrt(1 - 0.25 - 0.16)
    expect(derived.rPlusM).toBeCloseTo(1 + Math.sqrt(0.59), 5);
    expect(kerrDelta(derived.rPlusM!, 0.5, 1.0, 0.4)).toBeCloseTo(0, 6);
  });
});
