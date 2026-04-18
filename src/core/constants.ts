/**
 * Orbital Mechanics — Physical Constants
 *
 * 基本定数は `src/shared/physics/constants` から re-export。
 * orbital-mechanics 固有の定数・ヘルパーのみここに残す。
 */

export {
  MU_EARTH,
  R_EARTH,
  G0,
  DEG_TO_RAD,
  RAD_TO_DEG,
  circularVelocity,
  orbitalPeriod,
  hohmannDeltaV,
} from '../shared/physics/constants';

/** ISS orbital altitude [m] */
export const ISS_ALTITUDE = 408000;

/** LEO typical altitude [m] */
export const LEO_ALTITUDE = 400000;

/** Physics timestep [s] */
export const PHYSICS_DT = 1.0; // 1 second steps for orbital mechanics
