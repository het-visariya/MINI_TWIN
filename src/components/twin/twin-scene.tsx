"use client";

import { Float, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";

import { palette } from "@/lib/design/tokens";
import type { TwinState } from "@/lib/domain/types";

/**
 * Per-state shape of the twin. Energy and openness change; nothing here
 * expresses disappointment, and "stretched" is tighter rather than unhappy.
 */
const stateShape: Record<
  TwinState,
  { scale: number; distort: number; speed: number; shellOpacity: number }
> = {
  focused: { scale: 1.05, distort: 0.18, speed: 0.6, shellOpacity: 0.55 },
  balanced: { scale: 1, distort: 0.26, speed: 0.45, shellOpacity: 0.45 },
  stretched: { scale: 0.94, distort: 0.38, speed: 0.75, shellOpacity: 0.65 },
  resting: { scale: 0.88, distort: 0.14, speed: 0.22, shellOpacity: 0.3 },
};

function TwinCore({
  state,
  intensity,
  color,
  accent,
}: {
  state: TwinState;
  intensity: number;
  color: string;
  accent: string;
}) {
  const mesh = useRef<Mesh>(null);
  const shape = stateShape[state];

  useFrame((_, delta) => {
    if (!mesh.current) return;
    // One slow drift. Nothing spins for attention.
    mesh.current.rotation.y += delta * 0.12 * shape.speed;
    mesh.current.rotation.x += delta * 0.04 * shape.speed;
  });

  const shell = useMemo(() => {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Even-ish distribution on a sphere, so the shell never clumps.
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const radius = 1.55;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  return (
    <group scale={shape.scale}>
      <Float speed={shape.speed} rotationIntensity={0.15} floatIntensity={0.35}>
        <mesh ref={mesh}>
          <icosahedronGeometry args={[1, 24]} />
          <MeshDistortMaterial
            color={color}
            distort={shape.distort * (0.6 + intensity * 0.6)}
            speed={shape.speed * 1.4}
            roughness={0.32}
            metalness={0.15}
            emissive={accent}
            emissiveIntensity={0.18 + intensity * 0.22}
          />
        </mesh>
      </Float>

      <Points positions={shell} stride={3}>
        <PointMaterial
          transparent
          color={accent}
          size={0.022}
          sizeAttenuation
          depthWrite={false}
          opacity={shape.shellOpacity * (0.5 + intensity * 0.5)}
        />
      </Points>
    </group>
  );
}

export default function TwinScene({
  state,
  intensity,
  active,
}: {
  state: TwinState;
  intensity: number;
  /** When false the frame loop stops — offscreen, hidden tab, or paused. */
  active: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "light" ? palette.light : palette.dark;

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color={colors.primary} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color={colors.ai} />
      <TwinCore
        state={state}
        intensity={intensity}
        color={colors.primary}
        accent={colors.ai}
      />
    </Canvas>
  );
}
