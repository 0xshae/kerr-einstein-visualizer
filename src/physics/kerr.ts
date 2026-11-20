import {
  DEFAULT_REFERENCE_MASS_SOLAR,
  angularFrequencyScaleRadPerSec,
  kmToDimensionlessR,
  massSolarToRgKm,
  massSolarToRsKm,
} from './constants';
import type { DerivedQuantities, SimulationParams } from './types';

export const SCHWARZSCHILD_THRESHOLD = 1e-4;

export function createDefaultParams(): SimulationParams {
  const defaultMass = DEFAULT_REFERENCE_MASS_SOLAR;
  return {
    massSolar: defaultMass,
    spin: 0.0,
    observerDistanceKm: massSolarToRgKm(defaultMass) * 34,
    inclinationDeg: 78,
    azimuthDeg: 0,
    fovDeg: 45,
    diskInnerM: 6,
    diskOuterM: 16,
    lockDiskToIsco: true,
    metricMode: 'kerr',
    customMetric: {
      potentialExponent: 1.0,
      frameDragFactor: 1.0,
      chargeLikeQ: 0.0,
    },
    effects: {
      dopplerBeaming: true,
      gravitationalRedshift: true,
      curvedSpacetime: true,
      showAccretionDisk: true,
      showPhotonRing: true,
    },
  };
}

/**
 * Evaluate Delta(r) = r^2 - 2 r^(2 - n) + a^2 + q^2 in geometrized units (M = 1).
 * When n = 1 and q = 0, this reduces identically to Kerr's Delta = r^2 - 2r + a^2.
 */
export function kerrDelta(r: number, a: number, n = 1, q = 0): number {
  if (r <= 0) return a * a + q * q;
  return r * r - 2 * Math.pow(r, 2 - n) + a * a + q * q;
}

/**
 * Evaluate Sigma(r, theta) = r^2 + a^2 cos^2(theta) in geometrized units.
 */
export function kerrSigma(r: number, thetaRad: number, a: number): number {
  const c = Math.cos(thetaRad);
  return r * r + a * a * c * c;
}

/**
 * Solve for outer (r_+) and inner (r_-) horizons where Delta(r) = 0.
 * Closed-form for exact Kerr (n = 1); numerical root scan + bisection for custom n != 1.
 */
export function solveHorizons(
  a: number,
  n = 1,
  q = 0
): { rPlus: number | null; rMinus: number | null } {
  const effectiveA = Math.min(Math.abs(a), 0.9999);
  if (Math.abs(n - 1) < 1e-9) {
    const disc = 1 - effectiveA * effectiveA - q * q;
    if (disc < 0) return { rPlus: null, rMinus: null };
    const root = Math.sqrt(disc);
    return {
      rPlus: 1 + root,
      rMinus: Math.max(0, 1 - root),
    };
  }

  // Scan r in [0.005, 8] to find sign changes of Delta(r)
  const samples = 1200;
  const rMin = 0.005;
  const rMax = 8.0;
  const roots: number[] = [];
  let prevR = rMin;
  let prevVal = kerrDelta(prevR, effectiveA, n, q);

  for (let i = 1; i <= samples; i++) {
    const curR = rMin + ((rMax - rMin) * i) / samples;
    const curVal = kerrDelta(curR, effectiveA, n, q);
    if (prevVal === 0 || (prevVal < 0 && curVal > 0) || (prevVal > 0 && curVal < 0)) {
      let lo = prevR;
      let hi = curR;
      let flo = prevVal;
      for (let iter = 0; iter < 40; iter++) {
        const mid = 0.5 * (lo + hi);
        const fmid = kerrDelta(mid, effectiveA, n, q);
        if (flo * fmid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fmid;
        }
      }
      roots.push(0.5 * (lo + hi));
    }
    prevR = curR;
    prevVal = curVal;
  }

  if (roots.length === 0) return { rPlus: null, rMinus: null };
  if (roots.length === 1) return { rPlus: roots[0], rMinus: null };
  return { rPlus: roots[roots.length - 1], rMinus: roots[0] };
}

/**
 * Outer ergosphere boundary r_ergo(theta) where g_tt = 0:
 * Exact Kerr: r_ergo(theta) = 1 + sqrt(1 - a^2 cos^2(theta)).
 * General n: solve r^2 - 2 r^(2 - n) + a^2 cos^2(theta) = 0.
 */
export function ergosphereRadiusM(thetaRad: number, a: number, n = 1): number | null {
  const c = Math.cos(thetaRad);
  const aCos2 = a * a * c * c;
  if (Math.abs(n - 1) < 1e-9) {
    const disc = 1 - aCos2;
    return disc >= 0 ? 1 + Math.sqrt(disc) : null;
  }

  const f = (r: number) => r * r - 2 * Math.pow(r, 2 - n) + aCos2;
  let prevR = 0.01;
  let prevVal = f(prevR);
  let lastRoot: number | null = null;
  for (let i = 1; i <= 800; i++) {
    const curR = 0.01 + (7.99 * i) / 800;
    const curVal = f(curR);
    if (prevVal * curVal <= 0) {
      let lo = prevR;
      let hi = curR;
      let flo = prevVal;
      for (let iter = 0; iter < 36; iter++) {
        const mid = 0.5 * (lo + hi);
        const fmid = f(mid);
        if (flo * fmid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fmid;
        }
      }
      lastRoot = 0.5 * (lo + hi);
    }
    prevR = curR;
    prevVal = curVal;
  }
  return lastRoot;
}

