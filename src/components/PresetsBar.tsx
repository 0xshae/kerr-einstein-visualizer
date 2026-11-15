import React from 'react';
import { massSolarToRgKm } from '../physics/constants';
import type { SimulationParams } from '../physics/types';

export interface PresetDefinition {
  id: string;
  label: string;
  subtitle: string;
  apply: (current: SimulationParams) => SimulationParams;
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'schwarzschild-1916',
    label: '1916 Schwarzschild',
    subtitle: 'a* = 0 · R_μν = 0',
    apply: (current) => ({
      ...current,
      massSolar: 10,
      spin: 0,
      observerDistanceKm: massSolarToRgKm(10) * 18,
      inclinationDeg: 78,
      lockDiskToIsco: true,
      diskOuterM: 16,
      metricMode: 'kerr',
      customMetric: { potentialExponent: 1.0, frameDragFactor: 1.0, chargeLikeQ: 0.0 },
      effects: {
        dopplerBeaming: true,
        gravitationalRedshift: true,
        curvedSpacetime: true,
        showAccretionDisk: true,
        showPhotonRing: true,
      },
    }),
  },
  {
    id: 'moderate-kerr',
    label: 'Moderate Kerr',
    subtitle: 'a* = 0.70 · Frame Dragging',
    apply: (current) => ({
      ...current,
      massSolar: 10,
      spin: 0.7,
      observerDistanceKm: massSolarToRgKm(10) * 16,
      inclinationDeg: 80,
      lockDiskToIsco: true,
      diskOuterM: 16,
      metricMode: 'kerr',
      customMetric: { potentialExponent: 1.0, frameDragFactor: 1.0, chargeLikeQ: 0.0 },
      effects: { ...current.effects, curvedSpacetime: true, showAccretionDisk: true },
    }),
  },
  {
    id: 'extremal-kerr',
    label: 'Extremal Kerr',
    subtitle: 'a* = 0.998 · D-Shadow',
    apply: (current) => ({
      ...current,
      massSolar: 10,
      spin: 0.998,
      observerDistanceKm: massSolarToRgKm(10) * 15,
      inclinationDeg: 85,
      lockDiskToIsco: true,
      diskOuterM: 15,
      metricMode: 'kerr',
      customMetric: { potentialExponent: 1.0, frameDragFactor: 1.0, chargeLikeQ: 0.0 },
      effects: { ...current.effects, curvedSpacetime: true, showAccretionDisk: true },
    }),
  },
  {
    id: 'custom-metric',
    label: 'Custom Metric',
    subtitle: 'R_μν ≠ 0 Sandbox',
    apply: (current) => ({
      ...current,
      spin: Math.max(current.spin, 0.75),
      metricMode: 'custom',
      customMetric: {
        potentialExponent: 1.15,
        frameDragFactor: 1.35,
        chargeLikeQ: 0.35,
      },
      effects: { ...current.effects, curvedSpacetime: true },
    }),
  },
];

interface PresetsBarProps {
  activePresetId: string | null;
  onSelectPreset: (preset: PresetDefinition) => void;
}

export const PresetsBar: React.FC<PresetsBarProps> = ({ activePresetId, onSelectPreset }) => {
  return (
    <div className="presets-bar" role="group" aria-label="Spacetime presets">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`preset-btn ${activePresetId === preset.id ? 'is-active' : ''}`}
          onClick={() => onSelectPreset(preset)}
        >
          <span className="preset-title">{preset.label}</span>
          <span className="preset-sub">{preset.subtitle}</span>
        </button>
      ))}
    </div>
  );
};
