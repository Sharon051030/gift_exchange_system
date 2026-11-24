"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityLevel } from "./visual-preferences";

type SceneProps = {
  quality: QualityLevel;
  reducedMotion: boolean;
};

type ScenePalette = {
  paperRaised: string;
  berry: string;
  pine: string;
  gold: string;
  dustyPink: string;
  ink: string;
};

const QUALITY = {
  high: { dpr: 1.7, particles: 86, fragments: 18 },
  standard: { dpr: 1.35, particles: 52, fragments: 12 },
  low: { dpr: 1, particles: 24, fragments: 8 },
} as const;

function useScenePalette(): ScenePalette {
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    return {
      paperRaised: token("--paper-raised", "#fff9e9"),
      berry: token("--berry", "#b63439"),
      pine: token("--pine", "#344e37"),
      gold: token("--antique-gold", "#cfa05b"),
      dustyPink: token("--dusty-pink", "#e6b4ad"),
      ink: token("--ink", "#302d24"),
    };
  }, []);
}

function usePaperTexture(base: string, accent: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = base;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = accent;
    context.globalAlpha = 0.58;
    context.lineWidth = 7;
    for (let index = -256; index < 512; index += 48) {
      context.beginPath();
      context.moveTo(index, 0);
      context.lineTo(index + 256, 256);
      context.stroke();
    }
    context.globalAlpha = 0.2;
    for (let y = 10; y < 256; y += 18) {
      for (let x = 8; x < 256; x += 21) {
        context.fillStyle = x % 2 === 0 ? "#fff9e9" : "#302d24";
        context.fillRect(x, y, 2, 2);
      }
    }
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.wrapS = THREE.RepeatWrapping;
    nextTexture.wrapT = THREE.RepeatWrapping;
    nextTexture.repeat.set(2.4, 1.8);
    return nextTexture;
  }, [accent, base]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function seededPoints(
  count: number,
  spread: [number, number, number],
  seed = 1,
) {
  const positions = new Float32Array(count * 3);
  let value = seed;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * spread[0];
    positions[index * 3 + 1] = (random() - 0.5) * spread[1];
    positions[index * 3 + 2] = (random() - 0.5) * spread[2];
  }
  return positions;
}

function GoldDust({
  count,
  reducedMotion,
  color,
}: {
  count: number;
  reducedMotion: boolean;
  color: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => seededPoints(count, [8, 6, 4], 19), [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current || reducedMotion) return;
    pointsRef.current.rotation.y += delta * 0.045;
    pointsRef.current.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.17) * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.82}
        depthWrite={false}
      />
    </points>
  );
}

