import { kerrDelta, solveHorizons } from './kerr';

export interface RayTraceConfig {
  /** Dimensionless spin a in [0, 0.998]. */
  a: number;
  /** Frame-dragging multiplier kappa (1 for exact Kerr). */
  frameDragFactor?: number;
  /** Radial potential exponent n (1 for exact Kerr). */
  potentialExponent?: number;
  /** Charge-like term q (0 for exact Kerr). */
  chargeLikeQ?: number;
  /** Observer radius r_obs in units of M. */
  rObs: number;
  /** Observer polar inclination theta_obs in radians. */
  thetaObs: number;
  /** Maximum integration steps. */
  maxSteps?: number;
  /** Escape radius threshold in units of M. */
  rEscape?: number;
}

export interface RayTraceResult {
  outcome: 'captured' | 'escaped' | 'max_steps';
  finalR: number;
  finalTheta: number;
  finalPhi: number;
  steps: number;
  diskCrossings: number;
}

/**
 * Compute ZAMO local tetrad initial momenta (E, Lz, pr, ptheta) from screen
 * direction angles (nR, nTheta, nPhi) pointing backward into the scene.
 *
 * Here (nR, nTheta, nPhi) is a unit 3-vector in the ZAMO orthonormal triad:
 *   nR < 0 points radially inward toward the black hole,
 *   nPhi > 0 points in the prograde (+phi) direction.
 */
export function zamoRayToMomenta(
  rObs: number,
  thetaObs: number,
  a: number,
  aDrag: number,
  n: number,
  q: number,
  nR: number,
  nTheta: number,
  nPhi: number
): { E: number; Lz: number; pr: number; pTheta: number } {
  const sinT = Math.max(1e-5, Math.sin(thetaObs));
  const cosT = Math.cos(thetaObs);
  const sin2 = sinT * sinT;
  const r2 = rObs * rObs;
  const a2 = a * a;
  const sigma = r2 + a2 * cosT * cosT;
  const delta = Math.max(1e-6, kerrDelta(rObs, a, n, q));
  const A = (r2 + a2) * (r2 + a2) - a2 * delta * sin2;

  const lapse = Math.sqrt((sigma * delta) / A);
  const omega = (2 * aDrag * Math.pow(rObs, 2 - n)) / A;
  const ePhiNorm = Math.sqrt(A / sigma) * sinT;

  // Backward-traced null wavevector in ZAMO frame: k^(0) = 1, k^(i) = n^(i).
  // Covariant components: k_0 = -1, k_i = n^(i).
  const kZamo0 = -1;
  const kZamoPhi = nPhi;

  // Transform back to Boyer-Lindquist covariant momenta:
  // k_t = alpha * k_(0) - omega * e_phi_norm * k_(phi)
  // k_phi = e_phi_norm * k_(phi)
  // Since k_t = -E and k_phi = L_z:
  const E = lapse - omega * ePhiNorm * kZamoPhi;
  const Lz = ePhiNorm * kZamoPhi;
  const pr = Math.sqrt(sigma / delta) * nR;
  const pTheta = Math.sqrt(sigma) * nTheta;
  void kZamo0;

  return { E, Lz, pr, pTheta };
}

/**
 * Evaluate Mino-time Hamiltonian derivatives (dr, dTheta, dPhi, dPr, dPTheta)
 * for H_tilde = 0.5 * Delta * pr^2 + 0.5 * pTheta^2 - P^2/(2 Delta) + (Lz - aDrag*E*sin^2)^2 / (2 sin^2) = 0.
 */
