import React from 'react';
import { massSolarToRgKm } from '../physics/constants';
import type { DerivedQuantities, SimulationParams } from '../physics/types';

export type HighlightedSymbol = 'M' | 'a' | 'rObs' | 'thetaObs' | 'n' | 'kappa' | 'q' | null;

interface ControlsPanelProps {
  params: SimulationParams;
  derived: DerivedQuantities;
  highlightedSymbol: HighlightedSymbol;
  onHighlightSymbol: (sym: HighlightedSymbol) => void;
  onChange: (next: SimulationParams) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  params,
  derived,
  highlightedSymbol,
  onHighlightSymbol,
  onChange,
}) => {
  const minObserverKm = Math.max(derived.rgKm * ((derived.rPlusM ?? 1.2) + 2.2), 15);
  const maxObserverKm = Math.max(derived.rgKm * 65, 1600);

  const updateEffects = (key: keyof SimulationParams['effects'], val: boolean) => {
    onChange({
      ...params,
      effects: { ...params.effects, [key]: val },
    });
  };

  const updateCustom = (key: keyof SimulationParams['customMetric'], val: number) => {
    onChange({
      ...params,
      metricMode: 'custom',
      customMetric: { ...params.customMetric, [key]: val },
    });
  };

  return (
    <aside className="controls-panel">
      <div className="panel-header">
        <h2>Controls</h2>
        <div className="mode-switch" role="tablist" aria-label="Metric Mode">
          <button
            type="button"
            className={params.metricMode === 'kerr' ? 'is-active' : ''}
            onClick={() => onChange({ ...params, metricMode: 'kerr' })}
          >
            Exact
          </button>
          <button
            type="button"
            className={params.metricMode === 'custom' ? 'is-active is-custom' : ''}
            onClick={() => onChange({ ...params, metricMode: 'custom' })}
          >
            Custom
          </button>
        </div>
      </div>

      {params.metricMode === 'custom' && (
        <div className="custom-warning">
          Custom metrics aren&apos;t exact solutions of Einstein&apos;s equations. See Theory for details.
        </div>
      )}

      <div className="control-group">
        <label
          className={`control-row ${highlightedSymbol === 'M' ? 'is-highlighted' : ''}`}
          onMouseEnter={() => onHighlightSymbol('M')}
          onMouseLeave={() => onHighlightSymbol(null)}
        >
          <div className="control-label">
            <span>Mass</span>
            <strong>{params.massSolar.toFixed(1)} M☉</strong>
          </div>
          <input
            type="range"
            min={2}
            max={40}
            step={0.5}
            value={params.massSolar}
            onChange={(e) => {
              const nextMass = Number(e.target.value);
              const minKmForMass = massSolarToRgKm(nextMass) * ((derived.rPlusM ?? 1.2) + 2.2);
              onChange({
                ...params,
                massSolar: nextMass,
                observerDistanceKm: Math.max(params.observerDistanceKm, minKmForMass),
              });
            }}
          />
        </label>

        <label
          className={`control-row ${highlightedSymbol === 'a' ? 'is-highlighted' : ''}`}
          onMouseEnter={() => onHighlightSymbol('a')}
          onMouseLeave={() => onHighlightSymbol(null)}
        >
          <div className="control-label">
            <span>Spin</span>
            <strong>
              {params.spin.toFixed(3)}
            </strong>
          </div>
          <input
            type="range"
            min={0}
            max={0.998}
            step={0.002}
            value={params.spin}
            onChange={(e) => onChange({ ...params, spin: Number(e.target.value) })}
          />
        </label>

        <label
          className={`control-row ${highlightedSymbol === 'rObs' ? 'is-highlighted' : ''}`}
          onMouseEnter={() => onHighlightSymbol('rObs')}
          onMouseLeave={() => onHighlightSymbol(null)}
        >
          <div className="control-label">
            <span>Distance</span>
            <strong>
              {params.observerDistanceKm.toFixed(0)} km
            </strong>
          </div>
          <input
            type="range"
            min={minObserverKm}
            max={maxObserverKm}
            step={2}
            value={Math.min(maxObserverKm, Math.max(minObserverKm, params.observerDistanceKm))}
            onChange={(e) => onChange({ ...params, observerDistanceKm: Number(e.target.value) })}
          />
          <button
            type="button"
            className="mini-action"
            onClick={() =>
              onChange({ ...params, observerDistanceKm: massSolarToRgKm(params.massSolar) * 34 })
            }
          >
            Reset distance
          </button>
        </label>

        <label
          className={`control-row ${highlightedSymbol === 'thetaObs' ? 'is-highlighted' : ''}`}
          onMouseEnter={() => onHighlightSymbol('thetaObs')}
          onMouseLeave={() => onHighlightSymbol(null)}
        >
          <div className="control-label">
            <span>Viewing angle</span>
            <strong>{params.inclinationDeg.toFixed(0)}°</strong>
          </div>
          <input
            type="range"
            min={6}
            max={174}
            step={1}
            value={params.inclinationDeg}
            onChange={(e) => onChange({ ...params, inclinationDeg: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="control-group">
        <h3>Disk</h3>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.effects.showAccretionDisk}
            onChange={(e) => updateEffects('showAccretionDisk', e.target.checked)}
          />
          <span>Show disk</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.lockDiskToIsco}
            onChange={(e) => onChange({ ...params, lockDiskToIsco: e.target.checked })}
          />
          <span>Inner edge at ISCO</span>
        </label>
        {!params.lockDiskToIsco && (
          <label className="control-row">
            <div className="control-label">
              <span>Inner radius</span>
              <strong>{params.diskInnerM.toFixed(2)} M</strong>
            </div>
            <input
              type="range"
              min={1.2}
              max={10}
              step={0.1}
              value={params.diskInnerM}
              onChange={(e) => onChange({ ...params, diskInnerM: Number(e.target.value) })}
            />
          </label>
        )}
        <label className="control-row">
          <div className="control-label">
            <span>Outer radius</span>
            <strong>{params.diskOuterM.toFixed(1)} M</strong>
          </div>
          <input
            type="range"
            min={8}
            max={28}
            step={0.5}
            value={params.diskOuterM}
            onChange={(e) => onChange({ ...params, diskOuterM: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="control-group">
        <h3>Effects</h3>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.effects.curvedSpacetime}
            onChange={(e) => updateEffects('curvedSpacetime', e.target.checked)}
          />
          <span>Light bending</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.effects.dopplerBeaming}
            onChange={(e) => updateEffects('dopplerBeaming', e.target.checked)}
          />
          <span>Doppler beaming</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.effects.gravitationalRedshift}
            onChange={(e) => updateEffects('gravitationalRedshift', e.target.checked)}
          />
          <span>Redshift colors</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.effects.showPhotonRing}
            onChange={(e) => updateEffects('showPhotonRing', e.target.checked)}
          />
          <span>Photon ring glow</span>
        </label>
      </div>

      {params.metricMode === 'custom' && (
        <div className="control-group custom-sandbox-box">
          <h3>Custom metric</h3>
          <label
            className={`control-row ${highlightedSymbol === 'n' ? 'is-highlighted' : ''}`}
            onMouseEnter={() => onHighlightSymbol('n')}
            onMouseLeave={() => onHighlightSymbol(null)}
          >
            <div className="control-label">
              <span>Gravity falloff n</span>
              <strong>{params.customMetric.potentialExponent.toFixed(2)}</strong>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={params.customMetric.potentialExponent}
              onChange={(e) => updateCustom('potentialExponent', Number(e.target.value))}
            />
          </label>
          <label
            className={`control-row ${highlightedSymbol === 'kappa' ? 'is-highlighted' : ''}`}
            onMouseEnter={() => onHighlightSymbol('kappa')}
            onMouseLeave={() => onHighlightSymbol(null)}
          >
            <div className="control-label">
              <span>Frame drag κ</span>
              <strong>{params.customMetric.frameDragFactor.toFixed(2)}×</strong>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.05}
              value={params.customMetric.frameDragFactor}
              onChange={(e) => updateCustom('frameDragFactor', Number(e.target.value))}
            />
          </label>
          <label
            className={`control-row ${highlightedSymbol === 'q' ? 'is-highlighted' : ''}`}
            onMouseEnter={() => onHighlightSymbol('q')}
            onMouseLeave={() => onHighlightSymbol(null)}
          >
            <div className="control-label">
              <span>Charge q</span>
              <strong>{params.customMetric.chargeLikeQ.toFixed(2)}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={params.customMetric.chargeLikeQ}
              onChange={(e) => updateCustom('chargeLikeQ', Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </aside>
  );
};
