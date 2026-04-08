/**
 * Shared Simulator Component — Preset Dropdown Selector
 *
 * Usage:
 *   import { PresetSelector } from './shared/react-simulator/PresetSelector';
 *
 *   const presets = [
 *     { id: 'cessna', label: 'Cessna 172' },
 *     { id: 'drone', label: 'DJI Phantom' },
 *   ];
 *   <PresetSelector presets={presets} onSelect={(id) => applyPreset(id)} />
 *
 * CSS classes: .preset-selector select (from base.css)
 */

interface PresetOption {
  id: string;
  label: string;
}

interface PresetSelectorProps {
  presets: PresetOption[];
  onSelect: (id: string) => void;
  placeholder?: string;
}

export function PresetSelector({
  presets,
  onSelect,
  placeholder = 'Select Preset...',
}: PresetSelectorProps) {
  return (
    <div className="preset-selector">
      <select
        onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
        defaultValue=""
      >
        <option value="" disabled>{placeholder}</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}
