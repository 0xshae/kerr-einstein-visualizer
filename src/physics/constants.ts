/**
 * Fundamental SI physical constants and relativistic unit conversions.
 *
 * Throughout the geodesic integrator and analytic formulas we work in
 * geometrized units where G = c = 1 and lengths are expressed in units of
 * the gravitational radius r_g = G * M / c^2 (so M_geom = 1).
 */
export const SI = {
  /** Gravitational constant (m^3 kg^-1 s^-2) */
  G: 6.6743e-11,
  /** Speed of light in vacuum (m s^-1) */
  c: 2.99792458e8,
  /** Solar mass (kg) */
  M_SUN: 1.98847e30,
} as const;

/** Gravitational radius r_g = G * M_sun / c^2 in kilometers (~1.476625 km). */
export const SOLAR_RG_KM = (SI.G * SI.M_SUN) / (SI.c * SI.c) / 1000;

/** Reference mass in solar masses used to anchor fixed physical observer distance. */
export const DEFAULT_REFERENCE_MASS_SOLAR = 10;

/** Convert solar masses to gravitational radius r_g = GM/c^2 in km. */
export function massSolarToRgKm(massSolar: number): number {
  return massSolar * SOLAR_RG_KM;
}

/** Convert solar masses to Schwarzschild radius r_s = 2GM/c^2 in km. */
export function massSolarToRsKm(massSolar: number): number {
  return 2 * massSolarToRgKm(massSolar);
}

/** Convert physical distance (km) into dimensionless units of r_g = GM/c^2. */
export function kmToDimensionlessR(distanceKm: number, massSolar: number): number {
  const rgKm = massSolarToRgKm(massSolar);
  return rgKm > 0 ? distanceKm / rgKm : Infinity;
}

/** Convert dimensionless radius (in r_g) to kilometers for a given mass. */
export function dimensionlessRToKm(rM: number, massSolar: number): number {
  return rM * massSolarToRgKm(massSolar);
}

/** Geometric angular frequency scale c^3 / (G M) in rad/s. */
export function angularFrequencyScaleRadPerSec(massSolar: number): number {
  return (SI.c * SI.c * SI.c) / (SI.G * massSolar * SI.M_SUN);
}
