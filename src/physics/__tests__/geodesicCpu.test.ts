import { describe, expect, it } from 'vitest';
import { traceRayCpu } from '../geodesicCpu';

/**
 * Convert an approximate impact parameter b (in units of M) at observer radius rObs
 * into a ZAMO unit ray vector (nR, nTheta, nPhi) on the equator.
 */
function impactToZamoRay(rObs: number, b: number, a: number): [number, number, number] {
  const sinPhi = Math.max(-0.99, Math.min(0.99, b / Math.sqrt(rObs * rObs + a * a)));
  const nPhi = sinPhi;
  const nR = -Math.sqrt(1 - nPhi * nPhi);
  return [nR, 0, nPhi];
}

describe('CPU Minkowski/Schwarzschild/Kerr geodesic integration', () => {
  it('captures rays inside Schwarzschild b_crit = 3*sqrt(3)M and escapes outside', () => {
    const rObs = 40;
    const bCrit = 3 * Math.sqrt(3); // ~5.19615

    const [inR, inT, inP] = impactToZamoRay(rObs, bCrit - 0.15, 0);
    const captured = traceRayCpu({ a: 0, rObs, thetaObs: Math.PI / 2 }, inR, inT, inP);
    expect(captured.outcome).toBe('captured');

    const [outR, outT, outP] = impactToZamoRay(rObs, bCrit + 0.25, 0);
    const escaped = traceRayCpu({ a: 0, rObs, thetaObs: Math.PI / 2 }, outR, outT, outP);
    expect(escaped.outcome).toBe('escaped');
  });

  it('exhibits Kerr prograde/retrograde frame-dragging asymmetry at high spin', () => {
    const rObs = 40;
    const a = 0.95;

    // At b = +3.5M (prograde side), high-spin Kerr lets photons pass outside the prograde
    // photon orbit (r_ph+ ~ 1.38M, b_crit+ ~ +2.6M), whereas retrograde at b = -3.5M is captured
    // (|b_crit-| ~ 6.7M).
    const [proR, proT, proP] = impactToZamoRay(rObs, 3.6, a);
    const proResult = traceRayCpu({ a, rObs, thetaObs: Math.PI / 2 }, proR, proT, proP);
    expect(proResult.outcome).toBe('escaped');

    const [retR, retT, retP] = impactToZamoRay(rObs, -3.6, a);
    const retResult = traceRayCpu({ a, rObs, thetaObs: Math.PI / 2 }, retR, retT, retP);
    expect(retResult.outcome).toBe('captured');
  });

  it('keeps polar rays near theta = 0 regular without NaNs', () => {
    const res = traceRayCpu({ a: 0.9, rObs: 25, thetaObs: 0.12 }, -0.995, -0.08, 0.05);
    expect(Number.isFinite(res.finalR)).toBe(true);
    expect(Number.isFinite(res.finalTheta)).toBe(true);
    expect(Number.isFinite(res.finalPhi)).toBe(true);
  });
});
