/**
 * Orbital Mechanics — Kepler Equation Solver
 *
 * Converts between time and position on an elliptical orbit.
 * Uses Newton-Raphson iteration on Kepler's equation: M = E - e*sin(E)
 */

import type { OrbitalElements, StateVector, Vec3 } from './types';
import { MU_EARTH } from './constants';

/**
 * Solve Kepler's equation: M = E - e*sin(E)
 * Given mean anomaly M and eccentricity e, find eccentric anomaly E
 *
 * @param M - Mean anomaly [rad]
 * @param e - Eccentricity
 * @returns Eccentric anomaly E [rad]
 */
export function solveKepler(M: number, e: number): number {
  // Initial guess
  let E = M + e * Math.sin(M);

  // Newton-Raphson iteration
  for (let i = 0; i < 20; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }

  return E;
}

/**
 * Eccentric anomaly to true anomaly
 */
export function eccentricToTrue(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}

/**
 * True anomaly to eccentric anomaly
 */
export function trueToEccentric(nu: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 - e) * Math.sin(nu / 2),
    Math.sqrt(1 + e) * Math.cos(nu / 2),
  );
}

/**
 * Mean anomaly from true anomaly
 */
export function trueToMean(nu: number, e: number): number {
  const E = trueToEccentric(nu, e);
  return E - e * Math.sin(E);
}

/**
 * Propagate orbital elements forward by dt seconds
 */
export function propagateOrbit(elements: OrbitalElements, dt: number): OrbitalElements {
  const { sma, ecc } = elements;
  const n = Math.sqrt(MU_EARTH / (sma * sma * sma)); // mean motion [rad/s]
  const M0 = trueToMean(elements.trueAnomaly, ecc);
  const M = M0 + n * dt;
  const E = solveKepler(M % (2 * Math.PI), ecc);
  const nu = eccentricToTrue(E, ecc);

  return { ...elements, trueAnomaly: nu };
}

/**
 * Convert orbital elements to ECI state vector
 */
export function elementsToState(elements: OrbitalElements): StateVector {
  const { sma, ecc, inc, raan, argPe, trueAnomaly: nu } = elements;

  // Distance from focus
  const p = sma * (1 - ecc * ecc); // semi-latus rectum
  const r = p / (1 + ecc * Math.cos(nu));

  // Position in orbital plane (PQW frame)
  const xPQW = r * Math.cos(nu);
  const yPQW = r * Math.sin(nu);

  // Velocity in orbital plane
  const mu_p = Math.sqrt(MU_EARTH / p);
  const vxPQW = -mu_p * Math.sin(nu);
  const vyPQW = mu_p * (ecc + Math.cos(nu));

  // Rotation matrix PQW → ECI
  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const cosW = Math.cos(argPe);
  const sinW = Math.sin(argPe);

  const r11 = cosO * cosW - sinO * sinW * cosI;
  const r12 = -cosO * sinW - sinO * cosW * cosI;
  const r21 = sinO * cosW + cosO * sinW * cosI;
  const r22 = -sinO * sinW + cosO * cosW * cosI;
  const r31 = sinW * sinI;
  const r32 = cosW * sinI;

  const position: Vec3 = {
    x: r11 * xPQW + r12 * yPQW,
    y: r21 * xPQW + r22 * yPQW,
    z: r31 * xPQW + r32 * yPQW,
  };

  const velocity: Vec3 = {
    x: r11 * vxPQW + r12 * vyPQW,
    y: r21 * vxPQW + r22 * vyPQW,
    z: r31 * vxPQW + r32 * vyPQW,
  };

  return { position, velocity };
}

/**
 * Convert ECI state vector back to classical orbital elements
 */
