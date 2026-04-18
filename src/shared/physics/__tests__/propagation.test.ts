// 共通物理 — 伝播器テスト

import { describe, expect, it } from 'vitest';
import { MU_EARTH, R_EARTH } from '../constants';
import {
  getPropagator,
  propagateEuler,
  propagateRK4,
  propagateVerlet,
} from '../propagation';
import { vLength, vec3 } from '../vectors';

/** 円軌道 LEO 400km の初期条件 */
function leoInit() {
  const r = vec3(R_EARTH + 400e3, 0, 0);
  const vCirc = Math.sqrt(MU_EARTH / (R_EARTH + 400e3));
  const v = vec3(0, vCirc, 0);
  return { r, v, vCirc };
}

function energy(r: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, mu: number) {
  const rL = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
  const vL2 = v.x * v.x + v.y * v.y + v.z * v.z;
  return vL2 / 2 - mu / rL;
}

describe('propagation', () => {
  it('RK4: 60s 単一ステップでエネルギー保存 < 1e-6', () => {
    const { r, v } = leoInit();
    const e0 = energy(r, v, MU_EARTH);
    const { r: r1, v: v1 } = propagateRK4(r, v, MU_EARTH, 60);
    const e1 = energy(r1, v1, MU_EARTH);
    expect(Math.abs((e1 - e0) / e0)).toBeLessThan(1e-6);
  });

  it('Verlet: 円軌道を 1 周期積分後も半径がほぼ保存', () => {
    const { r, v } = leoInit();
    const radius = vLength(r);
    const period = 2 * Math.PI * Math.sqrt((radius * radius * radius) / MU_EARTH);
    const steps = 1000;
    const dt = period / steps;
    let rCur = r;
    let vCur = v;
    for (let i = 0; i < steps; i++) {
      const out = propagateVerlet(rCur, vCur, MU_EARTH, dt);
      rCur = out.r;
      vCur = out.v;
    }
    // 1 周期後に元の位置・半径の近くに戻る
    expect(Math.abs(vLength(rCur) - radius) / radius).toBeLessThan(1e-4);
  });

  it('Euler: 短時間では発散しないが RK4 より誤差大', () => {
    const { r, v } = leoInit();
    const e0 = energy(r, v, MU_EARTH);
    const { r: rE, v: vE } = propagateEuler(r, v, MU_EARTH, 1);
    const eE = energy(rE, vE, MU_EARTH);
    // 1秒 1ステップなら顕著な発散はしない
    expect(Math.abs((eE - e0) / e0)).toBeLessThan(1e-3);
  });

  it('getPropagator("rk4") === propagateRK4', () => {
    const prop = getPropagator('rk4');
    const { r, v } = leoInit();
    const a = prop(r, v, MU_EARTH, 10);
    const b = propagateRK4(r, v, MU_EARTH, 10);
    expect(a.r).toEqual(b.r);
    expect(a.v).toEqual(b.v);
  });
});
