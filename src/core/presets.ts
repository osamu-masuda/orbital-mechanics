/**
 * Orbital Mechanics — Mission Presets
 *
 * Based on real spacecraft parameters:
 * - ISS orbit: ~408 km altitude, 51.6° inclination
 * - Soyuz/Dragon approach profiles
 */

import type { MissionPreset, SpacecraftState, OrbitalElements } from './types';
import { R_EARTH, ISS_ALTITUDE, MU_EARTH } from './constants';

function makeCircularOrbit(altitude: number, inc: number, raan: number, trueAnomaly: number): OrbitalElements {
  return {
    sma: R_EARTH + altitude,
    ecc: 0.0001, // near-circular
    inc,
    raan,
    argPe: 0,
    trueAnomaly,
  };
}

function makeTarget(altitude: number): SpacecraftState {
  const orbit = makeCircularOrbit(altitude, 0.9, 0, 0); // 51.6° inc
  return {
    name: 'Target (ISS)',
    elements: orbit,
    state: { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    mass: 420000,
    fuel: 0,
    thrust: 0,
    isp: 0,
    dockingPort: { x: 5, y: 0, z: 0 }, // forward port
  };
}

function makeChaser(altitude: number, phaseLag: number, name: string): SpacecraftState {
  const orbit = makeCircularOrbit(altitude, 0.9, 0, -phaseLag);
  return {
    name,
    elements: orbit,
    state: { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    mass: 12000,
    fuel: 1200,
    thrust: 4000,
    isp: 290,
    dockingPort: { x: -2, y: 0, z: 0 }, // aft port
  };
}

/**
 * ホーマン遷移の位相角を解析的に計算
 * 遷移中にターゲットが移動する角度を考慮し、到着時に一致する初期位相差を返す
 */
function hohmannPhaseLag(chaserAlt: number, targetAlt: number): number {
  const r1 = R_EARTH + chaserAlt;
  const r2 = R_EARTH + targetAlt;
  const aTransfer = (r1 + r2) / 2;
  const transferHalf = Math.PI * Math.sqrt(aTransfer ** 3 / MU_EARTH);
  const n2 = Math.sqrt(MU_EARTH / (r2 ** 3)); // ターゲット平均運動
  const targetAngle = n2 * transferHalf; // 遷移中にターゲットが進む角度
  return Math.PI - targetAngle; // 初期位相遅れ（正=チェーサーが後方）
}

export const PRESETS: MissionPreset[] = [
  {
    id: 'iss-close',
    name: 'ISS Close Approach (200m)',
    description: 'Start 200m behind ISS on V-bar. Final approach and docking.',
    config: {
      target: makeTarget(ISS_ALTITUDE),
      chaser: {
        ...makeChaser(ISS_ALTITUDE, 0.00003, 'Crew Dragon'),
        // Override: start very close
      },
      approachType: 'v-bar',
      dockingSpeed: 0.3,
      dockingAlignment: 5 * Math.PI / 180,
      keepOutSphereRadius: 200,
    },
  },
  {
    id: 'iss-1km',
    name: 'ISS Approach (1 km)',
    description: 'Start 1 km behind ISS. V-bar approach to docking.',
    config: {
      target: makeTarget(ISS_ALTITUDE),
      chaser: makeChaser(ISS_ALTITUDE, 0.00015, 'Crew Dragon'),
      approachType: 'v-bar',
      dockingSpeed: 0.3,
      dockingAlignment: 5 * Math.PI / 180,
      keepOutSphereRadius: 200,
    },
  },
  {
    id: 'iss-10km',
    name: 'ISS Rendezvous (10 km)',
    description: 'Start 10 km behind and 2 km below ISS. Full rendezvous sequence.',
    config: {
      target: makeTarget(ISS_ALTITUDE),
      chaser: makeChaser(ISS_ALTITUDE - 2000, 0.0015, 'Soyuz MS'),
      approachType: 'v-bar',
      dockingSpeed: 0.3,
      dockingAlignment: 5 * Math.PI / 180,
      keepOutSphereRadius: 200,
    },
  },
  {
    id: 'hohmann',
    name: 'Hohmann Transfer (50 km)',
    description: 'Start in lower orbit, 50 km below. Perform Hohmann transfer to match target.',
    config: {
      target: makeTarget(ISS_ALTITUDE),
      chaser: makeChaser(ISS_ALTITUDE - 50000, hohmannPhaseLag(ISS_ALTITUDE - 50000, ISS_ALTITUDE), 'Progress'),
      approachType: 'v-bar',
      dockingSpeed: 0.3,
      dockingAlignment: 5 * Math.PI / 180,
      keepOutSphereRadius: 200,
    },
  },
  {
    id: 'r-bar',
    name: 'R-bar Approach (below)',
    description: 'Approach ISS from below (R-bar). Used by Progress/Soyuz.',
    config: {
      target: makeTarget(ISS_ALTITUDE),
      chaser: makeChaser(ISS_ALTITUDE - 500, 0.00005, 'Soyuz MS'),
      approachType: 'r-bar',
      dockingSpeed: 0.3,
      dockingAlignment: 5 * Math.PI / 180,
      keepOutSphereRadius: 200,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0]!;

export const REFERENCES = [
  { title: 'NASA: Rendezvous & Proximity Operations', url: 'https://www.nasa.gov/mission_pages/station/structure/elements/rendezvous.html' },
  { title: 'ESA: ATV Rendezvous & Docking', url: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/ATV' },
  { title: 'Clohessy-Wiltshire Equations', url: 'https://en.wikipedia.org/wiki/Clohessy%E2%80%93Wiltshire_equations' },
  { title: 'Orbital Mechanics for Engineering Students', url: 'https://orbital-mechanics.space/' },
];
