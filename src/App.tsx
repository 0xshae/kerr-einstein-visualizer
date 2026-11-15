import React, { useMemo, useState } from 'react';
import { ControlsPanel, type HighlightedSymbol } from './components/ControlsPanel';
import { EquationsPanel } from './components/EquationsPanel';
import { PresetsBar, type PresetDefinition } from './components/PresetsBar';
import { SingularityPanel } from './components/SingularityPanel';
import { createDefaultParams, deriveQuantities } from './physics/kerr';
import type { SimulationParams } from './physics/types';
import { BlackHoleCanvas } from './render/BlackHoleCanvas';

type WorkspaceTab = 'all' | 'equations' | 'singularity';

export const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(() => createDefaultParams());
  const [activePresetId, setActivePresetId] = useState<string | null>('schwarzschild-1916');
  const [highlightedSymbol, setHighlightedSymbol] = useState<HighlightedSymbol>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('all');

  const derived = useMemo(() => deriveQuantities(params), [params]);

  const handleParamChange = (next: SimulationParams) => {
    setActivePresetId(null);
    setParams(next);
  };

  const handleSelectPreset = (preset: PresetDefinition) => {
    setActivePresetId(preset.id);
    setParams((prev) => preset.apply(prev));
  };

  const handleCameraChange = (
    patch: Partial<Pick<SimulationParams, 'inclinationDeg' | 'azimuthDeg' | 'observerDistanceKm'>>
  ) => {
    setActivePresetId(null);
    setParams((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <h1>Einstein Spacetime Visualizer</h1>
          <p>Exact Kerr &amp; Schwarzschild Vacuum Solutions · Live Geodesic Ray Tracer</p>
        </div>

        <PresetsBar activePresetId={activePresetId} onSelectPreset={handleSelectPreset} />

        <nav className="view-tabs" aria-label="Educational panels">
          <button
            type="button"
            className={activeTab === 'all' ? 'is-active' : ''}
            onClick={() => setActiveTab('all')}
          >
            All Views
          </button>
          <button
            type="button"
            className={activeTab === 'equations' ? 'is-active' : ''}
            onClick={() => setActiveTab('equations')}
          >
            Equations
          </button>
          <button
            type="button"
            className={activeTab === 'singularity' ? 'is-active' : ''}
            onClick={() => setActiveTab('singularity')}
          >
            Singularity &amp; Curvature
          </button>
        </nav>
      </header>

      <main className="main-workspace">
        <div className="left-column">
          <BlackHoleCanvas
            params={params}
            derived={derived}
            onCameraChange={handleCameraChange}
          />

          {(activeTab === 'all' || activeTab === 'equations') && (
            <EquationsPanel
              params={params}
              derived={derived}
              highlightedSymbol={highlightedSymbol}
              onHighlightSymbol={setHighlightedSymbol}
            />
          )}

          {(activeTab === 'all' || activeTab === 'singularity') && (
            <SingularityPanel params={params} derived={derived} />
          )}
        </div>

        <ControlsPanel
          params={params}
          derived={derived}
          highlightedSymbol={highlightedSymbol}
          onHighlightSymbol={setHighlightedSymbol}
          onChange={handleParamChange}
        />
      </main>
    </div>
  );
};

export default App;
