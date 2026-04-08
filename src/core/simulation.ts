/**
 * Orbital Mechanics — Simulation Engine
 *
 * Manages the rendezvous & docking simulation:
 * 1. Phasing: Hohmann transfer to match target orbit
 * 2. Approach: V-bar or R-bar approach to close range
 * 3. Proximity: Station-keeping and alignment
 * 4. Final approach: Slow closure to docking
 */

import type { SpacecraftState, RelativeState, MissionPhase, Vec3 } from './types';
import { G0 } from './constants';
import { propagateOrbit, elementsToState, computeRelativeState } from './kepler';

/** Apply a delta-V to a spacecraft in LVLH frame */
export function applyDeltaV(
  spacecraft: SpacecraftState,
  target: SpacecraftState,
  dvLVLH: Vec3,
): SpacecraftState {
  // Convert LVLH delta-V to ECI
  const tState = elementsToState(target.elements);
  const r = tState.position;
  const v = tState.velocity;
  const rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);

  const rHat: Vec3 = { x: r.x / rMag, y: r.y / rMag, z: r.z / rMag };
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const hHat: Vec3 = { x: hx / hMag, y: hy / hMag, z: hz / hMag };
  const vHat: Vec3 = {
    x: hHat.y * rHat.z - hHat.z * rHat.y,
    y: hHat.z * rHat.x - hHat.x * rHat.z,
    z: hHat.x * rHat.y - hHat.y * rHat.x,
  };

  // ECI delta-V
  const dvECI: Vec3 = {
    x: dvLVLH.x * vHat.x + dvLVLH.y * rHat.x + dvLVLH.z * hHat.x,
    y: dvLVLH.x * vHat.y + dvLVLH.y * rHat.y + dvLVLH.z * hHat.y,
    z: dvLVLH.x * vHat.z + dvLVLH.y * rHat.z + dvLVLH.z * hHat.z,
  };

  // Apply to chaser velocity
  const cState = elementsToState(spacecraft.elements);
  const newVel: Vec3 = {
    x: cState.velocity.x + dvECI.x,
    y: cState.velocity.y + dvECI.y,
    z: cState.velocity.z + dvECI.z,
  };

  // Fuel consumption: Tsiolkovsky equation
  const dvMag = Math.sqrt(dvLVLH.x ** 2 + dvLVLH.y ** 2 + dvLVLH.z ** 2);
  const massFlow = spacecraft.mass * (1 - Math.exp(-dvMag / (spacecraft.isp * G0)));
  const newFuel = Math.max(0, spacecraft.fuel - massFlow);
  const newMass = spacecraft.mass - (spacecraft.fuel - newFuel);

  // Convert back to orbital elements (simplified: update state vector)
  const newState = { position: cState.position, velocity: newVel };

  return {
    ...spacecraft,
    state: newState,
    fuel: newFuel,
    mass: newMass,
    // Note: elements should be recomputed from state vector
    // For now, propagation uses state directly
  };
}

/** Compute CW (Clohessy-Wiltshire) predicted trajectory for relative motion */
export function cwPredict(
  relState: RelativeState,
  n: number, // mean motion of target orbit [rad/s]
  dt: number,
): Vec3 {
  // CW equations (linearized relative motion around circular orbit)
  const { position: r, velocity: v } = relState;
  const nt = n * dt;
  const snt = Math.sin(nt);
  const cnt = Math.cos(nt);

  // Predicted relative position
  return {
    x: (4 - 3 * cnt) * r.x + snt / n * v.x + 2 / n * (1 - cnt) * v.y,
    y: 6 * (snt - nt) * r.x + r.y + 2 / n * (cnt - 1) * v.x + (4 * snt - 3 * nt) / n * v.y,
    z: r.z * cnt + v.z / n * snt,
  };
}

/** Step simulation forward */
export function stepSimulation(
  target: SpacecraftState,
  chaser: SpacecraftState,
  dt: number,
): { target: SpacecraftState; chaser: SpacecraftState; relative: RelativeState; phase: MissionPhase } {
  // Propagate orbits
  const newTargetElems = propagateOrbit(target.elements, dt);
  const newChaserElems = propagateOrbit(chaser.elements, dt);

  const newTarget: SpacecraftState = {
    ...target,
    elements: newTargetElems,
    state: elementsToState(newTargetElems),
  };

  const newChaser: SpacecraftState = {
    ...chaser,
    elements: newChaserElems,
    state: elementsToState(newChaserElems),
  };

  // Compute relative state
  const rel = computeRelativeState(newTarget.state, newChaser.state);
  const range = Math.sqrt(rel.position.x ** 2 + rel.position.y ** 2 + rel.position.z ** 2);
  const rangeRate = (rel.position.x * rel.velocity.x + rel.position.y * rel.velocity.y + rel.position.z * rel.velocity.z) / Math.max(range, 0.01);

  const relative: RelativeState = {
    ...rel,
    range,
    rangeRate,
  };

  // Phase determination
  let phase: MissionPhase;
  if (range < 2) {
    const speed = Math.sqrt(rel.velocity.x ** 2 + rel.velocity.y ** 2 + rel.velocity.z ** 2);
    phase = speed < 0.5 ? 'docked' : 'collision';
  } else if (range < 10) {
    phase = 'final-approach';
  } else if (range < 100) {
    phase = 'proximity';
  } else if (range < 5000) {
    phase = 'approach';
  } else {
    phase = 'phasing';
  }

  return { target: newTarget, chaser: newChaser, relative, phase };
}
