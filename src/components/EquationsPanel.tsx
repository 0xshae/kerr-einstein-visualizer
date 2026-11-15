import React, { useMemo } from 'react';
import katex from 'katex';
import { SCHWARZSCHILD_THRESHOLD } from '../physics/kerr';
import type { DerivedQuantities, SimulationParams } from '../physics/types';
import type { HighlightedSymbol } from './ControlsPanel';

interface MathBlockProps {
  latex: string;
  displayMode?: boolean;
}

const MathBlock: React.FC<MathBlockProps> = ({ latex, displayMode = true }) => {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      }),
    [latex, displayMode]
  );
  return <div className="katex-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
};

interface EquationsPanelProps {
  params: SimulationParams;
  derived: DerivedQuantities;
  highlightedSymbol: HighlightedSymbol;
  onHighlightSymbol: (sym: HighlightedSymbol) => void;
}

const SYMBOL_DEFS: Array<{ id: Exclude<HighlightedSymbol, null>; label: string; summary: string }> = [
  {
    id: 'M',
    label: 'M',
    summary: 'Gravitational mass sets the horizon radius r_g = GM/c² and scales every length in km.',
  },
  {
    id: 'a',
    label: 'a*',
    summary: 'Dimensionless Kerr spin Jc/(GM²) drives frame dragging, the ergosphere, and shadow asymmetry.',
  },
  {
    id: 'rObs',
    label: 'r_obs',
    summary: 'Observer distance in km; holding it fixed while changing M shifts the apparent shadow size.',
  },
  {
    id: 'thetaObs',
    label: 'θ_obs',
    summary: 'Polar viewing angle from the spin axis; edge-on (90°) maximizes Doppler beaming and D-shaping.',
  },
];

