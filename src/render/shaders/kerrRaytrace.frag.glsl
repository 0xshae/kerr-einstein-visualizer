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

// ---------- Noise ----------

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float fbm3(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

// ---------- Color science ----------

// Blackbody chromaticity for temperature in Kelvin (fit to CIE 1964 data), returned in linear RGB
vec3 blackbodyRGB(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332048), 0.0, 1.0);
  float g = t <= 66.0
    ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
    : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
  return pow(vec3(r, g, b), vec3(2.2));
}

vec3 acesFilm(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 finishColor(vec3 hdr, vec2 fragCoord) {
  vec3 mapped = acesFilm(hdr * 0.45);
  mapped = pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.2));
  // Faint display-space grain to break up banding in the dark sky
  float grain = hash31(vec3(fragCoord, floor(uTime * 24.0))) - 0.5;
  return mapped + grain * 0.006;
}

// ---------- Sky ----------

vec3 sampleStarfield(vec3 dir) {
  vec3 d = normalize(dir);
  vec3 col = vec3(0.0015, 0.0017, 0.0024);

  // Faint, dusty Milky Way band tilted against the BH equator
  float bandCoord = dot(d, normalize(vec3(0.24, 0.38, 0.89)));
  float galactic = exp(-bandCoord * bandCoord * 18.0);
  float clouds = fbm3(d * 6.0);
  float dustLanes = smoothstep(0.42, 0.62, fbm3(d * 11.0 + 4.0));
  col += vec3(0.020, 0.019, 0.017) * galactic * clouds * (1.0 - 0.75 * dustLanes);

  // Three layers of point stars with realistic stellar colors and a steep magnitude distribution
  for (int layer = 0; layer < 3; layer++) {
    float scale = layer == 0 ? 90.0 : (layer == 1 ? 180.0 : 340.0);
    float threshold = layer == 0 ? 0.992 : (layer == 1 ? 0.985 : 0.975);
    vec3 grid = d * scale;
    vec3 cell = floor(grid);
    vec3 f = fract(grid) - 0.5;
    float h = hash31(cell + float(layer) * 37.0);
    if (h > threshold) {
      vec3 jitter = vec3(
        hash31(cell + 1.3) - 0.5,
        hash31(cell + 7.1) - 0.5,
        hash31(cell + 13.7) - 0.5
      ) * 0.5;
      float dist = length(f - jitter);
      float core = exp(-dist * dist * 90.0);
      float starTemp = mix(3200.0, 11000.0, pow(hash31(cell + 29.3), 1.6));
      float mag = pow(hash31(cell + 53.1), 6.0) * (layer == 0 ? 3.0 : 1.0) + 0.04;
      col += blackbodyRGB(starTemp) * core * mag * (1.0 + 2.0 * galactic);
    }
  }
  return col;
}

// ---------- Accretion disk ----------

