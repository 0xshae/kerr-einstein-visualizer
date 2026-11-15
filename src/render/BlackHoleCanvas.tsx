import React, { useEffect, useRef, useState } from 'react';
import { WebGLRaytracer } from './WebGLRaytracer';
import type { DerivedQuantities, SimulationParams } from '../physics/types';

interface BlackHoleCanvasProps {
  params: SimulationParams;
  derived: DerivedQuantities;
  onCameraChange: (patch: Partial<Pick<SimulationParams, 'inclinationDeg' | 'azimuthDeg' | 'observerDistanceKm'>>) => void;
}

export const BlackHoleCanvas: React.FC<BlackHoleCanvasProps> = ({
  params,
  derived,
  onCameraChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raytracerRef = useRef<WebGLRaytracer | null>(null);
  const paramsRef = useRef(params);
  const derivedRef = useRef(derived);
  const draggingRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  paramsRef.current = params;
  derivedRef.current = derived;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const tracer = new WebGLRaytracer(canvas);
      raytracerRef.current = tracer;
      setWebglError(null);
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Unable to initialize WebGL2');
      return;
    }

    let frameId = 0;
    const startMs = performance.now();

    const loop = (now: number) => {
      const targetCanvas = canvasRef.current;
      const container = containerRef.current;
      const tracer = raytracerRef.current;
      if (targetCanvas && container && tracer) {
        const rect = container.getBoundingClientRect();
        const scale = draggingRef.current.active ? 0.55 : Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.max(200, Math.floor(rect.width * scale));
        const h = Math.max(200, Math.floor(rect.height * scale));
        if (targetCanvas.width !== w || targetCanvas.height !== h) {
          targetCanvas.width = w;
          targetCanvas.height = h;
        }
        tracer.render(paramsRef.current, derivedRef.current, (now - startMs) * 0.001);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      raytracerRef.current?.dispose();
      raytracerRef.current = null;
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    setIsInteracting(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.lastX;
    const dy = e.clientY - draggingRef.current.lastY;
    draggingRef.current.lastX = e.clientX;
    draggingRef.current.lastY = e.clientY;

    const nextAzimuth = ((paramsRef.current.azimuthDeg - dx * 0.35) % 360 + 360) % 360;
    const nextInc = Math.min(174, Math.max(6, paramsRef.current.inclinationDeg - dy * 0.3));
    onCameraChange({ azimuthDeg: nextAzimuth, inclinationDeg: nextInc });
  };

  const handlePointerUp = () => {
    draggingRef.current.active = false;
    setIsInteracting(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.07 : 0.93;
    const minKm = Math.max(derived.rgKm * ((derived.rPlusM ?? 1.2) + 2.2), 12);
    const maxKm = derived.rgKm * 95;
    const nextKm = Math.min(maxKm, Math.max(minKm, params.observerDistanceKm * factor));
    onCameraChange({ observerDistanceKm: nextKm });
  };

  const regimeBadge =
    derived.regime === 'schwarzschild'
      ? { label: 'Schwarzschild Limit (a* = 0) · R_μν = 0', tone: 'badge-exact' }
      : derived.regime === 'kerr'
        ? { label: `Kerr Vacuum (a* = ${derived.a.toFixed(3)}) · R_μν = 0`, tone: 'badge-exact' }
        : { label: 'Custom Metric Sandbox · R_μν ≠ 0 (Non-Vacuum)', tone: 'badge-custom' };

  return (
    <div ref={containerRef} className="canvas-stage">
      {webglError ? (
        <div className="webgl-fallback">
          <h3>WebGL2 Geodesic Renderer Unavailable</h3>
          <p>{webglError}</p>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={`raytrace-canvas ${isInteracting ? 'is-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        />
      )}

      <div className="canvas-hud-top">
        <span className={`regime-badge ${regimeBadge.tone}`}>{regimeBadge.label}</span>
        {!params.effects.curvedSpacetime && (
          <span className="regime-badge badge-flat">Flat Spacetime Comparison (No Lensing)</span>
        )}
      </div>

      <div className="canvas-hud-bottom">
        <div className="hud-stat">
          <span>Horizon r₊</span>
          <strong>{derived.rPlusM !== null ? `${derived.rPlusM.toFixed(3)} M` : 'Naked (None)'}</strong>
        </div>
        <div className="hud-stat">
          <span>Prograde ISCO</span>
          <strong>{derived.rIscoProgradeM.toFixed(3)} M</strong>
        </div>
        <div className="hud-stat">
          <span>Observer r / r_g</span>
          <strong>{derived.observerRM.toFixed(1)} M</strong>
        </div>
        <div className="hud-stat">
          <span>Shadow Width</span>
          <strong>{derived.shadowMetrics.width.toFixed(2)} M</strong>
        </div>
        <div className="hud-hint">Drag to orbit · Scroll to zoom</div>
      </div>
    </div>
  );
};
