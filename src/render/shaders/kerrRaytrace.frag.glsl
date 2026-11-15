#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;

// Dimensionless spacetime parameters (G = c = M = 1)
uniform float uSpin;            // a_* in [0, 0.998]
uniform float uADrag;           // kappa_drag * a_*
uniform float uPotExp;          // n in Delta = r^2 - 2 r^(2-n) + a^2 + q^2
uniform float uChargeQ;         // q in Delta
uniform float uRPlus;           // outer horizon r_+ (or <= 0 if horizonless)
uniform float uHasHorizon;      // 1.0 if horizon exists, 0.0 otherwise

// Observer camera parameters
uniform float uRObs;
uniform float uThetaObs;
uniform float uPhiObs;
uniform float uFovRad;

// Accretion disk parameters
uniform float uDiskInner;
uniform float uDiskOuter;

// Toggles (0.0 or 1.0)
uniform float uEnableDoppler;
uniform float uEnableRedshift;
uniform float uEnableCurved;
uniform float uShowDisk;
uniform float uShowPhotonRing;

const float PI = 3.14159265359;

float kerrDelta(float r) {
  float safeR = max(r, 1e-4);
  return r * r - 2.0 * pow(safeR, 2.0 - uPotExp) + uSpin * uSpin + uChargeQ * uChargeQ;
}

void computeDerivatives(
  float r,
  float theta,
  float pr,
  float pTheta,
  float E,
  float Lz,
  out float dr,
  out float dTheta,
  out float dPhi,
  out float dPr,
  out float dPTheta
) {
  float sinT = sin(theta);
  float safeSin = abs(sinT) < 1e-4 ? (sinT >= 0.0 ? 1e-4 : -1e-4) : sinT;
  float cosT = cos(theta);
  float sin2 = safeSin * safeSin;
  float sin3 = sin2 * safeSin;

  float delta = kerrDelta(r);
  float safeDelta = abs(delta) < 1e-5 ? (delta >= 0.0 ? 1e-5 : -1e-5) : delta;
  float safeR = max(r, 1e-4);
  float dDeltaDr = 2.0 * r - 2.0 * (2.0 - uPotExp) * pow(safeR, 1.0 - uPotExp);

  float P = (r * r + uSpin * uSpin) * E - uADrag * Lz;
  float dPDr = 2.0 * r * E;

  dr = safeDelta * pr;
  dTheta = pTheta;
  dPhi = (uADrag * P) / safeDelta + (Lz - uADrag * E * sin2) / sin2;

  dPr = -0.5 * dDeltaDr * pr * pr + (P * dPDr * safeDelta - 0.5 * P * P * dDeltaDr) / (safeDelta * safeDelta);
  dPTheta = (Lz * Lz * cosT) / sin3 - uADrag * uADrag * E * E * safeSin * cosT;
}