function derivatives(
  r: number,
  theta: number,
  pr: number,
  pTheta: number,
  E: number,
  Lz: number,
  a: number,
  aDrag: number,
  n: number,
  q: number
): [number, number, number, number, number] {
  const sinT = Math.sin(theta);
  const safeSin = Math.abs(sinT) < 1e-5 ? (sinT >= 0 ? 1e-5 : -1e-5) : sinT;
  const cosT = Math.cos(theta);
  const sin2 = safeSin * safeSin;
  const sin3 = sin2 * safeSin;

  const r2 = r * r;
  const a2 = a * a;
  const delta = kerrDelta(r, a, n, q);
  const safeDelta = Math.abs(delta) < 1e-6 ? (delta >= 0 ? 1e-6 : -1e-6) : delta;
  const dDeltaDr = 2 * r - 2 * (2 - n) * Math.pow(Math.max(r, 1e-4), 1 - n);

  const P = (r2 + a2) * E - aDrag * Lz;
  const dPDr = 2 * r * E;

  const dr = safeDelta * pr;
  const dTheta = pTheta;
  const dPhi = (aDrag * P) / safeDelta + (Lz - aDrag * E * sin2) / sin2;

  // -dH/dr
  const dPr =
    -0.5 * dDeltaDr * pr * pr +
    (P * dPDr * safeDelta - 0.5 * P * P * dDeltaDr) / (safeDelta * safeDelta);

  // -dH/dTheta = Lz^2 * cos(theta) / sin^3(theta) - aDrag^2 * E^2 * sin(theta) * cos(theta)
  const dPTheta = (Lz * Lz * cosT) / sin3 - aDrag * aDrag * E * E * safeSin * cosT;

  return [dr, dTheta, dPhi, dPr, dPTheta];
}

/**
 * Trace a backward photon geodesic from (rObs, thetaObs) given ZAMO direction (nR, nTheta, nPhi).
 */
export function traceRayCpu(
  config: RayTraceConfig,
  nR: number,
  nTheta: number,
  nPhi: number
): RayTraceResult {
  const a = Math.min(Math.max(config.a, 0), 0.998);
  const kappa = config.frameDragFactor ?? 1.0;
  const aDrag = a * kappa;
  const n = config.potentialExponent ?? 1.0;
  const q = config.chargeLikeQ ?? 0.0;
  const maxSteps = config.maxSteps ?? 1200;
  const rEscape = config.rEscape ?? Math.max(config.rObs * 2.5, 60);

  const { rPlus } = solveHorizons(a, n, q);
  const rCapture = rPlus !== null ? rPlus * 1.02 : 0.12;

  const { E, Lz, pr: initPr, pTheta: initPTheta } = zamoRayToMomenta(
    config.rObs,
    config.thetaObs,
    a,
    aDrag,
    n,
    q,
    nR,
    nTheta,
    nPhi
  );

  let r = config.rObs;
  let theta = config.thetaObs;
  let phi = 0;
  let pr = initPr;
  let pTheta = initPTheta;
  let diskCrossings = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (r <= rCapture) {
      return { outcome: 'captured', finalR: r, finalTheta: theta, finalPhi: phi, steps: step, diskCrossings };
    }
    if (r >= rEscape && pr > 0) {
      return { outcome: 'escaped', finalR: r, finalTheta: theta, finalPhi: phi, steps: step, diskCrossings };
    }

    const prevThetaSide = theta - Math.PI / 2;
    const h = 0.012 * Math.max(0.15, Math.min(3.5, (r - (rPlus ?? 0.1)) * 0.28));

    const k1 = derivatives(r, theta, pr, pTheta, E, Lz, a, aDrag, n, q);
    const k2 = derivatives(
      r + 0.5 * h * k1[0],
      theta + 0.5 * h * k1[1],
      pr + 0.5 * h * k1[3],
      pTheta + 0.5 * h * k1[4],
      E,
      Lz,
      a,
      aDrag,
      n,
      q
    );
    const k3 = derivatives(
      r + 0.5 * h * k2[0],
      theta + 0.5 * h * k2[1],
      pr + 0.5 * h * k2[3],
      pTheta + 0.5 * h * k2[4],
      E,
      Lz,
      a,
      aDrag,
      n,
      q
    );
    const k4 = derivatives(
      r + h * k3[0],
      theta + h * k3[1],
      pr + h * k3[3],
      pTheta + h * k3[4],
      E,
      Lz,
      a,
      aDrag,
      n,
      q
    );

    r += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    theta += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    phi += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    pr += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    pTheta += (h / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]);

    if (theta < 0) {
      theta = -theta;
      pTheta = -pTheta;
      phi += Math.PI;
    } else if (theta > Math.PI) {
      theta = 2 * Math.PI - theta;
      pTheta = -pTheta;
      phi += Math.PI;
    }

    const curThetaSide = theta - Math.PI / 2;
    if ((prevThetaSide < 0 && curThetaSide >= 0) || (prevThetaSide > 0 && curThetaSide <= 0)) {
      diskCrossings++;
    }
  }

  return { outcome: 'max_steps', finalR: r, finalTheta: theta, finalPhi: phi, steps: maxSteps, diskCrossings };
}
