/**
 * Orbital Mechanics — Physical Constants
 */

/** Gravitational parameter of Earth μ = GM [m³/s²] */
export const MU_EARTH = 3.986004418e14;

/** Earth radius [m] */
export const R_EARTH = 6.371e6;

/** Standard gravity [m/s²] */
export const G0 = 9.80665;

/** ISS orbital altitude [m] */
export const ISS_ALTITUDE = 408000;

/** LEO typical altitude [m] */
export const LEO_ALTITUDE = 400000;

/** Deg to rad */
export const DEG_TO_RAD = Math.PI / 180;

/** Rad to deg */
export const RAD_TO_DEG = 180 / Math.PI;

/** Physics timestep [s] */
export const PHYSICS_DT = 1.0; // 1 second steps for orbital mechanics

/**
 * Circular orbital velocity at given radius
 * v = sqrt(μ/r)
 */
export function circularVelocity(radius: number): number {
  return Math.sqrt(MU_EARTH / radius);
}

/**
 * Orbital period for given semi-major axis
 * T = 2π * sqrt(a³/μ)
 */
export function orbitalPeriod(sma: number): number {
  return 2 * Math.PI * Math.sqrt(sma * sma * sma / MU_EARTH);
}

/**
 * Hohmann transfer delta-V
 * Returns [dv1, dv2] for inner→outer transfer
 */
export function hohmannDeltaV(r1: number, r2: number): [number, number] {
  const v1 = circularVelocity(r1);
  const vTransfer1 = Math.sqrt(MU_EARTH * (2 / r1 - 2 / (r1 + r2)));
  const vTransfer2 = Math.sqrt(MU_EARTH * (2 / r2 - 2 / (r1 + r2)));
  const v2 = circularVelocity(r2);
  return [vTransfer1 - v1, v2 - vTransfer2];
}