/**
 * Bardeen, Press & Teukolsky (1972) equatorial circular photon orbit radii:
 *   r_ph± = 2 [ 1 + cos( (2/3) arccos(∓a) ) ]
 * Prograde (-) is smaller (down to 1M as a -> 1); retrograde (+) grows up to 4M.
 */
export function kerrPhotonOrbitM(a: number, prograde: boolean): number {
  const clamped = Math.min(Math.max(a, 0), 0.999999);
  const sign = prograde ? -1 : 1;
  return 2 * (1 + Math.cos((2 / 3) * Math.acos(sign * clamped)));
}

/**
 * Bardeen, Press & Teukolsky (1972) exact equatorial ISCO radius in Kerr spacetime:
 *   Z1 = 1 + (1 - a^2)^(1/3) * ((1 + a)^(1/3) + (1 - a)^(1/3))
 *   Z2 = sqrt(3 a^2 + Z1^2)
 *   r_ISCO± = 3 + Z2 ∓ sqrt((3 - Z1)(3 + Z1 + 2 Z2))
 */
export function kerrIscoM(a: number, prograde: boolean): number {
  const clamped = Math.min(Math.max(a, 0), 0.999999);
  const oneMinusA2 = Math.max(0, 1 - clamped * clamped);
  const z1 =
    1 +
    Math.cbrt(oneMinusA2) *
      (Math.cbrt(1 + clamped) + Math.cbrt(Math.max(0, 1 - clamped)));
  const z2 = Math.sqrt(3 * clamped * clamped + z1 * z1);
  const term = Math.sqrt(Math.max(0, (3 - z1) * (3 + z1 + 2 * z2)));
  return prograde ? 3 + z2 - term : 3 + z2 + term;
}

/**
 * Exact Kerr Kretschmann curvature scalar K = R_{abcd} R^{abcd} in units of M^-4
 * (with G = c = M = 1):
 *   K(r, theta) = 48 * (r^2 - a^2 cos^2 theta) * ((r^2 + a^2 cos^2 theta)^2 - 16 r^2 a^2 cos^2 theta)
 *                 / (r^2 + a^2 cos^2 theta)^6
 *
 * Checks:
 * - At a = 0: reduces identically to 48 / r^6 (48 G^2 M^2 / (c^4 r^6)).
 * - At theta = pi/2 (equator): cos(theta) = 0, so K = 48 / r^6 (diverges as r -> 0, ring singularity).
 * - At theta = 0 (spin axis, a > 0): finite at r = 0, K(0, 0) = -48 / a^6 (ray passes through ring!).
 */
export function kretschmannDimless(r: number, thetaRad: number, a: number): number {
  const u = a * Math.cos(thetaRad);
  const r2 = r * r;
  const u2 = u * u;
  const sigma = r2 + u2;
  if (sigma < 1e-24) return Infinity;
  const numerator = 48 * (r2 - u2) * (sigma * sigma - 16 * r2 * u2);
  return numerator / Math.pow(sigma, 6);
}

/**
 * Analytical Kerr black hole shadow critical curve in observer celestial coordinates
 * (alpha, beta) for inclination theta_obs (Bardeen 1973, Chandrasekhar):
 * Parameterized by spherical photon orbit radius r_0 in [r_ph+, r_ph-].
 */
