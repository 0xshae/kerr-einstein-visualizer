import vertexShaderSource from './shaders/fullscreen.vert.glsl?raw';
import fragmentShaderSource from './shaders/kerrRaytrace.frag.glsl?raw';
import type { DerivedQuantities, SimulationParams } from '../physics/types';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL shader object');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compilation failed: ${info}`);
  }
  return shader;
}

export class WebGLRaytracer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 is unavailable in this browser');
    }
    this.gl = gl;

    const vert = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to allocate WebGL program');
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'Unknown link error';
      gl.deleteProgram(program);
      throw new Error(`WebGL program link failed: ${info}`);
    }
    this.program = program;

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VertexArrayObject');
    }
    this.vao = vao;
    gl.bindVertexArray(vao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const uniformNames = [
      'uResolution',
      'uTime',
      'uSpin',
      'uADrag',
      'uPotExp',
      'uChargeQ',
      'uRPlus',
      'uHasHorizon',
      'uRObs',
      'uThetaObs',
      'uPhiObs',
      'uFovRad',
      'uDiskInner',
      'uDiskOuter',
      'uEnableDoppler',
      'uEnableRedshift',
      'uEnableCurved',
      'uShowDisk',
      'uShowPhotonRing',
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  render(params: SimulationParams, derived: DerivedQuantities, timeSec: number): void {
    const gl = this.gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    gl.viewport(0, 0, width, height);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.uniforms.uResolution, width, height);
    gl.uniform1f(this.uniforms.uTime, timeSec);

    gl.uniform1f(this.uniforms.uSpin, derived.a);
    gl.uniform1f(this.uniforms.uADrag, derived.aDrag);
    gl.uniform1f(this.uniforms.uPotExp, derived.potentialExponent);
    gl.uniform1f(this.uniforms.uChargeQ, derived.chargeLikeQ);
    gl.uniform1f(this.uniforms.uRPlus, derived.rPlusM ?? 0);
    gl.uniform1f(this.uniforms.uHasHorizon, derived.rPlusM !== null ? 1 : 0);

    const safeRObs = Math.max(derived.observerRM, (derived.rPlusM ?? 1.0) + 1.2);
    gl.uniform1f(this.uniforms.uRObs, safeRObs);
    gl.uniform1f(this.uniforms.uThetaObs, (params.inclinationDeg * Math.PI) / 180);
    gl.uniform1f(this.uniforms.uPhiObs, (params.azimuthDeg * Math.PI) / 180);
    gl.uniform1f(this.uniforms.uFovRad, (params.fovDeg * Math.PI) / 180);

    const diskInner = params.lockDiskToIsco ? derived.rIscoProgradeM : params.diskInnerM;
    gl.uniform1f(this.uniforms.uDiskInner, diskInner);
    gl.uniform1f(this.uniforms.uDiskOuter, Math.max(diskInner + 1.5, params.diskOuterM));

    gl.uniform1f(this.uniforms.uEnableDoppler, params.effects.dopplerBeaming ? 1 : 0);
    gl.uniform1f(this.uniforms.uEnableRedshift, params.effects.gravitationalRedshift ? 1 : 0);
    gl.uniform1f(this.uniforms.uEnableCurved, params.effects.curvedSpacetime ? 1 : 0);
    gl.uniform1f(this.uniforms.uShowDisk, params.effects.showAccretionDisk ? 1 : 0);
    gl.uniform1f(this.uniforms.uShowPhotonRing, params.effects.showPhotonRing ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
