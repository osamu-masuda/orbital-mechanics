/**
 * Mission Panel — Controls, telemetry, and mission status
 */

import type { SpacecraftState, RelativeState, MissionPhase, MissionResult, PilotMode } from '../core/types';
import { PRESETS, REFERENCES } from '../core/presets';

import { SliderControl } from '../shared/react-simulator/SliderControl';
import { TelemetryRow } from '../shared/react-simulator/TelemetryRow';
import { TelemetryDivider } from '../shared/react-simulator/TelemetryDivider';

interface MissionPanelProps {
  target: SpacecraftState;
  chaser: SpacecraftState;
  relative: RelativeState;
  phase: MissionPhase;
  result: MissionResult | null;
  isRunning: boolean;
  speed: number;
  missionTime: number;
  pilotMode: PilotMode;
  onPreset: (id: string) => void;
  onSpeed: (s: number) => void;
  onPilotMode: (m: PilotMode) => void;
  onStart: () => void;
  onReset: () => void;
}

function fmt(v: number, d = 1): string { return v.toFixed(d); }

export function MissionPanel(props: MissionPanelProps) {
  const { chaser, relative, phase, result, isRunning, speed, missionTime } = props;

  return (
    <div className="mission-panel">
      {/* Mission Select */}
      <div className="panel-section">
        <div className="panel-section-title">Mission</div>
        <div className="control-group">
          <select onChange={e => { if (e.target.value) props.onPreset(e.target.value); }} defaultValue="">
            <option value="" disabled>Select Mission...</option>
            {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn" onClick={props.onStart} disabled={isRunning} style={{ flex: 1 }}>
            {isRunning ? 'Running...' : 'Start'}
          </button>
          <button className="btn" onClick={props.onReset} style={{ flex: 1 }}>Reset</button>
        </div>
        <SliderControl label="Speed" value={speed} min={1} max={100} step={1} unit="x" onChange={props.onSpeed} />
      </div>

      {/* Relative State */}
      <div className="panel-section">
        <div className="panel-section-title">Relative State</div>
        <TelemetryRow label="Range" value={fmt(relative.range)} unit="m" />
        <TelemetryRow label="Range Rate" value={fmt(relative.rangeRate, 2)} unit="m/s"
          warn={relative.rangeRate > 0.5 && relative.range < 100}
          highlight={relative.rangeRate < 0} />
        <TelemetryDivider />
        <TelemetryRow label="V-bar (x)" value={fmt(relative.position.x)} unit="m" />
        <TelemetryRow label="R-bar (y)" value={fmt(relative.position.y)} unit="m" />
        <TelemetryRow label="H-bar (z)" value={fmt(relative.position.z)} unit="m" />
        <TelemetryDivider />
        <TelemetryRow label="Phase" value={phase.toUpperCase()} highlight />
        <TelemetryRow label="MET" value={`T+${fmt(missionTime, 0)}s`} />
        <TelemetryRow label="Fuel" value={fmt(chaser.fuel, 0)} unit="kg" />
      </div>

      {/* Result */}
      {result && (
        <div className={`panel-section ${result.outcome === 'docked' ? 'result-success' : 'result-failure'}`}>
          <div className="panel-section-title">
            {result.outcome === 'docked' ? 'DOCKING SUCCESSFUL' : 'MISSION FAILED'}
          </div>
          <TelemetryRow label="Docking Speed" value={fmt(result.dockingSpeed, 2)} unit="m/s" />
          <TelemetryRow label="Fuel Used" value={fmt(result.fuelUsed, 0)} unit="kg" />
          <TelemetryRow label="Mission Time" value={`${fmt(result.missionTime, 0)}s`} />
          <TelemetryRow label="Score" value={`${result.score}/100`} highlight />
        </div>
      )}

      {/* References */}
      <div className="panel-section">
        <div className="panel-section-title">References</div>
        <div className="references-list">
          {REFERENCES.map((ref, i) => (
            <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="ref-link">
              {ref.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