export function computeKerrShadowOutline(
  aRaw: number,
  inclinationRad: number,
  samples = 140
): {
  outline: Array<{ alpha: number; beta: number }>;
  alphaMin: number;
  alphaMax: number;
  betaMax: number;
} {
  // Bardeen's formulas only hold for |a| < 1; custom drag can push a_drag past that.
  const a = Math.min(Math.max(aRaw, 0), 0.999);
  const sinInc = Math.max(1e-4, Math.sin(inclinationRad));
  const cosInc = Math.cos(inclinationRad);

  if (Math.abs(a) < SCHWARZSCHILD_THRESHOLD) {
    const rCrit = 3 * Math.sqrt(3);
    const outline: Array<{ alpha: number; beta: number }> = [];
    for (let i = 0; i <= samples; i++) {
      const psi = (2 * Math.PI * i) / samples;
      outline.push({
        alpha: rCrit * Math.cos(psi),
        beta: rCrit * Math.sin(psi),
      });
    }
    return {
      outline,
      alphaMin: -rCrit,
      alphaMax: rCrit,
      betaMax: rCrit,
    };
  }

  const rPhPro = kerrPhotonOrbitM(a, true);
  const rPhRetro = kerrPhotonOrbitM(a, false);
  const upper: Array<{ alpha: number; beta: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const r0 = rPhPro + (rPhRetro - rPhPro) * t;
    const denom = a * (r0 - 1);
    if (Math.abs(denom) < 1e-9) continue;

    // Critical impact parameters xi = L_z / E, eta = Q / E^2
    const xi = (r0 * r0 * (r0 - 3) + a * a * (r0 + 1)) / -denom;
    const eta =
      (r0 * r0 * r0 * (4 * a * a - r0 * (r0 - 3) * (r0 - 3))) /
      (a * a * (r0 - 1) * (r0 - 1));

    const alpha = -xi / sinInc;
    const betaSq = eta + a * a * cosInc * cosInc - xi * xi * (cosInc / sinInc) * (cosInc / sinInc);
    if (betaSq >= 0) {
      upper.push({ alpha, beta: Math.sqrt(betaSq) });
    }
  }

  if (upper.length === 0) {
    const rCrit = 3 * Math.sqrt(3);
    return {
      outline: [{ alpha: rCrit, beta: 0 }],
      alphaMin: -rCrit,
      alphaMax: rCrit,
      betaMax: rCrit,
    };
  }

  const lower = [...upper]
    .reverse()
    .map((p) => ({ alpha: p.alpha, beta: -p.beta }));
  const outline = [...upper, ...lower];

  let alphaMin = Infinity;
  let alphaMax = -Infinity;
  let betaMax = 0;
  for (const p of outline) {
    if (p.alpha < alphaMin) alphaMin = p.alpha;
    if (p.alpha > alphaMax) alphaMax = p.alpha;
    if (Math.abs(p.beta) > betaMax) betaMax = Math.abs(p.beta);
  }

  return { outline, alphaMin, alphaMax, betaMax };
}

export function deriveQuantities(params: SimulationParams): DerivedQuantities {
  const rgKm = massSolarToRgKm(params.massSolar);
  const rsKm = massSolarToRsKm(params.massSolar);
  const observerRM = kmToDimensionlessR(params.observerDistanceKm, params.massSolar);

  const isCustom = params.metricMode === 'custom';
  const n = isCustom ? params.customMetric.potentialExponent : 1.0;
  const kappa = isCustom ? params.customMetric.frameDragFactor : 1.0;
  const q = isCustom ? params.customMetric.chargeLikeQ : 0.0;

  const a = Math.min(Math.max(params.spin, 0), 0.998);
  const aDrag = a * kappa;

  const isExactVacuum = !isCustom;
  const regime: DerivedQuantities['regime'] = isCustom
    ? 'custom'
    : a < SCHWARZSCHILD_THRESHOLD
      ? 'schwarzschild'
      : 'kerr';

  const { rPlus, rMinus } = solveHorizons(a, n, q);
  const thetaObsRad = (params.inclinationDeg * Math.PI) / 180;
  const rErgoEquatorialM = ergosphereRadiusM(Math.PI / 2, a, n);
  const rErgoAtObserverM = ergosphereRadiusM(thetaObsRad, a, n);

  const rPhotonProgradeM = kerrPhotonOrbitM(aDrag, true);
  const rPhotonRetrogradeM = kerrPhotonOrbitM(aDrag, false);
  const rIscoProgradeM = kerrIscoM(aDrag, true);
  const rIscoRetrogradeM = kerrIscoM(aDrag, false);

  const omegaHorizonPerM =
    rPlus !== null && rPlus > 0 ? aDrag / (rPlus * rPlus + a * a) : 0;
  const omegaHorizonRadPerSec =
    omegaHorizonPerM * angularFrequencyScaleRadPerSec(params.massSolar);

  const kretschmannAtObserverDimless = kretschmannDimless(observerRM, thetaObsRad, a);
  const rgMeters = rgKm * 1000;
  const kretschmannAtObserverSI =
    kretschmannAtObserverDimless / Math.pow(rgMeters, 4);

  const shadow = computeKerrShadowOutline(aDrag, thetaObsRad);

  return {
    regime,
    isExactVacuum,
    rgKm,
    rsKm,
    observerRM,
    a,
    aDrag,
    potentialExponent: n,
    chargeLikeQ: q,
    rPlusM: rPlus,
    rMinusM: rMinus,
    rErgoEquatorialM,
    rErgoAtObserverM,
    rPhotonProgradeM,
    rPhotonRetrogradeM,
    rIscoProgradeM,
    rIscoRetrogradeM,
    omegaHorizonPerM,
    omegaHorizonRadPerSec,
    kretschmannAtObserverDimless,
    kretschmannAtObserverSI,
    shadowOutline: shadow.outline,
    shadowMetrics: {
      alphaMin: shadow.alphaMin,
      alphaMax: shadow.alphaMax,
      betaMax: shadow.betaMax,
      width: shadow.alphaMax - shadow.alphaMin,
      centerShift: 0.5 * (shadow.alphaMin + shadow.alphaMax),
    },
  };
}
