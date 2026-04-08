/**
 * 3D Scene — Dual view: Orbit overview + Close-up rendezvous
 *
 * Top: small orbit overview (Earth + spacecraft positions)
 * Main: close-up view centered on target, showing chaser approach
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { SpacecraftState, RelativeState, MissionPhase } from '../core/types';

interface Scene3DProps {
  target: SpacecraftState;
  chaser: SpacecraftState;
  relative: RelativeState;
  phase: MissionPhase;
}

/** Close-up view: target at center, positions in meters */
function CloseView({ target, chaser, relative, phase }: Scene3DProps) {
  const range = relative.range;
  // Auto-scale: 1 unit = depends on range
  const viewScale = Math.max(range * 2, 20);

  // Chaser position relative to target (LVLH: x=V-bar, y=R-bar, z=H-bar)
  const cx = relative.position.x;
  const cy = relative.position.y;
  const cz = relative.position.z;

  // Normalize positions to viewScale
  const s = 10 / viewScale;

  return (
    <Canvas
      camera={{ position: [0, 5 / s, 15 / s], fov: 50, near: 0.01, far: 10000 }}
      gl={{ antialias: true }}
      style={{ background: '#050510' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />

      {/* Target spacecraft (center) */}
      <group position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[2, 1, 4]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.2} />
        </mesh>
        {/* Solar panels */}
        <mesh position={[0, 0, 6]}>
          <boxGeometry args={[8, 0.1, 3]} />
          <meshStandardMaterial color="#1e3a5f" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, -6]}>
          <boxGeometry args={[8, 0.1, 3]} />
          <meshStandardMaterial color="#1e3a5f" metalness={0.8} />
        </mesh>
        <Html position={[0, 3, 0]} style={{ fontSize: 11, color: '#f97316', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {target.name}
        </Html>
      </group>

      {/* Chaser spacecraft */}
      <group position={[cx * s, cy * s, cz * s]}>
        <mesh>
          <coneGeometry args={[0.8, 2.5, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
        </mesh>
        <Html position={[0, 2.5, 0]} style={{ fontSize: 11, color: '#22c55e', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {chaser.name} ({range.toFixed(0)}m)
        </Html>
      </group>

      {/* Range line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, cx * s, cy * s, cz * s]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </line>

      {/* V-bar axis (green dashed) */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-20 / s, 0, 0, 20 / s, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.15} />
      </line>

      {/* R-bar axis (orange) */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -10 / s, 0, 0, 10 / s, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f97316" transparent opacity={0.15} />
      </line>

      {/* Axis labels */}
      <Html position={[12 / s, 0, 0]} style={{ fontSize: 9, color: '#22c55e80', pointerEvents: 'none' }}>V-bar →</Html>
      <Html position={[0, 8 / s, 0]} style={{ fontSize: 9, color: '#f9731680', pointerEvents: 'none' }}>↑ R-bar</Html>

      {/* Phase indicator */}
      <Html position={[0, -5 / s, 0]} style={{ fontSize: 12, color: phase === 'docked' ? '#22c55e' : '#d4a020', pointerEvents: 'none', fontFamily: 'monospace' }}>
        {phase.toUpperCase()}
      </Html>

      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
    </Canvas>
  );
}

export function Scene3D(props: Scene3DProps) {
  return <CloseView {...props} />;
}
