/**
 * Orbital Mechanics — Simulation Hook
 *
 * Manages orbital propagation, relative motion, and mission phases.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SpacecraftState, RelativeState, MissionPhase, MissionPreset, MissionResult, TimeSeriesPoint, PilotMode, Vec3 } from '../core/types';
import { PHYSICS_DT } from '../core/constants';
import { elementsToState } from '../core/kepler';
import { stepSimulation } from '../core/simulation';
import { PRESETS, DEFAULT_PRESET } from '../core/presets';

const HISTORY_MAX = 600;

export interface UseSimulationReturn {
  target: SpacecraftState;
  chaser: SpacecraftState;
  relative: RelativeState;
  phase: MissionPhase;
  result: MissionResult | null;
  history: TimeSeriesPoint[];
  isRunning: boolean;
  speed: number;
  missionTime: number;
  preset: MissionPreset;
  pilotMode: PilotMode;
  setPreset: (id: string) => void;
  setSpeed: (s: number) => void;
  setPilotMode: (m: PilotMode) => void;
  start: () => void;
  reset: () => void;
  applyManeuver: (dv: Vec3) => void;
}

export function useSimulation(): UseSimulationReturn {
  const [preset, setPresetState] = useState<MissionPreset>(DEFAULT_PRESET);
  const [pilotMode, setPilotMode] = useState<PilotMode>('semi-auto');
  const [speed, setSpeed] = useState(10.0);
  const [isRunning, setIsRunning] = useState(false);
  const [missionTime, setMissionTime] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);

  // Initialize spacecraft with state vectors
  const initSpacecraft = useCallback((p: MissionPreset) => {
    const t = { ...p.config.target, state: elementsToState(p.config.target.elements) };
    const c = { ...p.config.chaser, state: elementsToState(p.config.chaser.elements) };
    return { target: t, chaser: c };
  }, []);

  const [{ target, chaser }, setSpacecraft] = useState(() => initSpacecraft(preset));

  const [relative, setRelative] = useState<RelativeState>({
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    range: 0,
    rangeRate: 0,
  });
  const [phase, setPhase] = useState<MissionPhase>('phasing');

  // Refs for RAF loop
  const targetRef = useRef(target);
  const chaserRef = useRef(chaser);
  const timeRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const historyRef = useRef<TimeSeriesPoint[]>([]);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const accumRef = useRef(0);

  const tick = useCallback((timestamp: number) => {
    if (lastRef.current === 0) lastRef.current = timestamp;
    const elapsed = (timestamp - lastRef.current) / 1000;
    lastRef.current = timestamp;
    accumRef.current += elapsed * speedRef.current;

    while (accumRef.current >= PHYSICS_DT) {
      const { target: newT, chaser: newC, relative: newR, phase: newP } =
        stepSimulation(targetRef.current, chaserRef.current, PHYSICS_DT);

      targetRef.current = newT;
      chaserRef.current = newC;
      timeRef.current += PHYSICS_DT;
      accumRef.current -= PHYSICS_DT;

      // Check mission end
      if (newP === 'docked' || newP === 'collision') {
        setRelative(newR);
        setPhase(newP);
        setSpacecraft({ target: newT, chaser: newC });
        setMissionTime(timeRef.current);
        setResult({
          outcome: newP,
          dockingSpeed: Math.sqrt(newR.velocity.x ** 2 + newR.velocity.y ** 2 + newR.velocity.z ** 2),
          misalignment: 0,
          fuelUsed: preset.config.chaser.fuel - newC.fuel,
          missionTime: timeRef.current,
          maneuverCount: 0,
          score: newP === 'docked' ? 90 : 0,
        });
        setIsRunning(false);
        cancelAnimationFrame(rafRef.current);
        return;
      }

      // Sample history
      if (Math.floor(timeRef.current) % 5 === 0) {
        const buf = historyRef.current;
        if (buf.length < HISTORY_MAX) {
          buf.push({
            time: timeRef.current,
            range: newR.range,
            rangeRate: newR.rangeRate,
            relX: newR.position.x,
            relY: newR.position.y,
            relZ: newR.position.z,
            fuel: newC.fuel,
            phase: newP,
          });
        }
      }

      setRelative(newR);
      setPhase(newP);
    }

    setSpacecraft({ target: targetRef.current, chaser: chaserRef.current });
    setMissionTime(timeRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [preset]);

  const start = useCallback(() => {
    if (isRunning) return;
    setResult(null);
    setIsRunning(true);
    lastRef.current = 0;
    accumRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [isRunning, tick]);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const sc = initSpacecraft(preset);
    targetRef.current = sc.target;
    chaserRef.current = sc.chaser;
    setSpacecraft(sc);
    timeRef.current = 0;
    setMissionTime(0);
    setPhase('phasing');
    setResult(null);
    setIsRunning(false);
    historyRef.current = [];
  }, [preset, initSpacecraft]);

  const setPreset = useCallback((id: string) => {
    const p = PRESETS.find(pr => pr.id === id);
    if (!p) return;
    cancelAnimationFrame(rafRef.current);
    setPresetState(p);
    const sc = initSpacecraft(p);
    targetRef.current = sc.target;
    chaserRef.current = sc.chaser;
    setSpacecraft(sc);
    timeRef.current = 0;
    setMissionTime(0);
    setPhase('phasing');
    setResult(null);
    setIsRunning(false);
    historyRef.current = [];
  }, [initSpacecraft]);

  const applyManeuver = useCallback((_dv: Vec3) => {
    // TODO: apply delta-V to chaser
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return {
    target, chaser, relative, phase, result,
    history: historyRef.current.slice(),
    isRunning, speed, missionTime, preset, pilotMode,
    setPreset, setSpeed, setPilotMode, start, reset, applyManeuver,
  };
}
