/**
 * SceneTheme — 3D シーンテーマ共通定義
 *
 * 4段階の背景明度 (Dark / Medium / Light / Studio) と
 * それに合わせたアンビエント・ディレクショナルライト強度、グリッド色を提供。
 * 背景はクール系スレートブルーで統一し、暖色系の金属パーツ（銅・真鍮）が
 * どの明度でも際立つようにしている。
 */

import { useState } from 'react';

export type ThemeId = 'dark' | 'medium' | 'light' | 'studio';

export interface SceneTheme {
  id: ThemeId;
  label: string;
  background: string;
  ambient: number;
  directional: number;
  gridMajor: string;
  gridMinor: string;
}

export const SCENE_THEMES: Record<ThemeId, SceneTheme> = {
  dark: {
    id: 'dark',
    label: 'Dark',
    background: '#0f1a24',
    ambient: 0.85,
    directional: 1.2,
    gridMajor: '#2a3a4a',
    gridMinor: '#1a2630',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    background: '#20323f',
    ambient: 1.0,
    directional: 1.35,
    gridMajor: '#3e5265',
    gridMinor: '#283642',
  },
  light: {
    id: 'light',
    label: 'Light',
    background: '#4a5a6a',
    ambient: 1.1,
    directional: 1.4,
    gridMajor: '#6a7a8a',
    gridMinor: '#55636f',
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    background: '#d6dce4',
    ambient: 1.2,
    directional: 1.5,
    gridMajor: '#8a9098',
    gridMinor: '#b0b6bc',
  },
};

/** Standard theme selector overlay for 3D viewports */
export function ThemeSelector({
  current,
  onChange,
}: {
  current: ThemeId;
  onChange: (t: ThemeId) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: 'rgba(15, 26, 36, 0.75)',
      borderRadius: 6,
      border: '1px solid rgba(59, 130, 246, 0.3)',
      backdropFilter: 'blur(4px)',
    }}>
      {(Object.keys(SCENE_THEMES) as ThemeId[]).map((id) => {
        const theme = SCENE_THEMES[id];
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={`Scene: ${theme.label}`}
            style={{
              padding: '4px 10px', fontSize: 11,
              fontWeight: active ? 700 : 500,
              color: active ? '#fff' : '#8aa0b8',
              background: active
                ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                : 'transparent',
              border: active
                ? '1px solid rgba(59, 130, 246, 0.8)'
                : '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 4, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {theme.label}
          </button>
        );
      })}
    </div>
  );
}

export function useSceneTheme(initial: ThemeId = 'medium') {
  const [themeId, setThemeId] = useState<ThemeId>(initial);
  return { themeId, setThemeId, theme: SCENE_THEMES[themeId] };
}