export const EquationsPanel: React.FC<EquationsPanelProps> = ({
  params,
  derived,
  highlightedSymbol,
  onHighlightSymbol,
}) => {
  const isSchwarzschild = derived.a < SCHWARZSCHILD_THRESHOLD && derived.isExactVacuum;

  const rg = derived.rgKm.toFixed(2);
  const aStr = derived.a.toFixed(3);
  const rObsStr = derived.observerRM.toFixed(2);
  const thetaRad = (params.inclinationDeg * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);
  const sigmaObs = (derived.observerRM * derived.observerRM + derived.a * derived.a * cosT * cosT).toFixed(2);
  const deltaObs = (
    derived.observerRM * derived.observerRM -
    2 * Math.pow(derived.observerRM, 2 - derived.potentialExponent) +
    derived.a * derived.a +
    derived.chargeLikeQ * derived.chargeLikeQ
  ).toFixed(2);

  const gttObs = -(1 - (2 * Math.pow(derived.observerRM, 2 - derived.potentialExponent)) / Number(sigmaObs));
  const frameDragObs =
    (2 * derived.aDrag * Math.pow(derived.observerRM, 2 - derived.potentialExponent)) /
    (Math.pow(derived.observerRM * derived.observerRM + derived.a * derived.a, 2) -
      derived.a * derived.a * Number(deltaObs) * sinT * sinT);

  const fieldEqLatex = derived.isExactVacuum
    ? String.raw`G_{\mu\nu} = 0 \iff R_{\mu\nu} = 0 \quad (\text{Exact Vacuum Einstein Equations})`
    : String.raw`R_{\mu\nu} \neq 0 \quad (\text{Custom Non-Vacuum Metric: } n=${derived.potentialExponent.toFixed(2)},\;\kappa=${params.customMetric.frameDragFactor.toFixed(2)},\;q=${derived.chargeLikeQ.toFixed(2)})`;

  const kerrMetricLatex = String.raw`ds^2 = -\left(1 - \frac{2Mr}{\Sigma}\right)c^2dt^2 - \frac{4Mar\sin^2\theta}{\Sigma}c\,dt\,d\phi + \frac{\Sigma}{\Delta}dr^2 + \Sigma\,d\theta^2 + \left(r^2 + a^2 + \frac{2Ma^2 r\sin^2\theta}{\Sigma}\right)\sin^2\theta\,d\phi^2`;

  const substitutedMetricLatex = isSchwarzschild
    ? String.raw`ds^2 = -\left(1 - \frac{${derived.rsKm.toFixed(1)}\text{ km}}{r}\right)c^2dt^2 + \left(1 - \frac{${derived.rsKm.toFixed(1)}\text{ km}}{r}\right)^{-1}dr^2 + r^2 d\Omega^2`
    : String.raw`\text{At }(r_{\text{obs}}=${rObsStr}M,\,\theta_{\text{obs}}=${params.inclinationDeg.toFixed(0)}^\circ):\quad \Sigma=${sigmaObs}M^2,\;\Delta=${deltaObs}M^2,\;g_{tt}=${gttObs.toFixed(4)},\;\omega=${frameDragObs.toFixed(5)}\,M^{-1}`;

  const radiiLatex = derived.rPlusM !== null
    ? String.raw`r_+ = ${derived.rPlusM.toFixed(3)}M \;(${(derived.rPlusM * derived.rgKm).toFixed(1)}\text{ km}), \quad r_{\text{ISCO}}^+ = ${derived.rIscoProgradeM.toFixed(3)}M, \quad K(r_{\text{obs}}) = ${derived.kretschmannAtObserverDimless.toExponential(2)}\,M^{-4}`
    : String.raw`\text{No Event Horizon } (\Delta > 0\;\forall\, r>0), \quad r_{\text{ISCO}}^+ = ${derived.rIscoProgradeM.toFixed(3)}M, \quad K(r_{\text{obs}}) = ${derived.kretschmannAtObserverDimless.toExponential(2)}\,M^{-4}`;

  const activeSym = SYMBOL_DEFS.find((s) => s.id === highlightedSymbol);

  return (
    <section className="equations-panel">
      <div className="panel-section-head">
        <div>
          <h2>Live Substituted Equations Workbench</h2>
          <p className="panel-sub">
            Hover or tap any variable chip below to highlight its slider and inspect how the metric responds.
          </p>
        </div>
      </div>

      <div className="symbol-chips">
        {SYMBOL_DEFS.map((sym) => (
          <button
            key={sym.id}
            type="button"
            className={`symbol-chip ${highlightedSymbol === sym.id ? 'is-active' : ''}`}
            onMouseEnter={() => onHighlightSymbol(sym.id)}
            onMouseLeave={() => onHighlightSymbol(null)}
            onClick={() => onHighlightSymbol(highlightedSymbol === sym.id ? null : sym.id)}
          >
            {sym.label}
          </button>
        ))}
        <span className="symbol-readout">
          {activeSym
            ? activeSym.summary
            : `M = ${params.massSolar.toFixed(1)} M☉ (r_g = ${rg} km), a* = ${aStr}`}
        </span>
      </div>

      <div className="eq-grid">
        <div className={`eq-card ${derived.isExactVacuum ? '' : 'is-custom'}`}>
          <span className="eq-tag">1 · Field Equations</span>
          <MathBlock latex={fieldEqLatex} />
        </div>

        <div className="eq-card">
          <span className="eq-tag">2 · Kerr Line Element (Collapses to 1916 Schwarzschild at a* = 0)</span>
          <MathBlock latex={kerrMetricLatex} />
        </div>

        <div className="eq-card">
          <span className="eq-tag">
            3 · Live Substituted Metric ({isSchwarzschild ? '1916 Schwarzschild Form' : 'Observer Evaluation'})
          </span>
          <MathBlock latex={substitutedMetricLatex} />
        </div>

        <div className="eq-card">
          <span className="eq-tag">4 · Live Horizons, ISCO &amp; Kretschmann Curvature</span>
          <MathBlock latex={radiiLatex} />
        </div>
      </div>
    </section>
  );
};
