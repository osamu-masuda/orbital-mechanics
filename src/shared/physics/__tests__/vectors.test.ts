// 共通物理 — ベクトル演算テスト

import { describe, expect, it } from 'vitest';
import {
  vAdd,
  vCross,
  vDistance,
  vDot,
  vLength,
  vLengthSq,
  vLerp,
  vNorm,
  vScale,
  vSub,
  vec3,
} from '../vectors';

describe('vectors', () => {
  it('vLength (3,4,0) = 5', () => {
    expect(vLength(vec3(3, 4, 0))).toBeCloseTo(5, 10);
  });

  it('vLengthSq (3,4,0) = 25', () => {
    expect(vLengthSq(vec3(3, 4, 0))).toBe(25);
  });

  it('vAdd / vSub / vScale / vDot', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    expect(vAdd(a, b)).toEqual({ x: 5, y: 7, z: 9 });
    expect(vSub(b, a)).toEqual({ x: 3, y: 3, z: 3 });
    expect(vScale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(vDot(a, b)).toBe(32);
  });

  it('vCross: x × y = z (右手系)', () => {
    const z = vCross(vec3(1, 0, 0), vec3(0, 1, 0));
    expect(z.x).toBeCloseTo(0);
    expect(z.y).toBeCloseTo(0);
    expect(z.z).toBeCloseTo(1);
  });

  it('vNorm: 単位ベクトル生成', () => {
    expect(vLength(vNorm(vec3(3, 4, 0)))).toBeCloseTo(1, 10);
  });

  it('vNorm(0) は NaN にならない', () => {
    const n = vNorm(vec3(0, 0, 0));
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
    expect(Number.isFinite(n.z)).toBe(true);
  });

  it('vDistance', () => {
    expect(vDistance(vec3(1, 2, 3), vec3(4, 6, 3))).toBeCloseTo(5, 10);
  });

  it('vLerp: t=0 で a, t=1 で b, t=0.5 で中点', () => {
    const a = vec3(0, 0, 0);
    const b = vec3(10, 20, 30);
    expect(vLerp(a, b, 0)).toEqual(a);
    expect(vLerp(a, b, 1)).toEqual(b);
    expect(vLerp(a, b, 0.5)).toEqual({ x: 5, y: 10, z: 15 });
  });
});
