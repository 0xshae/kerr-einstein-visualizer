import React, { useMemo, useState } from 'react';
import {
  SCHWARZSCHILD_THRESHOLD,
  ergosphereRadiusM,
  kretschmannDimless,
} from '../physics/kerr';
import type { DerivedQuantities, SimulationParams } from '../physics/types';

interface SingularityPanelProps {
  params: SimulationParams;
  derived: DerivedQuantities;
}

export const SingularityPanel: React.FC<SingularityPanelProps> = ({ params, derived }) => {
  const [sliceAngleDeg, setSliceAngleDeg] = useState<number>(90);

  const maxPlotR = 8.0;
  const cx = 190;
  const cy = 190;
  const pxPerM = 165 / maxPlotR;

  const isSchwarzschild = derived.a < SCHWARZSCHILD_THRESHOLD;

  const ergoPath = useMemo(() => {
    const pts: string[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const th = (2 * Math.PI * i) / steps;
      const rErgo = ergosphereRadiusM(th, derived.a, derived.potentialExponent);
      if (rErgo === null) continue;
      const x = cx + rErgo * Math.sin(th) * pxPerM;
      const y = cy - rErgo * Math.cos(th) * pxPerM;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.length > 2 ? `${pts.join(' ')} Z` : '';
  }, [derived.a, derived.potentialExponent]);

  const kretschmannSeries = useMemo(() => {
    const thetaRad = (sliceAngleDeg * Math.PI) / 180;
    const minR = 0.08;
    const maxR = 6.0;
    const points: Array<{ r: number; kAbs: number; logK: number; sign: number }> = [];
    const samples = 140;
    for (let i = 0; i <= samples; i++) {
      const r = minR + ((maxR - minR) * i) / samples;
      const k = kretschmannDimless(r, thetaRad, derived.a);
      const kAbs = Math.max(1e-4, Math.abs(k));
      points.push({
        r,
        kAbs,
        logK: Math.log10(kAbs),
        sign: k >= 0 ? 1 : -1,
      });
    }
    return points;
  }, [sliceAngleDeg, derived.a]);

  const chartW = 380;
  const chartH = 220;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const logMin = -2;
  const logMax = 9;

  const mapX = (r: number) => padL + (r / 6.0) * (chartW - padL - padR);
  const mapY = (logK: number) => {
    const clamped = Math.min(logMax, Math.max(logMin, logK));
    const norm = (clamped - logMin) / (logMax - logMin);
    return chartH - padB - norm * (chartH - padT - padB);
  };

  const kPath = useMemo(() => {
    return kretschmannSeries
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(pt.r).toFixed(1)} ${mapY(pt.logK).toFixed(1)}`)
      .join(' ');
  }, [kretschmannSeries]);

  const rPlusPx = (derived.rPlusM ?? 0) * pxPerM;
  const rMinusPx = (derived.rMinusM ?? 0) * pxPerM;
  const ringHalfWidthPx = derived.a * pxPerM;
  const iscoProPx = derived.rIscoProgradeM * pxPerM;
  const iscoRetPx = derived.rIscoRetrogradeM * pxPerM;

  return (
    <section className="singularity-panel">
      <div className="panel-section-head">
        <div>
          <h2>Singularity, Horizons &amp; Curvature</h2>
          <p className="panel-sub">
            {isSchwarzschild
              ? 'At a* = 0, r_s = 2M is a coordinate horizon; genuine infinite curvature sits at the point r = 0.'
              : derived.rPlusM === null
                ? `At a* = ${derived.a.toFixed(3)}, this metric has no horizon: the ring singularity of radius ${derived.a.toFixed(3)} M is naked.`
                : `At a* = ${derived.a.toFixed(3)}, the singularity opens into an equatorial ring of radius a = ${derived.a.toFixed(3)} M inside r₋ and r₊.`}
          </p>
        </div>
      </div>

      <div className="singularity-grid">
        <div className="diagram-card">
          <h3>Meridional Cross-Section (R–Z Plane)</h3>
          <svg viewBox="0 0 380 380" className="meridional-svg" role="img" aria-label="Horizons and singularity cross-section">
            <defs>
              <radialGradient id="ergoFill" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(124, 92, 255, 0.28)" />
                <stop offset="100%" stopColor="rgba(76, 175, 255, 0.14)" />
              </radialGradient>
            </defs>

            {/* Reference coordinate circles */}
            {[2, 4, 6].map((rVal) => (
              <g key={rVal}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={rVal * pxPerM}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.14)"
                  strokeDasharray="3 4"
                />
                <text
                  x={cx + rVal * pxPerM + 3}
                  y={cy - 4}
                  fontSize="9"
                  fill="rgba(148, 163, 184, 0.65)"
                >
                  {rVal}M
                </text>
              </g>
            ))}

            {/* Axes */}
            <line x1={18} y1={cy} x2={362} y2={cy} stroke="rgba(148,163,184,0.2)" />
            <line x1={cx} y1={18} x2={cx} y2={362} stroke="rgba(148,163,184,0.2)" />
            <text x={cx + 5} y={28} fontSize="10" fill="rgba(148,163,184,0.8)">
              Spin axis (θ = 0°)
            </text>
            <text x={294} y={cy - 6} fontSize="10" fill="rgba(148,163,184,0.8)">
              Equator (90°)
            </text>

            {/* Accretion disk equatorial slice (from ISCO to outer) */}
            {params.effects.showAccretionDisk && (
              <>
                <line
                  x1={cx + iscoProPx}
                  y1={cy}
                  x2={Math.min(365, cx + params.diskOuterM * pxPerM)}
                  y2={cy}
                  stroke="#fb923c"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <line
                  x1={Math.max(15, cx - params.diskOuterM * pxPerM)}
                  y1={cy}
                  x2={cx - iscoProPx}
                  y2={cy}
                  stroke="#f97316"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </>
            )}

            {/* Ergosphere */}
            {ergoPath && (
              <path
                d={ergoPath}
                fill="url(#ergoFill)"
                stroke="#60a5fa"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
            )}

            {/* Outer horizon r_+ */}
            {derived.rPlusM !== null && (
              <circle
                cx={cx}
                cy={cy}
                r={rPlusPx}
                fill="rgba(5, 8, 15, 0.92)"
                stroke="#f8fafc"
                strokeWidth="2"
              />
            )}

            {/* Inner Cauchy horizon r_- */}
            {derived.rMinusM !== null && derived.rMinusM > 0.05 && (
              <circle
                cx={cx}
                cy={cy}
                r={rMinusPx}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.4"
                strokeDasharray="2 3"
              />
            )}

            {/* Retrograde ISCO indicator */}
            {iscoRetPx <= 170 && (
              <circle
                cx={cx}
                cy={cy}
                r={iscoRetPx}
                fill="none"
                stroke="rgba(251, 191, 36, 0.28)"
                strokeDasharray="2 4"
              />
            )}

            {/* Singularity: point at a*=0, equatorial ring cross-section at a*>0 */}
            {isSchwarzschild ? (
              <circle cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#fecaca" strokeWidth="1.5" />
            ) : (
              <g>
                <line
                  x1={cx - ringHalfWidthPx}
                  y1={cy}
                  x2={cx + ringHalfWidthPx}
                  y2={cy}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeDasharray="2 2"
                />
                <circle cx={cx - ringHalfWidthPx} cy={cy} r={4} fill="#ef4444" stroke="#fecaca" strokeWidth="1.2" />
                <circle cx={cx + ringHalfWidthPx} cy={cy} r={4} fill="#ef4444" stroke="#fecaca" strokeWidth="1.2" />
              </g>
            )}
          </svg>

          <div className="legend-row">
            <span><i className="dot dot-horizon" /> Outer Horizon r₊</span>
            <span><i className="dot dot-ergo" /> Ergosphere</span>
            <span><i className="dot dot-inner" /> Inner Horizon r₋</span>
            <span><i className="dot dot-sing" /> {isSchwarzschild ? 'Point Singularity' : 'Ring Singularity'}</span>
          </div>
        </div>

        <div className="diagram-card">
          <div className="chart-head">
            <h3>Kretschmann Curvature Scalar log₁₀|K(r, θ)|</h3>
            <div className="angle-pills">
              {[
                { label: 'Equator 90°', deg: 90 },
                { label: 'Mid 45°', deg: 45 },
                { label: 'Axis 0°', deg: 0 },
              ].map((opt) => (
                <button
                  key={opt.deg}
                  type="button"
                  className={sliceAngleDeg === opt.deg ? 'is-active' : ''}
                  onClick={() => setSliceAngleDeg(opt.deg)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="curvature-svg" role="img" aria-label="Kretschmann scalar divergence chart">
            {/* Gridlines */}
            {[-2, 0, 2, 4, 6, 8].map((lv) => (
              <g key={lv}>
                <line
                  x1={padL}
                  y1={mapY(lv)}
                  x2={chartW - padR}
                  y2={mapY(lv)}
                  stroke="rgba(148,163,184,0.14)"
                />
                <text x={8} y={mapY(lv) + 3} fontSize="9.5" fill="rgba(148,163,184,0.75)">
                  10^{lv}
                </text>
              </g>
            ))}

            {[1, 2, 3, 4, 5, 6].map((rv) => (
              <g key={rv}>
                <line
                  x1={mapX(rv)}
                  y1={padT}
                  x2={mapX(rv)}
                  y2={chartH - padB}
                  stroke="rgba(148,163,184,0.12)"
                />
                <text x={mapX(rv) - 6} y={chartH - 12} fontSize="9.5" fill="rgba(148,163,184,0.75)">
                  {rv}M
                </text>
              </g>
            ))}

            {/* Vertical marker at outer event horizon r_+ */}
            {derived.rPlusM !== null && derived.rPlusM <= 6 && (
              <g>
                <line
                  x1={mapX(derived.rPlusM)}
                  y1={padT}
                  x2={mapX(derived.rPlusM)}
                  y2={chartH - padB}
                  stroke="#f8fafc"
                  strokeDasharray="4 3"
                />
                <text
                  x={mapX(derived.rPlusM) + 4}
                  y={padT + 11}
                  fontSize="9.5"
                  fill="#f8fafc"
                >
                  r₊ = {derived.rPlusM.toFixed(2)}M (finite!)
                </text>
              </g>
            )}

            <path d={kPath} fill="none" stroke="#f97316" strokeWidth="2.2" />
          </svg>

          <p className="chart-caption">
            {sliceAngleDeg === 0 && !isSchwarzschild
              ? 'Along the spin axis (θ = 0°), rays miss the equatorial ring singularity so K stays finite even at r = 0!'
              : 'Notice K is completely smooth and finite across the event horizon r₊, diverging to ∞ only as r → 0 on the singularity.'}
          </p>
        </div>
      </div>
    </section>
  );
};
