// 共通物理 — Kepler ソルバ・軌道要素変換テスト

import { describe, expect, it } from 'vitest';
import { MU_EARTH, R_EARTH } from '../constants';
import {
  eccentricToTrue,
  elementsToState,
  solveKepler,
  stateToElements,
  trueToEccentric,
  trueToMean,
} from '../kepler';
import { vLength, vec3 } from '../vectors';

describe('solveKepler', () => {
  it('M=0, e=0 → E=0', () => {
    expect(solveKepler(0, 0)).toBeCloseTo(0, 12);
  });

  it('円軌道 (e=0) では E = M', () => {
    expect(solveKepler(1.5, 0)).toBeCloseTo(1.5, 12);
    expect(solveKepler(-0.7, 0)).toBeCloseTo(-0.7, 12);
  });

  it('楕円軌道の収束: M = E - e sin E を検証', () => {
    const e = 0.3;
    const M = 1.0;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 10);
  });

  it('高離心率 (e=0.9) でも収束', () => {
    const e = 0.9;
    const M = 0.5;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });
});

describe('anomaly 変換', () => {
  it('eccentric ↔ true は往復一致 (e=0.2)', () => {
    const e = 0.2;
    for (const nu of [0.1, 1.0, 2.5, -0.7]) {
      const E = trueToEccentric(nu, e);
      const back = eccentricToTrue(E, e);
      expect(back).toBeCloseTo(nu, 10);
    }
  });

  it('trueToMean は sin を使って整合 (e=0.1)', () => {
    const e = 0.1;
    const nu = 0.8;
    const M = trueToMean(nu, e);
    // solveKepler で戻せば元の E (= trueToEccentric) に一致
    const E = solveKepler(M, e);
    expect(E).toBeCloseTo(trueToEccentric(nu, e), 10);
  });
});

describe('stateToElements / elementsToState 往復', () => {
  it('円軌道 LEO 400km: e≈0, a≈R+400km', () => {
    const r = vec3(R_EARTH + 400e3, 0, 0);
    const vCirc = Math.sqrt(MU_EARTH / (R_EARTH + 400e3));
    const v = vec3(0, vCirc, 0);
    const el = stateToElements(r, v, MU_EARTH);
    expect(el.e).toBeLessThan(1e-6);
    expect(el.a).toBeCloseTo(R_EARTH + 400e3, 0);
  });

  it('楕円軌道: 往復で a/e が保存される', () => {
    const r = vec3(R_EARTH + 200e3, 0, 0);
    const vCirc = Math.sqrt(MU_EARTH / (R_EARTH + 200e3));
    const v = vec3(0, vCirc * 0.9, 0);
    const el1 = stateToElements(r, v, MU_EARTH);
    const { r: r2, v: v2 } = elementsToState(el1, MU_EARTH);
    const el2 = stateToElements(r2, v2, MU_EARTH);
    expect(el2.a).toBeCloseTo(el1.a, 0);
    expect(el2.e).toBeCloseTo(el1.e, 8);
  });

  it('傾斜軌道: i / raan が往復保存', () => {
    const el: Parameters<typeof elementsToState>[0] = {
      a: R_EARTH + 500e3,
      e: 0.01,
      i: 0.9,      // ~51.6°
      raan: 1.2,
      argp: 0.3,
      nu: 0.5,
    };
    const { r, v } = elementsToState(el, MU_EARTH);
    const back = stateToElements(r, v, MU_EARTH);
    expect(back.i).toBeCloseTo(el.i, 8);
    expect(back.raan).toBeCloseTo(el.raan, 6);
  });

  it('楕円軌道のエネルギーは負', () => {
    const r = vec3(R_EARTH + 200e3, 0, 0);
    const vCirc = Math.sqrt(MU_EARTH / (R_EARTH + 200e3));
    const v = vec3(0, vCirc * 0.95, 0);
    const el = stateToElements(r, v, MU_EARTH);
    expect(el.energy).toBeLessThan(0);
    expect(el.e).toBeGreaterThan(0);
    expect(el.e).toBeLessThan(1);
    // periapsis + apoapsis = 2a
    expect(el.periapsis + el.apoapsis).toBeCloseTo(2 * el.a, 0);
  });

  it('elementsToState で計算した位置の大きさ = r = p/(1+e cos nu)', () => {
    const el = {
      a: R_EARTH + 500e3,
      e: 0.1,
      i: 0.0,
      raan: 0.0,
      argp: 0.0,
      nu: Math.PI / 4,
    };
    const { r } = elementsToState(el, MU_EARTH);
    const p = el.a * (1 - el.e * el.e);
    const expected = p / (1 + el.e * Math.cos(el.nu));
    expect(vLength(r)).toBeCloseTo(expected, 0);
  });
});
