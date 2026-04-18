// 共通物理 — 基本定数 (SI 単位)
// 値の出典: NASA standard reference / CODATA

/** 万有引力定数 [m^3 / (kg s^2)] */
export const G = 6.67430e-11;

/** 標準重力加速度 (比推力 Isp 計算用) [m/s^2] */
export const G0 = 9.80665;

// --- 天体質量 [kg] ---
export const M_EARTH = 5.9722e24;
export const M_MOON = 7.342e22;

// --- 天体半径 [m] ---
/** 地球赤道半径 [m] */
export const R_EARTH = 6378.137e3;
/** 月平均半径 [m] */
export const R_MOON = 1737.4e3;

// --- 標準重力パラメータ μ = GM [m^3/s^2] ---
// apollo 群と shared-physics で一貫させるため G * M から算出する
// （orbital-mechanics の旧値 3.986004418e14 とは ~5e6 の差あり）
export const MU_EARTH = G * M_EARTH;
export const MU_MOON = G * M_MOON;

/** 月の平均軌道半径 [m] */
export const EARTH_MOON_DIST = 384400e3;
/** 月の朔望周期 [s] */
export const MOON_ORBIT_PERIOD = 27.32 * 86400;

/** 地球の影響圏半径 (対太陽) [m] */
export const EARTH_SOI_RADIUS = 924000e3;
/** 月の影響圏半径 (対地球) [m] */
export const MOON_SOI_RADIUS = 66100e3;

// --- 表面重力 ---
/** 地球表面重力 [m/s^2] (= G0) */
export const EARTH_SURFACE_G = G0;
/** 月表面重力 [m/s^2] */
export const LUNAR_SURFACE_G = 1.625;
/** 火星表面重力 [m/s^2] (参考値) */
export const MARS_SURFACE_G = 3.721;

// --- 角度変換 ---
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

// --- ヘルパー ---

/** 半径 r における円軌道速度 [m/s] */
export function circularVelocity(radius: number, mu: number = MU_EARTH): number {
  return Math.sqrt(mu / radius);
}

/** 長半径 a の軌道周期 [s] */
export function orbitalPeriod(sma: number, mu: number = MU_EARTH): number {
  return 2 * Math.PI * Math.sqrt((sma * sma * sma) / mu);
}

/**
 * ホーマン遷移の ΔV 対 [dv1, dv2]
 * r1 → r2 の内→外遷移 (r1<r2 で減速より加速が大)
 */
export function hohmannDeltaV(
  r1: number,
  r2: number,
  mu: number = MU_EARTH,
): [number, number] {
  const v1 = circularVelocity(r1, mu);
  const vTransfer1 = Math.sqrt(mu * (2 / r1 - 2 / (r1 + r2)));
  const vTransfer2 = Math.sqrt(mu * (2 / r2 - 2 / (r1 + r2)));
  const v2 = circularVelocity(r2, mu);
  return [vTransfer1 - v1, v2 - vTransfer2];
}
