import type { TwinState } from "@/lib/domain/types";
import { PULSE_DOMAINS } from "@/lib/design/tokens";

/** Number of bands the figure is divided into — one per Twin Pulse score. */
export const BAND_COUNT = PULSE_DOMAINS.length;

/**
 * Point set for the twin figure.
 *
 * Today the points are sampled on a sphere. The shape is produced here and
 * nowhere else so that swapping in a GLB-sampled bust later (via three's
 * MeshSurfaceSampler) is a change to this one function: the shader, the state
 * mapping and the band logic all read the attributes rather than the source.
 */
export type TwinPointSet = {
  /** xyz, on a unit-ish surface. */
  position: Float32Array;
  /** Per-point seed, 0–1. Drives drift phase and which points are accent. */
  seed: Float32Array;
  /** Band index 0–4, bottom to top, matching PULSE_DOMAINS order. */
  band: Float32Array;
  count: number;
};

export function buildTwinPoints(count: number): TwinPointSet {
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const band = new Float32Array(count);

  const golden = Math.PI * (1 + Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    /* Fibonacci sphere: even coverage, no clumping at the poles. */
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = golden * (i + 0.5);

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;

    /* Deterministic per-point hash, so the figure is identical every mount. */
    seed[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

    band[i] = Math.min(BAND_COUNT - 1, Math.floor(((y + 1) / 2) * BAND_COUNT));
  }

  return { position, seed, band, count };
}

/**
 * How each state looks. Energy and openness change; nothing here expresses
 * disappointment, and "stretched" reads as the plan pulling on the user —
 * never as red, never as sad.
 */
export type TwinShape = {
  /** Radial scale. Below 1 the points draw in, above 1 they pull outward. */
  spread: number;
  /** How much the outer points are pulled past the rest. */
  edgePull: number;
  /** Drift speed multiplier. */
  drift: number;
  /** Breathing amplitude, as a fraction of scale. */
  breath: number;
  /** Breathing frequency in Hz. */
  breathHz: number;
  /** Share of points tinted with the accent, 0–1. */
  accentShare: number;
  opacity: number;
};

export const twinShape: Record<TwinState, TwinShape> = {
  focused: {
    spread: 0.92,
    edgePull: 0,
    drift: 0.2,
    breath: 0.01,
    breathHz: 0.2,
    accentShare: 0.12,
    opacity: 1,
  },
  balanced: {
    spread: 1,
    edgePull: 0.04,
    drift: 0.5,
    breath: 0.014,
    breathHz: 0.16,
    accentShare: 0.1,
    opacity: 0.95,
  },
  stretched: {
    spread: 1.06,
    edgePull: 0.22,
    drift: 1,
    breath: 0.018,
    breathHz: 0.3,
    accentShare: 0.22,
    opacity: 1,
  },
  resting: {
    spread: 0.86,
    edgePull: 0,
    drift: 0.08,
    breath: 0.008,
    breathHz: 0.1,
    accentShare: 0.08,
    opacity: 0.68,
  },
};

/** State changes tween over this long, per the design spec. */
export const STATE_TWEEN_SECONDS = 1.2;

export const twinVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpread;
  uniform float uEdgePull;
  uniform float uDrift;
  uniform float uBreath;
  uniform float uBreathHz;
  uniform float uSize;
  uniform float uAccentShare;
  uniform float uHighlightBand;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aBand;

  varying float vAccent;
  varying float vHighlight;

  void main() {
    vec3 base = position;

    /* Cheap three-axis drift. Each point keeps its own phase, so the cloud
       moves as a body of individuals rather than as one wobbling mesh. */
    float t = uTime * uDrift;
    float phase = aSeed * 6.2831853;
    vec3 drift = vec3(
      sin(t * 0.6 + phase),
      sin(t * 0.5 + phase * 1.7),
      cos(t * 0.55 + phase * 1.3)
    ) * 0.045 * uDrift;

    /* Breathing: a whole-body scale, slow enough to read as alive. */
    float breath = 1.0 + sin(uTime * 6.2831853 * uBreathHz) * uBreath;

    /* Edge pull: points facing away from the camera reach outward, so a
       stretched plan looks like something tugging at the figure's edges. */
    float edge = smoothstep(0.2, 1.0, 1.0 - abs(base.z));
    float radius = uSpread * breath + edge * uEdgePull;

    vec3 displaced = base * radius + drift;

    vAccent = step(1.0 - uAccentShare, aSeed);
    vHighlight = (uHighlightBand >= 0.0 && abs(aBand - uHighlightBand) < 0.5) ? 1.0 : 0.0;

    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + vHighlight * 0.8) * (300.0 / -mv.z);
  }
`;

export const twinFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccentColor;
  uniform float uOpacity;

  varying float vAccent;
  varying float vHighlight;

  void main() {
    /* Round, soft-edged points. Square particles read as a glitch. */
    vec2 d = gl_PointCoord - vec2(0.5);
    float dist = length(d);
    float alpha = smoothstep(0.5, 0.15, dist);
    if (alpha < 0.01) discard;

    vec3 color = mix(uColor, uAccentColor, vAccent);
    float boost = 1.0 + vHighlight * 0.5;

    gl_FragColor = vec4(color * boost, alpha * uOpacity * (0.55 + vAccent * 0.45));
  }
`;
