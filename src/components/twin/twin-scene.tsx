"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { useMemo, useRef, useState } from "react";
import { AdditiveBlending, Color, type Points, type ShaderMaterial } from "three";

import {
  BAND_COUNT,
  STATE_TWEEN_SECONDS,
  buildTwinPoints,
  twinFragmentShader,
  twinShape,
  twinVertexShader,
} from "@/components/twin/twin-points";
import { palette } from "@/lib/design/tokens";
import type { TwinState } from "@/lib/domain/types";

const BASE_COUNT = 5200;

function TwinFigure({
  state,
  intensity,
  count,
  highlightBand,
  color,
  accentColor,
}: {
  state: TwinState;
  intensity: number;
  count: number;
  highlightBand: number;
  color: string;
  accentColor: string;
}) {
  const points = useRef<Points>(null);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => buildTwinPoints(count), [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpread: { value: twinShape[state].spread },
      uEdgePull: { value: twinShape[state].edgePull },
      uDrift: { value: twinShape[state].drift },
      uBreath: { value: twinShape[state].breath },
      uBreathHz: { value: twinShape[state].breathHz },
      uAccentShare: { value: twinShape[state].accentShare },
      uOpacity: { value: twinShape[state].opacity },
      uSize: { value: 2.1 },
      uHighlightBand: { value: -1 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(color) },
      uAccentColor: { value: new Color(accentColor) },
    }),
    // Built once; every value below is driven imperatively in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((frameState, delta) => {
    const material = points.current?.material as ShaderMaterial | undefined;
    if (!material) return;

    const target = twinShape[state];
    /* Uniforms tween rather than snap, so a state change is a transition the
       user can watch — 1.2s, per the design spec. */
    const k = Math.min(1, delta / STATE_TWEEN_SECONDS);
    const u = material.uniforms;

    u.uTime.value += delta;
    u.uSpread.value += (target.spread - u.uSpread.value) * k;
    u.uEdgePull.value += (target.edgePull - u.uEdgePull.value) * k;
    u.uDrift.value += (target.drift * (0.6 + intensity * 0.8) - u.uDrift.value) * k;
    u.uBreath.value += (target.breath - u.uBreath.value) * k;
    u.uBreathHz.value += (target.breathHz - u.uBreathHz.value) * k;
    u.uAccentShare.value += (target.accentShare - u.uAccentShare.value) * k;
    u.uOpacity.value += (target.opacity - u.uOpacity.value) * k;
    u.uHighlightBand.value = highlightBand;

    /* Theme and device pixel ratio are read here rather than in an effect:
       the uniform object belongs to the renderer, not to React's render. */
    u.uColor.value.set(color);
    u.uAccentColor.value.set(accentColor);
    u.uPixelRatio.value = Math.min(dpr, 1.75);

    /* Pointer parallax, capped at 4° so it never becomes a toy. */
    if (points.current) {
      const maxTilt = (4 * Math.PI) / 180;
      const { x, y } = frameState.pointer;
      points.current.rotation.y += (x * maxTilt - points.current.rotation.y) * 0.05;
      points.current.rotation.x += (-y * maxTilt - points.current.rotation.x) * 0.05;
    }
  });

  return (
    <points ref={points} key={count}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[geometry.position, 3]}
          count={geometry.count}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[geometry.seed, 1]}
          count={geometry.count}
        />
        <bufferAttribute
          attach="attributes-aBand"
          args={[geometry.band, 1]}
          count={geometry.count}
        />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={twinVertexShader}
        fragmentShader={twinFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export default function TwinScene({
  state,
  intensity,
  active,
  /** Twin Pulse ring index 0–4 to highlight, or -1 for none. */
  highlightBand = -1,
  onSelect,
}: {
  state: TwinState;
  intensity: number;
  /** When false the frame loop stops — offscreen, hidden tab, or paused. */
  active: boolean;
  highlightBand?: number;
  /** Clicking the twin summons Jarvis. */
  onSelect?: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "light" ? palette.light : palette.dark;

  /* PerformanceMonitor drops the particle count on slow devices rather than
     dropping frames. 5,200 → 3,200 → 1,800. */
  const [tier, setTier] = useState(0);
  const count = [BASE_COUNT, 3200, 1800][Math.min(tier, 2)];

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "demand"}
      camera={{ position: [0, 0, 3.4], fov: 42 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      onClick={onSelect}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <PerformanceMonitor
        onDecline={() => setTier((current) => Math.min(2, current + 1))}
      />
      <TwinFigure
        state={state}
        intensity={intensity}
        count={count}
        highlightBand={Math.min(highlightBand, BAND_COUNT - 1)}
        color={colors.particle}
        accentColor={colors.particleAccent}
      />
    </Canvas>
  );
}
