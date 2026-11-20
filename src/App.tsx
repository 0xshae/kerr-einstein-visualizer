import React, { useMemo, useState } from 'react';
import { ControlsPanel, type HighlightedSymbol } from './components/ControlsPanel';
import { EquationsPanel } from './components/EquationsPanel';
import { PresetsBar, type PresetDefinition } from './components/PresetsBar';
import { SingularityPanel } from './components/SingularityPanel';
import { createDefaultParams, deriveQuantities } from './physics/kerr';
import type { SimulationParams } from './physics/types';
import { BlackHoleCanvas } from './render/BlackHoleCanvas';

type WorkspaceTab = 'visualizer' | 'theory';

export const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(() => createDefaultParams());
  const [activePresetId, setActivePresetId] = useState<string | null>('schwarzschild-1916');
  const [highlightedSymbol, setHighlightedSymbol] = useState<HighlightedSymbol>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('visualizer');
  const [controlsOpen, setControlsOpen] = useState(true);

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

  const isVisualizer = activeTab === 'visualizer';

  return (
    <div className={`app-shell ${isVisualizer ? 'is-immersive' : 'is-theory'}`}>
      {isVisualizer && (
        <BlackHoleCanvas params={params} derived={derived} onCameraChange={handleCameraChange} />
      )}

      <header className="top-bar glass">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Event Horizon</h1>
            <p>Kerr &amp; Schwarzschild geodesic ray tracer</p>
          </div>
        </div>

        {isVisualizer && (
          <PresetsBar activePresetId={activePresetId} onSelectPreset={handleSelectPreset} />
        )}

        <nav className="view-tabs" aria-label="Workspace">
          <button
            type="button"
            className={isVisualizer ? 'is-active' : ''}
            onClick={() => setActiveTab('visualizer')}
          >
            Visualizer
          </button>
          <button
            type="button"
            className={!isVisualizer ? 'is-active' : ''}
            onClick={() => setActiveTab('theory')}
          >
            Theory
          </button>
        </nav>
      </header>

      {isVisualizer ? (
        <>
          <button
            type="button"
            className="drawer-toggle glass"
            onClick={() => setControlsOpen((open) => !open)}
            aria-expanded={controlsOpen}
          >
            {controlsOpen ? 'Hide controls' : 'Controls'}
          </button>
          <div className={`controls-drawer ${controlsOpen ? 'is-open' : ''}`}>
            <ControlsPanel
              params={params}
              derived={derived}
              highlightedSymbol={highlightedSymbol}
              onHighlightSymbol={setHighlightedSymbol}
              onChange={handleParamChange}
            />
          </div>
        </>
      ) : (
        <main className="theory-workspace">
          <EquationsPanel
            params={params}
            derived={derived}
            highlightedSymbol={highlightedSymbol}
            onHighlightSymbol={setHighlightedSymbol}
          />
          <SingularityPanel params={params} derived={derived} />
        </main>
      )}
    </div>
  );
};

export default App;
