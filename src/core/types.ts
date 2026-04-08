/**
 * Orbital Mechanics — Type Definitions
 *
 * Coordinate systems:
 * - ECI (Earth-Centered Inertial): x,y,z fixed to stars
 * - LVLH (Local Vertical Local Horizontal): relative frame at target
 *   x = V-bar (velocity direction), y = R-bar (radial/up), z = H-bar (cross-track)
 */

/** 3D vector */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Classical orbital elements (Keplerian) */
export interface OrbitalElements {
  sma: number;         // Semi-major axis [m]
  ecc: number;         // Eccentricity [0-1)
  inc: number;         // Inclination [rad]
  raan: number;        // Right Ascension of Ascending Node [rad]
  argPe: number;       // Argument of periapsis [rad]
  trueAnomaly: number; // True anomaly [rad]
}

/** State vector (position + velocity in ECI) */
export interface StateVector {
  position: Vec3;   // [m]
  velocity: Vec3;   // [m/s]
}

/** Spacecraft state */
export interface SpacecraftState {
  name: string;
  elements: OrbitalElements;
  state: StateVector;
  mass: number;          // [kg]
  fuel: number;          // [kg]
  thrust: number;        // [N] max thrust
  isp: number;           // [s] specific impulse
  dockingPort: Vec3;     // docking port offset in body frame [m]
}

/** Relative state (chaser relative to target in LVLH) */
export interface RelativeState {
  position: Vec3;   // [m] in LVLH
  velocity: Vec3;   // [m/s] in LVLH
  range: number;    // [m] distance
  rangeRate: number; // [m/s] closing rate (negative = closing)
}

/** Mission phase */
export type MissionPhase =
  | 'phasing'         // Far-range orbit adjustment
  | 'approach'        // Mid-range approach (V-bar or R-bar)
  | 'proximity'       // Close range (<100m)
  | 'final-approach'  // Last 10m, alignment
  | 'docked'          // Successfully docked
  | 'collision'       // Impact too fast
  | 'aborted';        // Mission aborted

/** Delta-V maneuver */
export interface Maneuver {
  time: number;     // [s] execution time
  deltaV: Vec3;     // [m/s] in LVLH or ECI
  frame: 'lvlh' | 'eci';
  label: string;
}

/** Mission configuration */
export interface MissionConfig {
  target: SpacecraftState;
  chaser: SpacecraftState;
  approachType: 'v-bar' | 'r-bar';
  dockingSpeed: number;        // [m/s] max safe docking speed
  dockingAlignment: number;    // [rad] max misalignment angle
  keepOutSphereRadius: number; // [m]
}

/** Mission preset */
export interface MissionPreset {
  id: string;
  name: string;
  description: string;
  config: MissionConfig;
}

/** Simulation mode */
export type SimMode = 'education' | 'engineering';

/** Pilot mode */
export type PilotMode = 'full-auto' | 'semi-auto' | 'manual';

/** Time-series data point */
export interface TimeSeriesPoint {
  time: number;
  range: number;
  rangeRate: number;
  relX: number;
  relY: number;
  relZ: number;
  fuel: number;
  phase: string;
}

/** Mission result */
export interface MissionResult {
  outcome: 'docked' | 'collision' | 'aborted' | 'fuel-out' | 'timeout';
  dockingSpeed: number;
  misalignment: number;
  fuelUsed: number;
  missionTime: number;
  maneuverCount: number;
  score: number;
}