export function stateToElements(state: StateVector): OrbitalElements {
  const { position: r, velocity: v } = state;
  const rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
  const vMag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  // Specific angular momentum h = r × v
  const h: Vec3 = {
    x: r.y * v.z - r.z * v.y,
    y: r.z * v.x - r.x * v.z,
    z: r.x * v.y - r.y * v.x,
  };
  const hMag = Math.sqrt(h.x * h.x + h.y * h.y + h.z * h.z);

  // Node vector n = k × h
  const n: Vec3 = { x: -h.y, y: h.x, z: 0 };
  const nMag = Math.sqrt(n.x * n.x + n.y * n.y);

  // Eccentricity vector e = (v × h)/μ - r̂
  const vxh: Vec3 = {
    x: v.y * h.z - v.z * h.y,
    y: v.z * h.x - v.x * h.z,
    z: v.x * h.y - v.y * h.x,
  };
  const eVec: Vec3 = {
    x: vxh.x / MU_EARTH - r.x / rMag,
    y: vxh.y / MU_EARTH - r.y / rMag,
    z: vxh.z / MU_EARTH - r.z / rMag,
  };
  const ecc = Math.sqrt(eVec.x * eVec.x + eVec.y * eVec.y + eVec.z * eVec.z);

  // Semi-major axis from vis-viva
  const energy = vMag * vMag / 2 - MU_EARTH / rMag;
  const sma = -MU_EARTH / (2 * energy);

  // Inclination
  const inc = Math.acos(Math.max(-1, Math.min(1, h.z / hMag)));

  // RAAN
  let raan = 0;
  if (nMag > 1e-10) {
    raan = Math.acos(Math.max(-1, Math.min(1, n.x / nMag)));
    if (n.y < 0) raan = 2 * Math.PI - raan;
  }

  // Argument of periapsis
  let argPe = 0;
  if (nMag > 1e-10 && ecc > 1e-10) {
    const dot = (n.x * eVec.x + n.y * eVec.y + n.z * eVec.z) / (nMag * ecc);
    argPe = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (eVec.z < 0) argPe = 2 * Math.PI - argPe;
  }

  // True anomaly
  let trueAnomaly = 0;
  if (ecc > 1e-10) {
    const dot = (eVec.x * r.x + eVec.y * r.y + eVec.z * r.z) / (ecc * rMag);
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, dot)));
    const rdotv = r.x * v.x + r.y * v.y + r.z * v.z;
    if (rdotv < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  } else {
    // Circular orbit: use argument of latitude
    if (nMag > 1e-10) {
      const dot = (n.x * r.x + n.y * r.y + n.z * r.z) / (nMag * rMag);
      trueAnomaly = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (r.z < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
    }
  }

  return { sma, ecc: Math.max(ecc, 1e-8), inc, raan, argPe, trueAnomaly };
}

/**
 * Compute relative state of chaser w.r.t. target in LVLH frame
 */
export function computeRelativeState(
  target: StateVector,
  chaser: StateVector,
): { position: Vec3; velocity: Vec3 } {
  // LVLH frame: x=V-bar (along velocity), y=R-bar (radial out), z=H-bar (cross-track)
  const r = target.position;
  const v = target.velocity;
  const rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);

  // Unit vectors
  const rHat: Vec3 = { x: r.x / rMag, y: r.y / rMag, z: r.z / rMag };

  // H = r × v (cross-track)
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const hHat: Vec3 = { x: hx / hMag, y: hy / hMag, z: hz / hMag };

  // V = H × R (velocity direction)
  const vHat: Vec3 = {
    x: hHat.y * rHat.z - hHat.z * rHat.y,
    y: hHat.z * rHat.x - hHat.x * rHat.z,
    z: hHat.x * rHat.y - hHat.y * rHat.x,
  };

  // Relative position in ECI
  const dp: Vec3 = {
    x: chaser.position.x - target.position.x,
    y: chaser.position.y - target.position.y,
    z: chaser.position.z - target.position.z,
  };

  // Relative velocity in ECI
  const dv: Vec3 = {
    x: chaser.velocity.x - target.velocity.x,
    y: chaser.velocity.y - target.velocity.y,
    z: chaser.velocity.z - target.velocity.z,
  };

  // Project onto LVLH
  const relPos: Vec3 = {
    x: dp.x * vHat.x + dp.y * vHat.y + dp.z * vHat.z,  // V-bar
    y: dp.x * rHat.x + dp.y * rHat.y + dp.z * rHat.z,   // R-bar
    z: dp.x * hHat.x + dp.y * hHat.y + dp.z * hHat.z,   // H-bar
  };

  const relVel: Vec3 = {
    x: dv.x * vHat.x + dv.y * vHat.y + dv.z * vHat.z,
    y: dv.x * rHat.x + dv.y * rHat.y + dv.z * rHat.z,
    z: dv.x * hHat.x + dv.y * hHat.y + dv.z * hHat.z,
  };

  return { position: relPos, velocity: relVel };
}
