/**
 * Orbital Mechanics — Rendezvous & Docking Simulator
 *
 * Layout: Left (mission panel) | Center (3D orbital view) | Right (LVLH relative view)
 */

import { useSimulation } from './hooks/useSimulation';
import { Scene3D } from './components/Scene3D';
import { RelativeView } from './components/RelativeView';
import { MissionPanel } from './components/MissionPanel';
import { AIChat } from './shared/ai-chat/AIChat';

export default function App() {
  const sim = useSimulation();

  return (
    <div className="app-layout">
      <div className="panel-left">
        <MissionPanel
          target={sim.target}
          chaser={sim.chaser}
          relative={sim.relative}
          phase={sim.phase}
          result={sim.result}
          isRunning={sim.isRunning}
          speed={sim.speed}
          missionTime={sim.missionTime}
          pilotMode={sim.pilotMode}
          onPreset={sim.setPreset}
          onSpeed={sim.setSpeed}
          onPilotMode={sim.setPilotMode}
          onStart={sim.start}
          onReset={sim.reset}
        />
      </div>

      <div className="viewport-center">
        <Scene3D
          target={sim.target}
          chaser={sim.chaser}
          relative={sim.relative}
          phase={sim.phase}
        />
      </div>

      <div className="panel-right">
        <RelativeView
          relative={sim.relative}
          phase={sim.phase}
          history={sim.history}
          keepOutRadius={sim.preset.config.keepOutSphereRadius}
        />
      </div>

      <AIChat
        config={{
          apiUrl: '/api/chat',
          systemPrompt: `You are an orbital mechanics assistant for a rendezvous and docking simulator.
You help users understand orbital mechanics, relative motion, and docking procedures.

Key concepts:
- Kepler orbits: semi-major axis, eccentricity, inclination, RAAN, argument of periapsis
- Hohmann transfer: bi-elliptic orbit change between two circular orbits
- CW equations: Clohessy-Wiltshire linearized relative motion in LVLH frame
- V-bar approach: along velocity vector (used by Dragon, ATV)
- R-bar approach: along radial vector (used by Soyuz, Progress)
- LVLH frame: V-bar (velocity), R-bar (radial), H-bar (cross-track)
- Docking criteria: speed < 0.3 m/s, alignment < 5°
- Keep-out sphere: safety zone around target station

Answer concisely. Use proper units. Respond in the same language as the user.`,
          welcomeMessage: 'Welcome to Orbital Mechanics Simulator. I can help with rendezvous planning, orbital transfers, and docking procedures.',
        }}
        title="Orbit AI"
        subtitle="Orbital Mechanics"
        icon="🛰️"
        placeholder="Ask about orbits, rendezvous..."
        hints={[
          'What is a Hohmann transfer?',
          'Explain V-bar vs R-bar approach',
          'How do CW equations work?',
          'What is LVLH frame?',
        ]}
      />
    </div>
  );
}
