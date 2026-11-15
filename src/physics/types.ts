export type MetricMode = 'kerr' | 'custom';

export interface EffectToggles {
  /** Enable relativistic Doppler beaming (I_obs ~ g^3). */
  dopplerBeaming: boolean;
  /** Enable gravitational + Doppler temperature color shift. */
  gravitationalRedshift: boolean;
  /** Enable curved spacetime ray tracing (false = flat Euclidean comparison). */
  curvedSpacetime: boolean;
  /** Render the equatorial accretion disk. */
  showAccretionDisk: boolean;
  /** Overlay subtle photon ring / horizon boundary indicators on HUD or cross section. */
  showPhotonRing: boolean;
}

export interface CustomMetricParams {
  /**
   * Radial potential exponent n in Delta(r) = r^2 - 2 r^(2-n) + a^2 + q^2.
   * n = 1 recovers exact Kerr/Schwarzschild 1/r Newtonian potential.
   */
  potentialExponent: number;
  /**
   * Multiplier on frame-dragging coupling a_drag = kappa * a.
   * kappa = 1 recovers exact Kerr; kappa = 0 disables frame dragging at nonzero spin.
   */
  frameDragFactor: number;
  /**
   * Dimensionless charge-like parameter q in Delta(r) = ... + q^2.
   * q = 0 recovers Kerr; nonzero q mimics a Kerr-Newman-like inner/outer horizon shift.
   */
  chargeLikeQ: number;
}

export interface SimulationParams {
  /** Black hole mass in solar masses (M_sun). */
  massSolar: number;
  /** Dimensionless spin parameter a_* = Jc / (GM^2) in [0, 0.998]. */
  spin: number;
  /** Physical camera distance from center in kilometers. */
  observerDistanceKm: number;
  /** Camera polar inclination theta_obs in degrees (from spin axis: 90 = edge-on, 5 = nearly pole-on). */
  inclinationDeg: number;
  /** Camera azimuth phi_obs in degrees. */
  azimuthDeg: number;
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Inner accretion disk edge in units of r_g (auto-synced to ISCO when lockDiskToIsco is true). */
  diskInnerM: number;
  /** Outer accretion disk edge in units of r_g. */
  diskOuterM: number;
  /** When true, inner disk edge tracks prograde ISCO automatically. */
  lockDiskToIsco: boolean;
  /** Exact Kerr/Schwarzschild mode vs. clearly badged non-vacuum custom metric sandbox. */
  metricMode: MetricMode;
  /** Custom metric perturbations (active only when metricMode === 'custom'). */
  customMetric: CustomMetricParams;
  /** Visual and relativistic physics toggles. */
  effects: EffectToggles;
}

export interface DerivedQuantities {
  /** Active regime label. */
  regime: 'schwarzschild' | 'kerr' | 'custom';
  /** True when the active metric is an exact vacuum solution of R_uv = 0. */
  isExactVacuum: boolean;
  /** Gravitational radius r_g = GM/c^2 in km. */
  rgKm: number;
  /** Schwarzschild reference radius 2 r_g in km. */
  rsKm: number;
  /** Observer distance in dimensionless units of M (r_obs / r_g). */
  observerRM: number;
  /** Effective spin a_* used by metric equations. */
  a: number;
  /** Effective frame-dragging parameter a_drag = kappa * a. */
  aDrag: number;
  /** Effective exponent n in Delta(r). */
  potentialExponent: number;
  /** Effective charge-like q in Delta(r). */
  chargeLikeQ: number;
  /** Outer event horizon r_+ in units of M (null if naked/horizonless in custom mode). */
  rPlusM: number | null;
  /** Inner Cauchy horizon r_- in units of M (null if absent). */
  rMinusM: number | null;
  /** Equatorial ergosphere radius r_ergo(pi/2) in units of M. */
  rErgoEquatorialM: number | null;
  /** Ergosphere radius at the current observer inclination theta_obs. */
  rErgoAtObserverM: number | null;
  /** Prograde equatorial photon orbit radius r_ph+ in units of M. */
  rPhotonProgradeM: number | null;
  /** Retrograde equatorial photon orbit radius r_ph- in units of M. */
  rPhotonRetrogradeM: number | null;
  /** Prograde innermost stable circular orbit r_ISCO+ in units of M. */
  rIscoProgradeM: number;
  /** Retrograde innermost stable circular orbit r_ISCO- in units of M. */
  rIscoRetrogradeM: number;
  /** Horizon angular velocity Omega_H in dimensionless 1/M units (0 for Schwarzschild). */
  omegaHorizonPerM: number;
  /** Horizon angular velocity in rad/s. */
  omegaHorizonRadPerSec: number;
  /** Kretschmann scalar K at observer position in dimensionless M^-4 units. */
  kretschmannAtObserverDimless: number;
  /** Kretschmann scalar K at observer position in m^-4. */
  kretschmannAtObserverSI: number;
  /** Analytical shadow boundary in celestial screen coordinates (alpha, beta) in units of M. */
  shadowOutline: Array<{ alpha: number; beta: number }>;
  /** Horizontal shadow width and center shift in units of M. */
  shadowMetrics: {
    alphaMin: number;
    alphaMax: number;
    betaMax: number;
    width: number;
    centerShift: number;
  };
}
