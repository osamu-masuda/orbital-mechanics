/**
 * Orbital Mechanics — Kepler Equation Solver
 *
 * ベクトル演算・基本 Kepler ソルバは `shared/physics` を利用。
 * orbital-mechanics 固有の OrbitalElements シグネチャ (sma/ecc/inc/raan/argPe/trueAnomaly)
 * に合わせた薄ラッパを提供する。
 */

import type { OrbitalElements, StateVector, Vec3 } from './types';
import { MU_EARTH } from './constants';
import {
  solveKepler,
  eccentricToTrue,
  trueToEccentric,
  trueToMean,
} from '../shared/physics/kepler';
import {
  vCross,
  vDot,
  vLength,
  vNorm as vUnit,
  vSub,
} from '../shared/physics/vectors';

// shared/physics からそのまま再エクスポート (呼び出し側の互換維持)
export { solveKepler, eccentricToTrue, trueToEccentric, trueToMean };

/**
 * 軌道要素を dt 秒進める (平均運動 M を線形増加)
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
 * 古典軌道要素 → ECI 状態ベクトル
 * (physics.elementsToState を利用しつつ、orbital-mechanics の
 * フィールド名 sma/ecc/inc/argPe/trueAnomaly にマップする)
 */
export function elementsToState(elements: OrbitalElements): StateVector {
  const { sma, ecc, inc, raan, argPe, trueAnomaly: nu } = elements;

  const p = sma * (1 - ecc * ecc);
  const r = p / (1 + ecc * Math.cos(nu));
  const xPQW = r * Math.cos(nu);
  const yPQW = r * Math.sin(nu);

  const mu_p = Math.sqrt(MU_EARTH / p);
  const vxPQW = -mu_p * Math.sin(nu);
  const vyPQW = mu_p * (ecc + Math.cos(nu));

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
 * ECI 状態ベクトル → 古典軌道要素
 * (physics の vector ops を利用、orbital-mechanics 固有の返り値シグネチャに合わせる)
 */
export function stateToElements(state: StateVector): OrbitalElements {
  const { position: r, velocity: v } = state;
  const rMag = vLength(r);
  const vMag = vLength(v);

  // h = r × v (specific angular momentum)
  const h = vCross(r, v);
  const hMag = vLength(h);

  // Node vector n = k × h
  const n: Vec3 = { x: -h.y, y: h.x, z: 0 };
  const nMag = Math.sqrt(n.x * n.x + n.y * n.y);

  // Eccentricity vector e = (v × h)/μ - r̂
  const vxh = vCross(v, h);
  const rHat = vUnit(r);
  const eVec: Vec3 = {
    x: vxh.x / MU_EARTH - rHat.x,
    y: vxh.y / MU_EARTH - rHat.y,
    z: vxh.z / MU_EARTH - rHat.z,
  };
  // 参考: vSub は内部で再利用可能 (cross/dot を import しているため引き続き使える)
  void vSub;
  const ecc = vLength(eVec);

  // Semi-major axis from vis-viva
  const energy = (vMag * vMag) / 2 - MU_EARTH / rMag;
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
    const dot = vDot(n, eVec) / (nMag * ecc);
    argPe = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (eVec.z < 0) argPe = 2 * Math.PI - argPe;
  }

  // True anomaly
  let trueAnomaly = 0;
  if (ecc > 1e-10) {
    const dot = vDot(eVec, r) / (ecc * rMag);
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (vDot(r, v) < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  } else if (nMag > 1e-10) {
    // Circular orbit: use argument of latitude
    const dot = vDot(n, r) / (nMag * rMag);
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (r.z < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  }

  return { sma, ecc: Math.max(ecc, 1e-8), inc, raan, argPe, trueAnomaly };
}

/**
 * Compute relative state of chaser w.r.t. target in LVLH frame
 *
 * LVLH: x=V-bar, y=R-bar, z=H-bar
 */
export function computeRelativeState(
  target: StateVector,
  chaser: StateVector,
): { position: Vec3; velocity: Vec3 } {
  const r = target.position;
  const v = target.velocity;
  const rHat = vUnit(r);

  const h = vCross(r, v);
  const hHat = vUnit(h);

  const vHat: Vec3 = vCross(hHat, rHat);

  const dp = vSub(chaser.position, target.position);
  const dv = vSub(chaser.velocity, target.velocity);

  const relPos: Vec3 = {
    x: vDot(dp, vHat),   // V-bar
    y: vDot(dp, rHat),   // R-bar
    z: vDot(dp, hHat),   // H-bar
  };

  const relVel: Vec3 = {
    x: vDot(dv, vHat),
    y: vDot(dv, rHat),
    z: vDot(dv, hHat),
  };

  return { position: relPos, velocity: relVel };
}
