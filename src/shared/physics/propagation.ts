// 共通物理 — 2体問題の数値積分器 (Integrator Strategy)
//
// どの関数も r' = v, v' = -mu/r^3 * r を単一ステップ dt で進める。
// 呼び出し側で累積ループを組む。

import type { Vec3 } from './vectors';
import { vAdd, vLength, vScale } from './vectors';

export interface PropagationResult {
  r: Vec3;
  v: Vec3;
}

export type PropagatorFn = (
  r: Vec3,
  v: Vec3,
  mu: number,
  dt: number,
) => PropagationResult;

/** 中心重力加速度 a = -mu/r^3 * r */
function gravityAccel(r: Vec3, mu: number): Vec3 {
  const rL = vLength(r);
  return vScale(r, -mu / (rL * rL * rL));
}

/**
 * Euler 法 (1次)
 * 高速だが精度低く発散しやすい。教育用・粗い目安用。
 */
export function propagateEuler(
  r: Vec3,
  v: Vec3,
  mu: number,
  dt: number,
): PropagationResult {
  const a = gravityAccel(r, mu);
  return {
    r: vAdd(r, vScale(v, dt)),
    v: vAdd(v, vScale(a, dt)),
  };
}

/**
 * Velocity Verlet 法 (2次, シンプレクティック)
 * エネルギー保存が Euler より良く、長期安定。
 */
export function propagateVerlet(
  r: Vec3,
  v: Vec3,
  mu: number,
  dt: number,
): PropagationResult {
  const a0 = gravityAccel(r, mu);
  const rNew = vAdd(r, vAdd(vScale(v, dt), vScale(a0, 0.5 * dt * dt)));
  const a1 = gravityAccel(rNew, mu);
  const vNew = vAdd(v, vScale(vAdd(a0, a1), 0.5 * dt));
  return { r: rNew, v: vNew };
}

/**
 * 古典 Runge-Kutta 4次 (RK4)
 * 2体問題で十分な精度。apollo 群の既存シグネチャと完全互換。
 */
export function propagateRK4(
  r: Vec3,
  v: Vec3,
  mu: number,
  dt: number,
): PropagationResult {
  const accel = (pos: Vec3): Vec3 => gravityAccel(pos, mu);

  const k1v = v;
  const k1a = accel(r);
  const k2v = vAdd(v, vScale(k1a, dt / 2));
  const k2a = accel(vAdd(r, vScale(k1v, dt / 2)));
  const k3v = vAdd(v, vScale(k2a, dt / 2));
  const k3a = accel(vAdd(r, vScale(k2v, dt / 2)));
  const k4v = vAdd(v, vScale(k3a, dt));
  const k4a = accel(vAdd(r, vScale(k3v, dt)));

  const rNew = vAdd(
    r,
    vScale(
      vAdd(vAdd(k1v, vScale(k2v, 2)), vAdd(vScale(k3v, 2), k4v)),
      dt / 6,
    ),
  );
  const vNew = vAdd(
    v,
    vScale(
      vAdd(vAdd(k1a, vScale(k2a, 2)), vAdd(vScale(k3a, 2), k4a)),
      dt / 6,
    ),
  );
  return { r: rNew, v: vNew };
}

/** Integrator 選択用レジストリ */
export const integrators: Record<'euler' | 'verlet' | 'rk4', PropagatorFn> = {
  euler: propagateEuler,
  verlet: propagateVerlet,
  rk4: propagateRK4,
};

/** 文字列名で積分器を選択 */
export function getPropagator(name: 'euler' | 'verlet' | 'rk4'): PropagatorFn {
  return integrators[name];
}