function GiftSculpture({
  reducedMotion,
  leaving,
  palette,
}: {
  reducedMotion: boolean;
  leaving: boolean;
  palette: ScenePalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const paper = usePaperTexture(palette.berry, palette.gold);
  const greenPaper = usePaperTexture(palette.pine, palette.gold);
  const { pointer } = useThree();

  useFrame((state, delta) => {
    if (!groupRef.current || !lidRef.current) return;
    const targetX = reducedMotion ? -0.08 : pointer.y * 0.12 - 0.08;
    const targetY = reducedMotion ? -0.28 : pointer.x * 0.18 - 0.28;
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      targetX,
      4,
      delta,
    );
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetY,
      4,
      delta,
    );
    if (!reducedMotion) {
      groupRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
      lidRef.current.rotation.z = THREE.MathUtils.damp(
        lidRef.current.rotation.z,
        leaving ? -0.13 : Math.sin(state.clock.elapsedTime * 0.62) * 0.018,
        3,
        delta,
      );
      lidRef.current.position.y = THREE.MathUtils.damp(
        lidRef.current.position.y,
        leaving ? 1.37 : 1.05,
        3.5,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.08, -0.28, 0.02]}>
      <mesh castShadow receiveShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[2.9, 1.95, 1.8, 2, 2, 2]} />
        <meshStandardMaterial map={paper} roughness={0.88} metalness={0} />
      </mesh>
      <mesh position={[0, -0.04, 0.92]}>
        <boxGeometry args={[0.34, 1.93, 0.055]} />
        <meshStandardMaterial color={palette.gold} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.04, 0.96]}>
        <boxGeometry args={[2.9, 0.31, 0.045]} />
        <meshStandardMaterial color={palette.gold} roughness={0.72} />
      </mesh>
      <group ref={lidRef} position={[0, 1.05, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.12, 0.37, 2.02]} />
          <meshStandardMaterial map={greenPaper} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 1.03]}>
          <boxGeometry args={[0.36, 0.38, 0.05]} />
          <meshStandardMaterial color={palette.gold} roughness={0.7} />
        </mesh>
        <group position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[-0.42, 0, 0]} scale={[1.15, 0.72, 0.56]}>
            <torusGeometry args={[0.42, 0.105, 12, 42, Math.PI * 1.7]} />
            <meshStandardMaterial
              color={palette.berry}
              roughness={0.78}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[0.42, 0, 0]}
            rotation={[0, Math.PI, 0]}
            scale={[1.15, 0.72, 0.56]}
          >
            <torusGeometry args={[0.42, 0.105, 12, 42, Math.PI * 1.7]} />
            <meshStandardMaterial
              color={palette.berry}
              roughness={0.78}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.22, 20, 14]} />
            <meshStandardMaterial color={palette.berry} roughness={0.82} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function CoverThreeScene({
  quality,
  reducedMotion,
  leaving = false,
}: SceneProps & { leaving?: boolean }) {
  const settings = QUALITY[quality];
  const palette = useScenePalette();
  return (
    <div className="three-cover-scene" aria-hidden="true">
      <Canvas
        dpr={settings.dpr}
        camera={{ position: [0, 0.2, 6.7], fov: 38 }}
        gl={{
          antialias: quality !== "low",
          alpha: true,
          powerPreference: "high-performance",
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        shadows={quality === "high" ? "percentage" : false}
      >
        <ambientLight intensity={1.35} />
        <directionalLight
          position={[3, 5, 5]}
          intensity={2.2}
          color={palette.paperRaised}
          castShadow={quality === "high"}
        />
        <pointLight
          position={[-3, 1, 3]}
          intensity={12}
          distance={7}
          color={palette.gold}
        />
        <GiftSculpture
          reducedMotion={reducedMotion}
          leaving={leaving}
          palette={palette}
        />
        <GoldDust
          count={settings.particles}
          reducedMotion={reducedMotion}
          color={palette.gold}
        />
        <mesh
          position={[0, -1.42, -0.65]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <circleGeometry args={[2.55, 48]} />
          <shadowMaterial transparent opacity={0.18} />
        </mesh>
      </Canvas>
    </div>
  );
}

function StageParticles({
  count,
  reducedMotion,
  color,
}: {
  count: number;
  reducedMotion: boolean;
  color: string;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(
    () => seededPoints(count, [16, 10, 3], 71),
    [count],
  );
  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.18;
    ref.current.rotation.z += delta * 0.005;
  });
  return (
    <points ref={ref} position={[0, 0, -1]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.035}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  );
}

export function StageAtmosphere({ quality, reducedMotion }: SceneProps) {
  const settings = QUALITY[quality];
  const palette = useScenePalette();
  return (
    <div className="stage-atmosphere" aria-hidden="true">
      <Canvas
        dpr={Math.min(settings.dpr, 1.25)}
        camera={{ position: [0, 0, 8], fov: 48 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <StageParticles
          count={settings.particles}
          reducedMotion={reducedMotion}
          color={palette.gold}
        />
      </Canvas>
    </div>
  );
}

const punchVertexShader = /* glsl */ `
  uniform float uImpact;
  uniform float uBreak;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 displaced = position;
    float distanceFromHit = distance(uv, vec2(0.5));
    float dent = exp(-distanceFromHit * 8.5) * uImpact;
    displaced.z -= dent * 0.58;
    displaced.x += (uv.x - 0.5) * dent * 0.18;
    displaced.y += (uv.y - 0.5) * dent * 0.18;
    displaced.x += sign(uv.x - 0.5) * uBreak * pow(max(0.0, 0.42 - distanceFromHit), 1.4) * 0.9;
    displaced.y += sin((uv.x + uTime * 0.12) * 18.0) * uBreak * 0.025;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const punchFragmentShader = /* glsl */ `
  uniform vec3 uPaper;
  uniform float uImpact;
  uniform float uBreak;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fiber = sin(vUv.x * 240.0) * sin(vUv.y * 180.0) * 0.025;
    float crackPath = abs(vUv.x - (0.5 + sin(vUv.y * 21.0 + uTime * 0.15) * 0.055));
    float crack = (1.0 - smoothstep(0.008, 0.024, crackPath)) * step(0.38, uImpact);
    float branchPath = abs(vUv.y - (0.51 + sin(vUv.x * 25.0) * 0.045));
    float branch = (1.0 - smoothstep(0.006, 0.02, branchPath)) * step(0.72, uImpact);
    float hole = 1.0 - smoothstep(0.02, 0.13 + uBreak * 0.12, distance(vUv, vec2(0.5)));
    vec3 paper = uPaper + fiber;
    vec3 color = mix(paper, vec3(0.08, 0.065, 0.045), clamp(crack + branch, 0.0, 1.0));
    float alpha = 1.0 - hole * uBreak;
    gl_FragColor = vec4(color, alpha);
  }
`;

type PunchPhase = "hit-1" | "hit-2" | "draw-pending" | "breaking";

function PaperPlane({
  phase,
  reducedMotion,
  paperColor,
}: {
  phase: PunchPhase;
  reducedMotion: boolean;
  paperColor: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetImpact = phase === "hit-1" ? 0.48 : phase === "hit-2" ? 0.82 : 1;
  const targetBreak = phase === "breaking" ? 1 : 0;
  const uniforms = useMemo(
    () => ({
      uImpact: { value: 0 },
      uBreak: { value: 0 },
      uTime: { value: 0 },
      uPaper: { value: new THREE.Color(paperColor) },
    }),
    [paperColor],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime!.value = state.clock.elapsedTime;
    material.uniforms.uImpact!.value = THREE.MathUtils.damp(
      material.uniforms.uImpact!.value,
      targetImpact,
      reducedMotion ? 24 : 8,
      delta,
    );
    material.uniforms.uBreak!.value = THREE.MathUtils.damp(
      material.uniforms.uBreak!.value,
      targetBreak,
      reducedMotion ? 24 : 7,
      delta,
    );
  });

  return (
    <mesh>
      <planeGeometry args={[2.3, 2.8, 28, 34]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={punchVertexShader}
        fragmentShader={punchFragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function PaperFragments({
  count,
  reducedMotion,
  palette,
}: {
  count: number;
  reducedMotion: boolean;
  palette: ScenePalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const fragments = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        angle: (index / count) * Math.PI * 2,
        speed: 0.72 + (index % 4) * 0.13,
        size: 0.1 + (index % 3) * 0.035,
      })),
    [count],
  );
  useFrame((state) => {
    if (!groupRef.current || reducedMotion) return;
    const time = Math.min(state.clock.elapsedTime, 1.2);
    groupRef.current.children.forEach((child, index) => {
      const fragment = fragments[index]!;
      child.position.x = Math.cos(fragment.angle) * time * fragment.speed;
      child.position.y =
        Math.sin(fragment.angle) * time * fragment.speed - time * time * 0.22;
      child.position.z = time * 0.55;
      child.rotation.x = time * (index % 2 === 0 ? 4 : -4);
      child.rotation.z = time * (index % 3 === 0 ? 5 : -3);
    });
  });
  return (
    <group ref={groupRef}>
      {fragments.map((fragment, index) => (
        <mesh key={index} rotation={[0, 0, fragment.angle]}>
          <planeGeometry args={[fragment.size, fragment.size * 1.45]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? palette.berry : palette.gold}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export function PunchThreeEffect({
  phase,
  quality,
  reducedMotion,
}: SceneProps & { phase: PunchPhase }) {
  const settings = QUALITY[quality];
  const palette = useScenePalette();
  return (
    <span className="slot-three-fx" aria-hidden="true">
      <Canvas
        dpr={Math.min(settings.dpr, 1.35)}
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        gl={{
          antialias: quality !== "low",
          alpha: true,
          powerPreference: "high-performance",
        }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <PaperPlane
          phase={phase}
          reducedMotion={reducedMotion}
          paperColor={palette.berry}
        />
        {phase === "breaking" ? (
          <PaperFragments
            count={settings.fragments}
            reducedMotion={reducedMotion}
            palette={palette}
          />
        ) : null}
      </Canvas>
    </span>
  );
}

function RevealOrbit({
  reducedMotion,
  palette,
}: {
  reducedMotion: boolean;
  palette: ScenePalette;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.z += delta * 0.08;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[1.25, 0.25, 0.2]}>
        <torusGeometry args={[2.75, 0.018, 6, 96]} />
        <meshBasicMaterial color={palette.gold} transparent opacity={0.44} />
      </mesh>
      <mesh rotation={[0.9, -0.45, -0.8]}>
        <torusGeometry args={[3.55, 0.012, 6, 96]} />
        <meshBasicMaterial
          color={palette.dustyPink}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

export function RevealAtmosphere({ quality, reducedMotion }: SceneProps) {
  const settings = QUALITY[quality];
  const palette = useScenePalette();
  return (
    <div className="reveal-atmosphere" aria-hidden="true">
      <Canvas
        dpr={Math.min(settings.dpr, 1.35)}
        camera={{ position: [0, 0, 7], fov: 48 }}
        gl={{
          antialias: quality !== "low",
          alpha: true,
          powerPreference: "high-performance",
        }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <GoldDust
          count={settings.particles}
          reducedMotion={reducedMotion}
          color={palette.gold}
        />
        <RevealOrbit reducedMotion={reducedMotion} palette={palette} />
      </Canvas>
    </div>
  );
}