float hash31(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 blackbodyColor(float tempNorm) {
  // Smooth physically inspired blackbody ramp from deep red -> amber -> warm white -> blue-white
  float t = clamp(tempNorm, 0.05, 2.2);
  vec3 cool = vec3(0.95, 0.28, 0.08);
  vec3 warm = vec3(1.00, 0.68, 0.30);
  vec3 hot = vec3(1.00, 0.94, 0.86);
  vec3 blueHot = vec3(0.68, 0.85, 1.00);

  if (t < 0.55) {
    return mix(cool, warm, smoothstep(0.08, 0.55, t));
  } else if (t < 1.15) {
    return mix(warm, hot, smoothstep(0.55, 1.15, t));
  } else {
    return mix(hot, blueHot, smoothstep(1.15, 2.0, t));
  }
}

vec3 sampleStarfield(vec3 dir) {
  vec3 d = normalize(dir);
  vec3 col = vec3(0.008, 0.011, 0.020);

  // Subtle galactic plane glow inclined relative to the BH equator
  float bandCoord = dot(d, normalize(vec3(0.24, 0.38, 0.89)));
  float galactic = exp(-bandCoord * bandCoord * 16.0);
  float dust = sin(d.x * 9.0 + d.y * 7.0) * cos(d.z * 11.0 - d.x * 5.0);
  col += vec3(0.045, 0.055, 0.095) * galactic * (0.75 + 0.25 * dust);

  // Two layers of crisp point stars
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 115.0 : 210.0;
    vec3 grid = d * scale;
    vec3 cell = floor(grid);
    vec3 f = fract(grid) - 0.5;
    float h = hash31(cell + float(layer) * 37.0);
    if (h > (layer == 0 ? 0.986 : 0.991)) {
      vec3 jitter = vec3(
        hash31(cell + 1.3) - 0.5,
        hash31(cell + 7.1) - 0.5,
        hash31(cell + 13.7) - 0.5
      ) * 0.55;
      float dist = length(f - jitter);
      float intensity = smoothstep(0.24, 0.0, dist);
      float tempMix = hash31(cell + 29.3);
      vec3 starTint = mix(vec3(1.0, 0.82, 0.65), vec3(0.75, 0.88, 1.0), tempMix);
      float mag = mix(0.35, 1.65, pow(hash31(cell + 53.1), 2.0));
      col += starTint * intensity * intensity * mag;
    }
  }
  return col;
}

vec4 shadeDiskHit(float rHit, float phiHit, float E, float Lz) {
  float radialNorm = clamp((rHit - uDiskInner) / max(0.5, uDiskOuter - uDiskInner), 0.0, 1.0);
  float innerFade = smoothstep(uDiskInner, uDiskInner + 0.35, rHit);
  float outerFade = 1.0 - smoothstep(uDiskOuter - 2.5, uDiskOuter, rHit);

  // Differential Keplerian shear spiral texture
  float omega = 1.0 / (pow(max(rHit, 1.05), 1.5) + uADrag);
  float spiralPhase = phiHit - uTime * omega * 2.4 + 4.2 * log(max(rHit, 1.01));
  float rings = 0.72 + 0.28 * sin(rHit * 5.2 + sin(spiralPhase * 2.0) * 0.8);
  float filaments = 0.65 + 0.35 * sin(spiralPhase * 3.0 + 1.5 * cos(rHit * 2.7 - spiralPhase));
  float density = innerFade * outerFade * rings * filaments;

  // Relativistic frequency shift g = E_obs / E_emit for prograde circular Keplerian disk
  float g = 1.0;
  if (uEnableCurved > 0.5) {
    float gtt = -(1.0 - 2.0 * pow(max(rHit, 1e-4), -uPotExp));
    float gtphi = -2.0 * uADrag * pow(max(rHit, 1e-4), -uPotExp);
    float gphiphi = rHit * rHit + uSpin * uSpin + (2.0 * uADrag * uSpin) * pow(max(rHit, 1e-4), -uPotExp);
    float normSq = -(gtt + 2.0 * omega * gtphi + omega * omega * gphiphi);
    if (normSq > 0.02) {
      float uT = inversesqrt(normSq);
      float denom = (E - omega * Lz) * uT;
      if (denom > 0.05) {
        g = clamp(E / denom, 0.15, 2.6);
      }
    }
  }

  float tempProfile = pow(clamp(uDiskInner / max(rHit, uDiskInner), 0.1, 1.0), 0.75);
  float effectiveTemp = tempProfile * (uEnableRedshift > 0.5 ? g : 1.0);
  vec3 color = blackbodyColor(effectiveTemp * 1.15);

  float beaming = uEnableDoppler > 0.5 ? pow(g, 3.0) : 1.0;
  float emission = density * (0.45 + 1.4 * tempProfile) * clamp(beaming, 0.08, 4.5);

  return vec4(color * emission, clamp(density * 0.92, 0.0, 0.96));
}