vec4 shadeDiskHit(float rHit, float phiHit, float E, float Lz) {
  float rIn = max(uDiskInner, 1.0);
  float x = max(rHit / rIn, 1.0);

  // Novikov-Thorne-like thin-disk flux F(r) ~ r^-3 (1 - sqrt(r_in / r)), peak near r = 1.36 r_in
  float flux = pow(x, -3.0) * (1.0 - inversesqrt(x));
  const float FLUX_PEAK = 0.05669;
  float fluxNorm = flux / FLUX_PEAK;
  // Local effective temperature T ~ F^(1/4)
  float tempLocal = 6200.0 * pow(max(fluxNorm, 1e-4), 0.25);

  // Keplerian angular velocity (prograde), used for both shading and redshift
  float omega = 1.0 / (pow(max(rHit, 1.05), 1.5) + uADrag);

  // Turbulent plasma: azimuthally stretched, differentially rotating noise (no seam at phi = +-pi)
  float swirlPhi = phiHit - uTime * omega * 0.9;
  vec3 noiseP = vec3(cos(swirlPhi) * 2.4, sin(swirlPhi) * 2.4, log(rHit) * 9.0);
  float turb = fbm3(noiseP + vec3(0.0, 0.0, uTime * 0.02));
  float fine = valueNoise3(noiseP * vec3(1.0, 1.0, 3.5) * 2.0);
  float clump = 0.15 + 1.9 * pow(turb, 1.6) * (0.55 + 0.45 * fine);

  float outerFade = 1.0 - smoothstep(uDiskOuter * 0.7, uDiskOuter, rHit);
  float density = clamp(clump, 0.0, 1.6) * outerFade;

  // Relativistic frequency shift g = nu_obs / nu_emit for a prograde circular Keplerian emitter
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
        g = clamp(E / denom, 0.1, 3.0);
      }
    }
  }

  // Observed color: blackbody at the Doppler/gravitationally shifted temperature
  float tempObs = tempLocal * (uEnableRedshift > 0.5 ? g : 1.0);
  vec3 color = blackbodyRGB(tempObs);

  // Bolometric intensity transforms as g^4 (Liouville: I_nu / nu^3 invariant)
  float beaming = uEnableDoppler > 0.5 ? pow(g, 4.0) : 1.0;
  float emission = 2.2 * fluxNorm * density * beaming;

  float alpha = clamp(0.55 * density * smoothstep(0.0, 0.15, fluxNorm), 0.0, 0.9);
  return vec4(color * emission, alpha);
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
  // Keep rays off the exact spin axis (L_z = 0), where the BL pole is singular
  float nPhi = abs(rayLocal.z) < 2e-3 ? (rayLocal.z < 0.0 ? -2e-3 : 2e-3) : rayLocal.z;

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
      fragColor = vec4(finishColor(accum, gl_FragCoord.xy), 1.0);
      return;
    }

    vec3 bg = sampleStarfield(rayWorld);
    fragColor = vec4(finishColor(accum + alphaRem * bg, gl_FragCoord.xy), 1.0);
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

  bool escaped = false;
  const int MAX_STEPS = 800;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (r <= rCapture) {
      captured = true;
      break;
    }
    if (r >= rEscape && pr > 0.0) {
      escaped = true;
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
    // Shrink steps near the spin axis where L_z / sin^2(theta) terms get stiff
    h *= clamp(abs(sin(theta)) * 5.0, 0.06, 1.0);

    float k1r, k1t, k1p, k1pr, k1pt;
    float k2r, k2t, k2p, k2pr, k2pt;
    float k3r, k3t, k3p, k3pr, k3pt;
    float k4r, k4t, k4p, k4pr, k4pt;

    computeDerivatives(r, theta, pr, pTheta, E, Lz, k1r, k1t, k1p, k1pr, k1pt);
    // Bound the physical displacement per step so linear disk-hit interpolation stays accurate
    // (inside the disk zone a step may move at most ~0.35 M radially and 0.04 rad in theta)
    float maxDr = r < uDiskOuter + 4.0 ? 0.35 : max(0.35, 0.08 * r);
    h = min(h, maxDr / max(abs(k1r), 1e-6));
    h = min(h, 0.04 / max(abs(k1t), 1e-6));
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
          float orderBoost = 1.0;
          accumColor += transmittance * diskSample.rgb * orderBoost;
          transmittance *= (1.0 - diskSample.a);
          if (transmittance < 0.02) {
            break;
          }
        }
      }
    }
  }

  // A ray that exhausted its budget still deep in the well is effectively trapped
  if (!captured && !escaped && r < uRObs * 0.5) {
    captured = true;
  }

  // Faint photon-ring sheen from rays that orbited the hole more than once
  if (uShowPhotonRing > 0.5 && !captured && diskCrossings >= 3) {
    accumColor *= 1.25;
  }

  if (!captured) {
    vec3 skyDir = vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    accumColor += transmittance * sampleStarfield(skyDir);
  }

  fragColor = vec4(finishColor(accumColor, gl_FragCoord.xy), 1.0);
}
