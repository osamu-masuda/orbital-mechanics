/**
 * 3D Scene — Orbital view with Earth, target, and chaser spacecraft
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { SpacecraftState, RelativeState, MissionPhase } from '../core/types';
import { R_EARTH } from '../core/constants';

interface Scene3DProps {
  target: SpacecraftState;
  chaser: SpacecraftState;
  relative: RelativeState;
  phase: MissionPhase;
}

const SCALE = 1e-6;

function Earth() {
  return (
    <mesh>
      <sphereGeometry args={[R_EARTH * SCALE, 32, 32]} />
      <meshStandardMaterial color="#2563eb" roughness={0.8} />
    </mesh>
  );
}

function Spacecraft({ state, color, label }: { state: SpacecraftState; color: string; label: string }) {
  const pos = state.state.position;
  return (
    <group position={[pos.x * SCALE, pos.z * SCALE, pos.y * SCALE]}>
      <mesh>
        <boxGeometry args={[0.02, 0.02, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, 0.04, 0]} style={{ fontSize: 10, color, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        {label}
      </Html>
    </group>
  );
}

function SceneContent({ target, chaser }: { target: SpacecraftState; chaser: SpacecraftState }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1.0} />
      <Earth />
      <Spacecraft state={target} color="#f97316" label={target.name} />
      <Spacecraft state={chaser} color="#22c55e" label={chaser.name} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
    </>
  );
}

export function Scene3D({ target, chaser }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 50, near: 0.001, far: 100 }}
      gl={{ antialias: true }}
      style={{ background: '#050510' }}
    >
      <SceneContent target={target} chaser={chaser} />
    </Canvas>
  );
}
