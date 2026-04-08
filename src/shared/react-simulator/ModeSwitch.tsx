/**
 * Shared Simulator Component — Education / Engineering Mode Toggle
 *
 * Usage:
 *   import { ModeSwitch } from './shared/react-simulator/ModeSwitch';
 *   <ModeSwitch mode={mode} setMode={setMode} />
 *
 * Requires SimMode = 'education' | 'engineering' in project's core/types.ts
 * CSS classes: .mode-switch, .mode-switch-btn, .active (from base.css)
 */

interface ModeSwitchProps {
  mode: 'education' | 'engineering';
  setMode: (mode: 'education' | 'engineering') => void;
}

export function ModeSwitch({ mode, setMode }: ModeSwitchProps) {
  return (
    <div className="mode-switch">
      <button
        className={`mode-switch-btn ${mode === 'education' ? 'active' : ''}`}
        onClick={() => setMode('education')}
      >
        Education
      </button>
      <button
        className={`mode-switch-btn ${mode === 'engineering' ? 'active' : ''}`}
        onClick={() => setMode('engineering')}
      >
        Engineering
      </button>
    </div>
  );
}
