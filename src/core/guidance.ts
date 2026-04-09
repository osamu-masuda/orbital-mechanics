/**
 * Orbital Mechanics — Hohmann Transfer Autopilot
 *
 * ホーマン遷移の自動誘導:
 * 1. 第1バーン: 遷移軌道投入（プログレード ΔV1）
 * 2. コースト: 遷移軌道の半周期
 * 3. 第2バーン: 円形化（プログレード ΔV2）
 * 4. 接近誘導: V-bar 残差を小バーンで解消
 */

import type { SpacecraftState, RelativeState, Vec3 } from './types';
import { MU_EARTH, hohmannDeltaV } from './constants';
import { elementsToState, stateToElements } from './kepler';

export type GuidancePhase =
  | 'burn1'          // 第1バーン待ち
  | 'coast'          // 遷移軌道コースト中
  | 'burn2'          // 第2バーン待ち
  | 'closing'        // 接近誘導（残差解消）
  | 'complete';      // 誘導完了

export interface GuidanceState {
  phase: GuidancePhase;
  burn1Time: number;
  burn2Time: number;
  dv1: number;
  dv2: number;
  transferPeriodHalf: number;
  burn1Executed: boolean;
  burn2Executed: boolean;
  closingBurnTime: number;    // 接近バーン実行時刻
  closingRecircTime: number;  // 再円形化バーン時刻
  closingExecuted: boolean;
  recircExecuted: boolean;
}

/** 誘導状態を初期化（hohmann プリセット用） */
export function initGuidance(chaser: SpacecraftState, target: SpacecraftState): GuidanceState {
  const r1 = chaser.elements.sma;
  const r2 = target.elements.sma;

  const [dv1, dv2] = hohmannDeltaV(r1, r2);

  const aTransfer = (r1 + r2) / 2;
  const transferPeriodHalf = Math.PI * Math.sqrt(aTransfer ** 3 / MU_EARTH);

  return {
    phase: 'burn1',
    burn1Time: 0,
    burn2Time: transferPeriodHalf,
    dv1,
    dv2,
    transferPeriodHalf,
    burn1Executed: false,
    burn2Executed: false,
    closingBurnTime: 0,
    closingRecircTime: 0,
    closingExecuted: false,
    recircExecuted: false,
  };
}

/**
 * プログレード方向に ΔV を適用
 */
export function applyProgradeDeltaV(
  spacecraft: SpacecraftState,
  dvMagnitude: number,
): SpacecraftState {
  const state = elementsToState(spacecraft.elements);
  const vMag = Math.sqrt(
    state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2,
  );

  const vHat: Vec3 = {
    x: state.velocity.x / vMag,
    y: state.velocity.y / vMag,
    z: state.velocity.z / vMag,
  };

  const newVel: Vec3 = {
    x: state.velocity.x + dvMagnitude * vHat.x,
    y: state.velocity.y + dvMagnitude * vHat.y,
    z: state.velocity.z + dvMagnitude * vHat.z,
  };

  const absDv = Math.abs(dvMagnitude);
  const G0 = 9.80665;
  const massFlow = spacecraft.mass * (1 - Math.exp(-absDv / (spacecraft.isp * G0)));
  const newFuel = Math.max(0, spacecraft.fuel - massFlow);
  const newMass = spacecraft.mass - (spacecraft.fuel - newFuel);

  const newState = { position: state.position, velocity: newVel };
  const newElements = stateToElements(newState);

  return {
    ...spacecraft,
    elements: newElements,
    state: newState,
    fuel: newFuel,
    mass: newMass,
  };
}

/**
 * 接近バーンの ΔV を計算
 * V-bar 方向のオフセットを解消するため、一時的に軌道を下げて追いつく
 * CW 方程式に基づく: Δv_retro → 低軌道でドリフト → Δv_prograde で再円形化
 */
function computeClosingDeltaV(
  relativeRange: number,
  targetSma: number,
): { dv: number; driftTime: number } {
  // ターゲット軌道の平均運動
  const n = Math.sqrt(MU_EARTH / (targetSma ** 3));
  // 1周期で接近したい距離に基づくΔVを計算
  // CW近似: V-bar ドリフト率 = -3/2 * n * Δr (radial offset per orbit)
  // 軌道を少し下げて位相を稼ぐ:
  // drift_rate ≈ 3π * n * Δr (V-bar per orbit from radial offset Δr)
  // 必要なΔr = range / (3π) per orbit
  // ΔV ≈ n * Δr / 2 (小さなレトログレードバーン)
  const T = 2 * Math.PI / n;
  // 2周で追いつく設計
  const nOrbits = 2;
  const deltaR = relativeRange / (3 * Math.PI * nOrbits);
  const dv = n * deltaR / 2;
  return { dv, driftTime: T * nOrbits };
}

/**
 * 誘導ステップ
 */
export function guidanceStep(
  guidance: GuidanceState,
  chaser: SpacecraftState,
  missionTime: number,
  relative?: RelativeState,
): { guidance: GuidanceState; chaser: SpacecraftState } {
  const g = { ...guidance };
  let updatedChaser = chaser;

  switch (g.phase) {
    case 'burn1':
      if (!g.burn1Executed) {
        updatedChaser = applyProgradeDeltaV(chaser, g.dv1);
        g.burn1Executed = true;
        g.burn1Time = missionTime;
        g.burn2Time = missionTime + g.transferPeriodHalf;
        g.phase = 'coast';
      }
      break;

    case 'coast':
      if (missionTime >= g.burn2Time) {
        g.phase = 'burn2';
      }
      break;

    case 'burn2':
      if (!g.burn2Executed) {
        updatedChaser = applyProgradeDeltaV(chaser, g.dv2);
        g.burn2Executed = true;
        // 残距離が 5km 以上なら接近誘導を開始
        if (relative && relative.range > 5000) {
          const targetSma = chaser.elements.sma; // 円形化後は target と同じ sma
          const { dv, driftTime } = computeClosingDeltaV(relative.range, targetSma);
          g.closingBurnTime = missionTime;
          g.closingRecircTime = missionTime + driftTime;
          // レトログレードバーン（マイナス = 減速 → 軌道を下げる）
          updatedChaser = applyProgradeDeltaV(updatedChaser, -dv);
          g.closingExecuted = true;
          g.phase = 'closing';
        } else {
          g.phase = 'complete';
        }
      }
      break;

    case 'closing':
      // 再円形化タイミングに到達
      if (!g.recircExecuted && missionTime >= g.closingRecircTime) {
        // プログレードバーンで再円形化
        const targetSma = chaser.elements.sma;
        const range = relative ? relative.range : 5000;
        const { dv } = computeClosingDeltaV(range > 5000 ? range : 5000, targetSma);
        updatedChaser = applyProgradeDeltaV(chaser, dv);
        g.recircExecuted = true;
        g.phase = 'complete';
      }
      break;

    case 'complete':
      break;
  }

  return { guidance: g, chaser: updatedChaser };
}