void main() {
  vec2 ndc = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float tanHalfFov = tan(0.5 * uFovRad);

  // Screen coordinates: +x points right (prograde side), +y points up
  vec2 screen = vec2(ndc.x * aspect * tanHalfFov, ndc.y * tanHalfFov);

  // In ZAMO local triad:
  // inward toward BH is -e_r, up is -e_theta (decreasing theta), right is +e_phi (prograde)
  vec3 rayLocal = normalize(vec3(-1.0, -screen.y, screen.x));
  float nR = rayLocal.x;
  float nTheta = rayLocal.y;
  float nPhi = rayLocal.z;

  // Flat-space comparison mode when curved spacetime is toggled off
  if (uEnableCurved < 0.5) {
    vec3 camPos = vec3(
      uRObs * sin(uThetaObs) * cos(uPhiObs),
      uRObs * sin(uThetaObs) * sin(uPhiObs),
      uRObs * cos(uThetaObs)
    );
    vec3 eR = normalize(camPos);
    vec3 eTheta = normalize(vec3(
      cos(uThetaObs) * cos(uPhiObs),
      cos(uThetaObs) * sin(uPhiObs),
      -sin(uThetaObs)
    ));
    vec3 ePhi = normalize(vec3(-sin(uPhiObs), cos(uPhiObs), 0.0));
    vec3 rayWorld = normalize(nR * eR + nTheta * eTheta + nPhi * ePhi);

    vec3 accum = vec3(0.0);
    float alphaRem = 1.0;

    // Straight-line accretion disk intersection (z = 0)
    if (uShowDisk > 0.5 && abs(rayWorld.z) > 1e-5) {
      float tDisk = -camPos.z / rayWorld.z;
      if (tDisk > 0.0) {
        vec3 pHit = camPos + tDisk * rayWorld;
        float rHit = length(pHit.xy);
        if (rHit >= uDiskInner && rHit <= uDiskOuter) {
          float phiHit = atan(pHit.y, pHit.x);
          vec4 disk = shadeDiskHit(rHit, phiHit, 1.0, 0.0);
          accum += disk.rgb;
          alphaRem *= (1.0 - disk.a);
        }
      }
    }

    // Straight-line horizon sphere check
    float bSq = dot(camPos, camPos) - pow(dot(camPos, rayWorld), 2.0);
    float rSphere = uHasHorizon > 0.5 ? uRPlus : 0.2;
    if (dot(camPos, rayWorld) < 0.0 && bSq < rSphere * rSphere) {
      accum *= 0.2;
      fragColor = vec4(accum, 1.0);
      return;
    }

    vec3 bg = sampleStarfield(rayWorld);
    fragColor = vec4(pow(accum + alphaRem * bg, vec3(0.85)), 1.0);
    return;
  }

  // ZAMO tetrad mapping to Boyer-Lindquist momenta
  float sinT0 = max(1e-4, sin(uThetaObs));
  float cosT0 = cos(uThetaObs);
  float sin2_0 = sinT0 * sinT0;
  float r2_0 = uRObs * uRObs;
  float a2 = uSpin * uSpin;
  float sigma0 = r2_0 + a2 * cosT0 * cosT0;
  float delta0 = max(1e-5, kerrDelta(uRObs));
  float A0 = (r2_0 + a2) * (r2_0 + a2) - a2 * delta0 * sin2_0;

  float lapse = sqrt((sigma0 * delta0) / A0);
  float omega0 = (2.0 * uADrag * pow(max(uRObs, 1e-4), 2.0 - uPotExp)) / A0;
  float ePhiNorm = sqrt(A0 / sigma0) * sinT0;

  float E = lapse - omega0 * ePhiNorm * nPhi;
  float Lz = ePhiNorm * nPhi;
  float pr = sqrt(sigma0 / delta0) * nR;
  float pTheta = sqrt(sigma0) * nTheta;

  float r = uRObs;
  float theta = uThetaObs;
  float phi = uPhiObs;

  float rCapture = uHasHorizon > 0.5 ? uRPlus * 1.015 : 0.14;
  float rEscape = max(uRObs * 2.2, 55.0);

  vec3 accumColor = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  int diskCrossings = 0;

  const int MAX_STEPS = 420;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (r <= rCapture) {
      captured = true;
      break;
    }
    if (r >= rEscape && pr > 0.0) {
      break;
    }

    float prevR = r;
    float prevTheta = theta;
    float prevPhi = phi;

    float deltaCur = abs(kerrDelta(r));
    float rScale = r * r + a2 + 1.0;
    float h = 0.032 * clamp(deltaCur / rScale, 0.014, 1.0) / max(1.0, r * 0.72);
    // Boost step slightly at large radii to escape efficiently
    if (r > 16.0) {
      h *= min(2.6, r / 16.0);
    }

    float k1r, k1t, k1p, k1pr, k1pt;
    float k2r, k2t, k2p, k2pr, k2pt;
    float k3r, k3t, k3p, k3pr, k3pt;
    float k4r, k4t, k4p, k4pr, k4pt;

    computeDerivatives(r, theta, pr, pTheta, E, Lz, k1r, k1t, k1p, k1pr, k1pt);
    computeDerivatives(r + 0.5 * h * k1r, theta + 0.5 * h * k1t, pr + 0.5 * h * k1pr, pTheta + 0.5 * h * k1pt, E, Lz, k2r, k2t, k2p, k2pr, k2pt);
    computeDerivatives(r + 0.5 * h * k2r, theta + 0.5 * h * k2t, pr + 0.5 * h * k2pr, pTheta + 0.5 * h * k2pt, E, Lz, k3r, k3t, k3p, k3pr, k3pt);
    computeDerivatives(r + h * k3r, theta + h * k3t, pr + h * k3pr, pTheta + h * k3pt, E, Lz, k4r, k4t, k4p, k4pr, k4pt);

    r += (h / 6.0) * (k1r + 2.0 * k2r + 2.0 * k3r + k4r);
    theta += (h / 6.0) * (k1t + 2.0 * k2t + 2.0 * k3t + k4t);
    phi += (h / 6.0) * (k1p + 2.0 * k2p + 2.0 * k3p + k4p);
    pr += (h / 6.0) * (k1pr + 2.0 * k2pr + 2.0 * k3pr + k4pr);
    pTheta += (h / 6.0) * (k1pt + 2.0 * k2pt + 2.0 * k3pt + k4pt);

    if (theta < 0.0) {
      theta = -theta;
      pTheta = -pTheta;
      phi += PI;
    } else if (theta > PI) {
      theta = 2.0 * PI - theta;
      pTheta = -pTheta;
      phi += PI;
    }

    // Check equatorial disk intersection
    if (uShowDisk > 0.5) {
      float side0 = prevTheta - 0.5 * PI;
      float side1 = theta - 0.5 * PI;
      if ((side0 < 0.0 && side1 >= 0.0) || (side0 > 0.0 && side1 <= 0.0)) {
        float frac = abs(side0) / max(1e-6, abs(side0 - side1));
        float rHit = mix(prevR, r, frac);
        float phiHit = mix(prevPhi, phi, frac);
        if (rHit >= uDiskInner && rHit <= uDiskOuter) {
          diskCrossings++;
          vec4 diskSample = shadeDiskHit(rHit, phiHit, E, Lz);
          // Secondary/lensed photon-ring echoes stay slightly sharper
          float orderBoost = diskCrossings > 1 ? 1.15 : 1.0;
          accumColor += transmittance * diskSample.rgb * orderBoost;
          transmittance *= (1.0 - diskSample.a);
          if (transmittance < 0.02) {
            break;
          }
        }
      }
    }
  }

  // Subtle photon-ring highlight from rays that grazed near the photon sphere (multiple crossings)
  if (uShowPhotonRing > 0.5 && !captured && diskCrossings >= 2) {
    accumColor += transmittance * vec3(0.95, 0.72, 0.42) * 0.22;
  }

  if (!captured) {
    vec3 skyDir = vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    accumColor += transmittance * sampleStarfield(skyDir);
  }

  // Filmic tone mapping
  vec3 mapped = accumColor / (accumColor + vec3(0.85));
  mapped = pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.15));
  fragColor = vec4(mapped, 1.0);
}
