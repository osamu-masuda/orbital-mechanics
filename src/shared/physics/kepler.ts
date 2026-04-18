// 共通物理 — Kepler 軌道要素・状態ベクトル変換
// apollo 群の既存シグネチャ (a/e/i/raan/argp/nu) を採用

import type { Vec3 } from './vectors';
import { vCross, vDot, vLength, vScale, vSub, vec3 } from './vectors';

/**
 * 古典軌道要素 (6要素) + 派生量
 * フィールド名は apollo 群と一致
 */
export interface ClassicalElements {
  a: number;         // 軌道長半径 [m]
  e: number;         // 離心率
  i: number;         // 軌道傾斜角 [rad]
  raan: number;      // 昇交点赤経 [rad]
  argp: number;      // 近点引数 [rad]
  nu: number;        // 真近点角 [rad]
  apoapsis: number;  // 遠点距離 [m]
  periapsis: number; // 近点距離 [m]
  period: number;    // 周期 [s]
  energy: number;    // 比軌道エネルギー [J/kg]
}

/**
 * 状態ベクトル (位置・速度)
 * 慣性系を想定
 */
export interface StateVec {
  r: Vec3; // 位置 [m]
  v: Vec3; // 速度 [m/s]
}

/**
 * Kepler 方程式 M = E - e sin E の Newton-Raphson 解
 *
 * @param M 平均近点角 [rad]
 * @param e 離心率
 * @param maxIter 最大反復 (既定 20)
 * @param tol 収束判定 (既定 1e-12)
 * @returns 離心近点角 E [rad]
 */
export function solveKepler(
  M: number,
  e: number,
  maxIter: number = 20,
  tol: number = 1e-12,
): number {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < maxIter; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/** 離心近点角 → 真近点角 */
export function eccentricToTrue(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}

/** 真近点角 → 離心近点角 */
export function trueToEccentric(nu: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 - e) * Math.sin(nu / 2),
    Math.sqrt(1 + e) * Math.cos(nu / 2),
  );
}

/** 真近点角 → 平均近点角 */
export function trueToMean(nu: number, e: number): number {
  const E = trueToEccentric(nu, e);
  return E - e * Math.sin(E);
}

/**
 * 状態ベクトル (r, v) → 古典軌道要素
 *
 * apollo 群の既存シグネチャと完全互換:
 * - 引数順: (r, v, mu)
 * - 返り値は a/e/i/raan/argp/nu + apoapsis/periapsis/period/energy
 */
export function stateToElements(
  r: Vec3,
  v: Vec3,
  mu: number,
): ClassicalElements {
  const rMag = vLength(r);
  const vMag = vLength(v);
  const h = vCross(r, v);
  const hMag = vLength(h);
  const energy = (vMag * vMag) / 2 - mu / rMag;
  const a = -mu / (2 * energy);
  const eVec = vSub(
    vScale(vCross(v, h), 1 / mu),
    vScale(r, 1 / rMag),
  );
  const e = vLength(eVec);
  const i = Math.acos(h.z / hMag);
  const nVec = vec3(-h.y, h.x, 0);
  const nMag = vLength(nVec);
  const raan =
    nMag > 1e-9
      ? nVec.y >= 0
        ? Math.acos(nVec.x / nMag)
        : 2 * Math.PI - Math.acos(nVec.x / nMag)
      : 0;
  let argp = 0;
  if (e > 1e-9 && nMag > 1e-9) {
    argp = Math.acos(
      Math.max(-1, Math.min(1, vDot(nVec, eVec) / (nMag * e))),
    );
    if (eVec.z < 0) argp = 2 * Math.PI - argp;
  }
  let nu = 0;
  if (e > 1e-9) {
    nu = Math.acos(
      Math.max(-1, Math.min(1, vDot(eVec, r) / (e * rMag))),
    );
    if (vDot(r, v) < 0) nu = 2 * Math.PI - nu;
  }
  return {
    a,
    e,
    i,
    raan,
    argp,
    nu,
    apoapsis: a * (1 + e),
    periapsis: a * (1 - e),
    period: 2 * Math.PI * Math.sqrt(Math.pow(Math.abs(a), 3) / mu),
    energy,
  };
}

/**
 * 古典軌道要素 → 状態ベクトル (ECI)
 *
 * 入力: 6要素 (a/e/i/raan/argp/nu) + mu
 * 近点基準のペリフォーカル座標 → ECI への 3-1-3 回転。
 */
export function elementsToState(
  el: Pick<ClassicalElements, 'a' | 'e' | 'i' | 'raan' | 'argp' | 'nu'>,
  mu: number,
): StateVec {
  const { a, e, i, raan, argp, nu } = el;

  // 軌道パラメータ (半通径)
  const p = a * (1 - e * e);
  const rDist = p / (1 + e * Math.cos(nu));

  // ペリフォーカル (PQW) 座標
  const xPQW = rDist * Math.cos(nu);
  const yPQW = rDist * Math.sin(nu);

  const muOverP = Math.sqrt(mu / p);
  const vxPQW = -muOverP * Math.sin(nu);
  const vyPQW = muOverP * (e + Math.cos(nu));

  // 回転行列 PQW → ECI (3-1-3)
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cI = Math.cos(i);
  const sI = Math.sin(i);
  const cW = Math.cos(argp);
  const sW = Math.sin(argp);

  const r11 = cO * cW - sO * sW * cI;
  const r12 = -cO * sW - sO * cW * cI;
  const r21 = sO * cW + cO * sW * cI;
  const r22 = -sO * sW + cO * cW * cI;
  const r31 = sW * sI;
  const r32 = cW * sI;

  const r: Vec3 = {
    x: r11 * xPQW + r12 * yPQW,
    y: r21 * xPQW + r22 * yPQW,
    z: r31 * xPQW + r32 * yPQW,
  };
  const v: Vec3 = {
    x: r11 * vxPQW + r12 * vyPQW,
    y: r21 * vxPQW + r22 * vyPQW,
    z: r31 * vxPQW + r32 * vyPQW,
  };

  return { r, v };
}
