/**
 * Shared Simulator Component — Slider Input with Label & Value Display
 *
 * Usage:
 *   import { SliderControl } from './shared/react-simulator/SliderControl';
 *   <SliderControl label="RPM" value={rpm} min={0} max={10000} step={100} unit="RPM" onChange={setRpm} />
 *
 * CSS classes: .control-group, .control-label, .control-value (from base.css)
 */

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  /** Override auto-detected decimal places */
  decimals?: number;
  /** Display as integer (no decimals) */
  isInteger?: boolean;
}

export function SliderControl({
  label, value, min, max, step, unit, onChange, decimals, isInteger = false,
}: SliderControlProps) {
  const dec = isInteger ? 0 : (decimals ?? (step < 0.001 ? 4 : step < 0.01 ? 3 : step < 1 ? 2 : 1));
  const displayValue = isInteger ? value.toString() : value.toFixed(dec);

  return (
    <div className="control-group">
      <div className="control-label">
        {label}
        <span className="control-value" style={{ marginLeft: 8 }}>
          {displayValue} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = isInteger ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
          onChange(v);
        }}
      />
    </div>
  );
}
