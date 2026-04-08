/**
 * Shared Simulator Component — Telemetry Data Row
 *
 * Usage:
 *   import { TelemetryRow } from './shared/react-simulator/TelemetryRow';
 *   <TelemetryRow label="Thrust" value="1234.5" unit="N" />
 *   <TelemetryRow label="Tip Mach" value="0.92" warn warnText="Compressibility" />
 *   <TelemetryRow label="Efficiency" value="85.2" unit="%" highlight />
 *
 * CSS classes: .telemetry-row, .telemetry-label, .telemetry-value (from base.css)
 */

interface TelemetryRowProps {
  label: string;
  value: string;
  unit?: string;
  /** Red warning styling + indicator */
  warn?: boolean;
  /** Tooltip text for warning */
  warnText?: string;
  /** Orange highlight styling (e.g., for error/delta values) */
  highlight?: boolean;
}

export function TelemetryRow({ label, value, unit, warn = false, warnText, highlight = false }: TelemetryRowProps) {
  const style = warn
    ? { color: 'var(--accent-red)' }
    : highlight
      ? { color: 'var(--accent-orange)' }
      : undefined;

  return (
    <div className="telemetry-row">
      <span className="telemetry-label">{label}</span>
      <span className="telemetry-value" style={style}>
        {value}
        {unit && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>{unit}</span>}
        {warn && <span style={{ marginLeft: 4 }} title={warnText}>⚠</span>}
      </span>
    </div>
  );
}
