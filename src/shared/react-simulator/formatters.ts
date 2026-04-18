/**
 * Telemetry 値フォーマッター
 *
 * engine/motor/propeller 系シミュレータで共通に使われる数値整形ヘルパー。
 * NaN/Infinity は `---` にフォールバック、単位は自動スケール (W→kW→MW 等)。
 */

/**
 * 基本フォーマッター: `value.toFixed(decimals)` + NaN/Infinity ガード
 *
 * @param value    対象値
 * @param decimals 小数桁数 (デフォルト 2)
 * @param fallback 非有限値の表示 (デフォルト '---')
 */
export function fmt(value: number, decimals: number = 2, fallback: string = '---'): string {
  if (!Number.isFinite(value)) return fallback;
  return value.toFixed(decimals);
}

/**
 * 動力 [W] を自動スケール (W / kW / MW)
 */
export function formatPower(watts: number, decimals: number = 2): string {
  if (!Number.isFinite(watts)) return '---';
  const abs = Math.abs(watts);
  if (abs >= 1e6) return `${(watts / 1e6).toFixed(decimals)} MW`;
  if (abs >= 1000) return `${(watts / 1000).toFixed(decimals)} kW`;
  return `${watts.toFixed(decimals)} W`;
}

/**
 * 推力 [N] を自動スケール (N / kN / MN)
 */
export function formatThrust(newtons: number, decimals: number = 2): string {
  if (!Number.isFinite(newtons)) return '---';
  const abs = Math.abs(newtons);
  if (abs >= 1e6) return `${(newtons / 1e6).toFixed(decimals)} MN`;
  if (abs >= 1000) return `${(newtons / 1000).toFixed(decimals)} kN`;
  return `${newtons.toFixed(decimals)} N`;
}

/**
 * 圧力 [Pa] を自動スケール (Pa / kPa / MPa)
 */
export function formatPressure(pascals: number, decimals: number = 2): string {
  if (!Number.isFinite(pascals)) return '---';
  const abs = Math.abs(pascals);
  if (abs >= 1e6) return `${(pascals / 1e6).toFixed(decimals)} MPa`;
  if (abs >= 1000) return `${(pascals / 1000).toFixed(decimals)} kPa`;
  return `${pascals.toFixed(decimals)} Pa`;
}

/**
 * 温度 [K] を [°C] 表示に変換
 */
export function formatTemperatureC(kelvin: number, decimals: number = 1): string {
  if (!Number.isFinite(kelvin)) return '---';
  return `${(kelvin - 273.15).toFixed(decimals)} °C`;
}

/**
 * 温度 [K] をそのまま
 */
export function formatTemperatureK(kelvin: number, decimals: number = 1): string {
  if (!Number.isFinite(kelvin)) return '---';
  return `${kelvin.toFixed(decimals)} K`;
}

/**
 * 効率 (0-1) を百分率 % 表示に
 */
export function formatPercent(ratio: number, decimals: number = 1): string {
  if (!Number.isFinite(ratio)) return '---';
  return `${(ratio * 100).toFixed(decimals)} %`;
}

/**
 * 速度 [m/s] を自動スケール (m/s or km/h)
 * @param toKmh true なら km/h 表示
 */
export function formatVelocity(mps: number, toKmh: boolean = false, decimals: number = 1): string {
  if (!Number.isFinite(mps)) return '---';
  if (toKmh) return `${(mps * 3.6).toFixed(decimals)} km/h`;
  return `${mps.toFixed(decimals)} m/s`;
}

/**
 * トルク [N·m] を自動スケール (N·m / kN·m)
 */
export function formatTorque(nm: number, decimals: number = 2): string {
  if (!Number.isFinite(nm)) return '---';
  if (Math.abs(nm) >= 1000) return `${(nm / 1000).toFixed(decimals)} kN·m`;
  return `${nm.toFixed(decimals)} N·m`;
}

/**
 * 質量流量 [kg/s] を自動スケール (g/s / kg/s / t/h)
 */
export function formatMassFlow(kgPerSec: number, decimals: number = 2): string {
  if (!Number.isFinite(kgPerSec)) return '---';
  const abs = Math.abs(kgPerSec);
  if (abs < 0.001) return `${(kgPerSec * 1000).toFixed(decimals)} g/s`;
  if (abs > 10) return `${(kgPerSec * 3.6).toFixed(decimals)} t/h`;
  return `${kgPerSec.toFixed(decimals)} kg/s`;
}
