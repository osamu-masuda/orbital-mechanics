/**
 * Relative View — LVLH frame showing chaser position relative to target
 *
 * SVG display: V-bar (horizontal) vs R-bar (vertical)
 * Target at center, chaser as moving dot
 * Keep-out sphere, approach corridor
 */


import type { RelativeState, MissionPhase, TimeSeriesPoint } from '../core/types';

interface RelativeViewProps {
  relative: RelativeState;
  phase: MissionPhase;
  history: TimeSeriesPoint[];
  keepOutRadius: number;
}

export function RelativeView({ relative, phase, history, keepOutRadius }: RelativeViewProps) {
  const vbW = 500;
  const vbH = 500;
  const center = vbW / 2;

  // Auto-scale based on range
  const maxRange = Math.max(relative.range * 1.5, 50);
  const scale = (vbW / 2 - 40) / maxRange;

  const toSvg = (vbar: number, rbar: number): [number, number] => [
    center + vbar * scale,
    center - rbar * scale, // R-bar positive = up
  ];

  const [chaserX, chaserY] = toSvg(relative.position.x, relative.position.y);

  // Trajectory trace
  const trajPath = history.length > 1
    ? history.map((p, i) => {
        const [sx, sy] = toSvg(p.relX, p.relY);
        return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      }).join(' ')
    : '';

  // Keep-out sphere
  const kosRadius = keepOutRadius * scale;

  // Grid
  const gridStep = maxRange > 500 ? 200 : maxRange > 100 ? 50 : maxRange > 20 ? 10 : 2;

  const phaseColors: Record<string, string> = {
    'phasing': '#3b82f6',
    'approach': '#f97316',
    'proximity': '#eab308',
    'final-approach': '#22c55e',
    'docked': '#22c55e',
    'collision': '#ef4444',
  };

  return (
    <div className="panel-section">
      <div className="panel-section-title">LVLH Relative View</div>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect width={vbW} height={vbH} fill="#060610" />

        {/* Grid */}
        {Array.from({ length: Math.floor(maxRange / gridStep) * 2 + 1 }, (_, i) => {
          const val = (i - Math.floor(maxRange / gridStep)) * gridStep;
          const [gx] = toSvg(val, 0);
          const [, gy] = toSvg(0, val);
          return (
            <g key={i}>
              <line x1={gx} y1={0} x2={gx} y2={vbH} stroke="#111128" strokeWidth="0.5" />
              <line x1={0} y1={gy} x2={vbW} y2={gy} stroke="#111128" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* Axes */}
        <line x1={0} y1={center} x2={vbW} y2={center} stroke="#333" strokeWidth="1" />
        <line x1={center} y1={0} x2={center} y2={vbH} stroke="#333" strokeWidth="1" />
        <text x={vbW - 5} y={center - 5} fontSize="10" fill="#555" textAnchor="end">V-bar →</text>
        <text x={center + 5} y={15} fontSize="10" fill="#555">↑ R-bar</text>

        {/* Keep-out sphere */}
        <circle cx={center} cy={center} r={kosRadius} fill="none" stroke="#ef444444" strokeWidth="1" strokeDasharray="4 4" />

        {/* Trajectory trace */}
        {trajPath && <path d={trajPath} fill="none" stroke="#3b82f680" strokeWidth="1" />}

        {/* Target (center) */}
        <rect x={center - 6} y={center - 4} width="12" height="8" rx="2" fill="#f97316" stroke="#fff" strokeWidth="0.5" />
        <text x={center} y={center + 18} fontSize="9" fill="#f97316" textAnchor="middle">TARGET</text>

        {/* Chaser */}
        <circle cx={chaserX} cy={chaserY} r="4" fill={phaseColors[phase] ?? '#22c55e'} stroke="#fff" strokeWidth="0.5" />

        {/* Range line */}
        <line x1={center} y1={center} x2={chaserX} y2={chaserY} stroke="#ffffff30" strokeWidth="0.5" strokeDasharray="2 2" />

        {/* Info */}
        <text x={10} y={vbH - 30} fontSize="11" fill="#888" fontFamily="monospace">
          Range: {relative.range.toFixed(1)}m
        </text>
        <text x={10} y={vbH - 15} fontSize="11" fill={relative.rangeRate < 0 ? '#22c55e' : '#ef4444'} fontFamily="monospace">
          Rate: {relative.rangeRate.toFixed(2)} m/s
        </text>
        <text x={vbW - 10} y={vbH - 15} fontSize="11" fill={phaseColors[phase] ?? '#888'} textAnchor="end" fontFamily="monospace">
          {phase.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
