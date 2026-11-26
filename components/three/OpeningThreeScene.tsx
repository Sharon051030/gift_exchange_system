"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getOpeningFrame, OPENING_TIMELINE } from "@/lib/opening-experience";
import type { QualityLevel } from "./visual-preferences";

export type OpeningMode = "loading" | "playing" | "ready";

type OpeningSceneProps = {
  mode: OpeningMode;
  quality: QualityLevel;
  reducedMotion: boolean;
  onSceneReady: () => void;
  onBackgroundStart: () => void;
  onInterfaceReveal: () => void;
  onComplete: () => void;
};

const QUALITY = {
  high: { dpr: 1.6, motes: 110 },
  standard: { dpr: 1.25, motes: 74 },
  low: { dpr: 1, motes: 42 },
} as const;

const palette = {
  pine: "#344e37",
  berry: "#b63439",
  gold: "#cfa05b",
  ivory: "#fff9e9",
  ink: "#302d24",
};

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function useCandyTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 512;
    const context = canvas.getContext("2d")!;
    context.fillStyle = palette.ivory;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = palette.berry;
    for (let y = -128; y < 640; y += 112) {
      context.beginPath();
      context.moveTo(-32, y + 62);
      context.lineTo(160, y - 34);
      context.lineTo(160, y + 24);
      context.lineTo(-32, y + 120);
      context.closePath();
      context.fill();
    }
    context.globalAlpha = 0.13;
    context.fillStyle = palette.ink;
    for (let y = 8; y < 512; y += 21) {
      for (let x = 6; x < 128; x += 19) context.fillRect(x, y, 1, 1);
    }
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.wrapS = THREE.RepeatWrapping;
    next.wrapT = THREE.RepeatWrapping;
    next.repeat.set(1.1, 2.4);
    return next;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function createSeededPositions(count: number, seed = 41) {
  const positions = new Float32Array(count * 3);
  let value = seed;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * 5.4;
    positions[index * 3 + 1] = (random() - 0.5) * 4.1;
    positions[index * 3 + 2] = (random() - 0.5) * 2.4;
  }
  return positions;
}

function createStarShape() {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 0.19 : 0.078;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function CandyCane({
  groupRef,
  materialRef,
  visible,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  materialRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  visible: boolean;
}) {
  const texture = useCandyTexture();
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -1.45, 0),
        new THREE.Vector3(0, -0.55, 0),
        new THREE.Vector3(0, 0.45, 0),
        new THREE.Vector3(0.04, 1.05, 0),
        new THREE.Vector3(0.36, 1.42, 0),
        new THREE.Vector3(0.83, 1.37, 0),
        new THREE.Vector3(1.02, 1.02, 0),
        new THREE.Vector3(0.84, 0.72, 0),
        new THREE.Vector3(0.56, 0.68, 0),
      ]),
    [],
  );
  return (
    <group ref={groupRef} scale={0.72} visible={visible}>
      <mesh castShadow>
        <tubeGeometry args={[curve, 72, 0.2, 9, false]} />
        <meshStandardMaterial
          ref={materialRef}
          map={texture}
          roughness={0.76}
          metalness={0}
          transparent
        />
      </mesh>
    </group>
  );
}

function GiftBox({
  position,
  scale,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0, 0.505]}>
        <boxGeometry args={[0.16, 1.01, 0.02]} />
        <meshStandardMaterial color={palette.gold} roughness={0.68} />
      </mesh>
      <mesh position={[0, 0, 0.52]}>
        <boxGeometry args={[1.01, 0.15, 0.02]} />
        <meshStandardMaterial color={palette.gold} roughness={0.68} />
      </mesh>
      <group position={[0, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[-0.19, 0, 0]} scale={[0.7, 0.52, 0.46]}>
          <torusGeometry args={[0.23, 0.055, 7, 22, Math.PI * 1.65]} />
          <meshStandardMaterial color={palette.gold} roughness={0.66} />
        </mesh>
        <mesh
          position={[0.19, 0, 0]}
          rotation={[0, Math.PI, 0]}
          scale={[0.7, 0.52, 0.46]}
        >
          <torusGeometry args={[0.23, 0.055, 7, 22, Math.PI * 1.65]} />
          <meshStandardMaterial color={palette.gold} roughness={0.66} />
        </mesh>
      </group>
    </group>
  );
}

function TreeAndGifts({
  treeRef,
  giftRef,
  isMobile,
  ready,
}: {
  treeRef: React.RefObject<THREE.Group | null>;
  giftRef: React.RefObject<THREE.Group | null>;
  isMobile: boolean;
  ready: boolean;
}) {
  const star = useMemo(() => createStarShape(), []);
  const treePosition: [number, number, number] = isMobile
    ? [0, 0.92, 0]
    : [2.35, -0.48, 0];
  const treeScale = isMobile ? 0.56 : 1;
  return (
    <group position={treePosition} scale={treeScale}>
      <group ref={treeRef} visible={ready}>
        <mesh
          position={[0, 2.94, 0.08]}
          userData={{ revealAt: 0, revealSpan: 0.16 }}
        >
          <shapeGeometry args={[star]} />
          <meshStandardMaterial
            color={palette.gold}
            roughness={0.52}
            metalness={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          position={[0, 2.28, 0]}
          userData={{ revealAt: 0.08, revealSpan: 0.24 }}
          castShadow
        >
          <coneGeometry args={[0.78, 1.25, 7]} />
          <meshStandardMaterial color="#496342" roughness={0.88} />
        </mesh>
        <mesh
          position={[0, 1.42, 0]}
          userData={{ revealAt: 0.25, revealSpan: 0.28 }}
          castShadow
        >
          <coneGeometry args={[1.18, 1.65, 7]} />
          <meshStandardMaterial color={palette.pine} roughness={0.9} />
        </mesh>
        <mesh
          position={[0, 0.36, 0]}
          userData={{ revealAt: 0.46, revealSpan: 0.3 }}
          castShadow
        >
          <coneGeometry args={[1.65, 2.15, 7]} />
          <meshStandardMaterial color="#2f4933" roughness={0.9} />
        </mesh>
        <mesh
          position={[0, -1.03, 0]}
          userData={{ revealAt: 0.72, revealSpan: 0.22 }}
          castShadow
        >
          <cylinderGeometry args={[0.28, 0.38, 1.1, 7]} />
          <meshStandardMaterial color="#68432e" roughness={0.96} />
        </mesh>
        {[
          [-0.42, 1.76, 0.55, palette.berry],
          [0.58, 1.02, 0.72, palette.gold],
          [-0.68, 0.32, 0.92, palette.ivory],
          [0.7, -0.06, 1.02, palette.berry],
        ].map(([x, y, z, color], index) => (
          <mesh
            key={index}
            position={[x as number, y as number, z as number]}
            userData={{ revealAt: 0.72 + index * 0.045, revealSpan: 0.12 }}
          >
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color={color as string} roughness={0.68} />
          </mesh>
        ))}
      </group>

      <group ref={giftRef} visible={ready} position={[0, -1.5, 0.58]}>
        <group userData={{ revealAt: 0, revealSpan: 0.28 }}>
          <GiftBox
            position={[-1.08, 0.12, 0]}
            scale={[0.78, 0.78, 0.78]}
            color={palette.berry}
            rotation={-0.18}
          />
        </group>
        <group userData={{ revealAt: 0.16, revealSpan: 0.3 }}>
          <GiftBox
            position={[-0.35, -0.1, 0.42]}
            scale={[0.62, 0.62, 0.62]}
            color={palette.ivory}
            rotation={0.12}
          />
        </group>
        <group userData={{ revealAt: 0.3, revealSpan: 0.3 }}>
          <GiftBox
            position={[0.45, -0.18, 0.56]}
            scale={[0.52, 0.52, 0.52]}
            color={palette.pine}
            rotation={-0.08}
          />
        </group>
        <group userData={{ revealAt: 0.45, revealSpan: 0.32 }}>
          <GiftBox
            position={[1.08, 0.02, 0.04]}
            scale={[0.72, 0.72, 0.72]}
            color={palette.berry}
            rotation={0.2}
          />
        </group>
        <group userData={{ revealAt: 0.58, revealSpan: 0.28 }}>
          <GiftBox
            position={[-0.82, -0.42, 0.78]}
            scale={[0.4, 0.4, 0.4]}
            color={palette.gold}
            rotation={0.08}
          />
        </group>
        <group userData={{ revealAt: 0.68, revealSpan: 0.26 }}>
          <GiftBox
            position={[0.82, -0.42, 0.8]}
            scale={[0.38, 0.38, 0.38]}
            color={palette.ivory}
            rotation={-0.14}
          />
        </group>
      </group>
    </group>
  );
}

function OpeningWorld({
  mode,
  quality,
  reducedMotion,
  onBackgroundStart,
  onInterfaceReveal,
  onComplete,
}: Omit<OpeningSceneProps, "onSceneReady">) {
  const { size } = useThree();
  const isMobile = size.width < 760;
  const candyRef = useRef<THREE.Group>(null);
  const candyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const decorRef = useRef<THREE.Group>(null);
  const moteRef = useRef<THREE.Points>(null);
  const moteMaterialRef = useRef<THREE.PointsMaterial>(null);
  const magicRef = useRef<THREE.Points>(null);
  const magicMaterialRef = useRef<THREE.PointsMaterial>(null);
  const ribbonRef = useRef<THREE.Mesh>(null);
  const ribbonMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const treeRef = useRef<THREE.Group>(null);
  const giftRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const sentBackgroundRef = useRef(false);
  const sentInterfaceRef = useRef(false);
  const sentCompleteRef = useRef(false);
  const starShape = useMemo(() => createStarShape(), []);
  const settings = QUALITY[quality];
  const motes = useMemo(
    () => createSeededPositions(settings.motes),
    [settings.motes],
  );
  const expansionCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.46, 0.56, 0.08),
        new THREE.Vector3(-0.08, 1.08, 0.12),
        new THREE.Vector3(-0.86, 0.42, 0.2),
        new THREE.Vector3(-0.64, -0.62, 0.3),
        new THREE.Vector3(0.16, -0.88, 0.42),
        new THREE.Vector3(0.98, -0.22, 0.54),
        new THREE.Vector3(1.1, 0.84, 0.68),
        new THREE.Vector3(0.12, 1.22, 0.82),
        new THREE.Vector3(-1.16, 0.36, 0.98),
        new THREE.Vector3(-0.62, -1.04, 1.15),
        new THREE.Vector3(0.76, -1.42, 1.3),
        new THREE.Vector3(2.08, -1.02, 1.45),
        new THREE.Vector3(3.08, -1.82, 1.65),
      ]),
    [],
  );
  const returnCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.08, -1.82, 1.65),
        new THREE.Vector3(4.05, -0.62, 1.42),
        new THREE.Vector3(3.82, 1.36, 1.02),
        new THREE.Vector3(3.02, 2.06, 0.72),
      ]),
    [],
  );
  const magicPositions = useMemo(() => {
    const count = settings.motes + 60;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const t = index / Math.max(1, count - 1);
      const angle = t * Math.PI * 7.2;
      const radius = 0.2 + t * 1.6;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 2.72 - t * 4.45;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.44 + 0.4;
    }
    return positions;
  }, [settings.motes]);
  const ribbonCurve = useMemo(() => {
    const points = Array.from({ length: 72 }, (_, index) => {
      const t = index / 71;
      const angle = t * Math.PI * 6.4;
      const radius = 0.28 + t * 1.5;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        2.66 - t * 4.18,
        Math.sin(angle) * radius * 0.46 + 0.48,
      );
    });
    return new THREE.CatmullRomCurve3(points);
  }, []);

  useEffect(() => {
    startTimeRef.current = null;
    sentBackgroundRef.current = mode === "ready";
    sentInterfaceRef.current = mode === "ready";
    sentCompleteRef.current = mode === "ready";
  }, [mode]);

  const revealParts = useCallback(
    (group: THREE.Group | null, progress: number) => {
      if (!group) return;
      group.visible = progress > 0;
      group.children.forEach((child) => {
        const revealAt = Number(child.userData.revealAt ?? 0);
        const revealSpan = Number(child.userData.revealSpan ?? 0.2);
        const local = Math.min(
          1,
          Math.max(0, (progress - revealAt) / revealSpan),
        );
        child.visible = local > 0;
        const eased = easeOutCubic(local);
        child.scale.setScalar(Math.max(0.001, eased));
      });
    },
    [],
  );

  useFrame((state, delta) => {
    const candy = candyRef.current;
    const material = candyMaterialRef.current;
    const decor = decorRef.current;
    if (!candy || !material || !decor) return;

    const clock = state.clock.elapsedTime;
    if (mode === "playing" && startTimeRef.current === null) {
      startTimeRef.current = clock;
    }
    const elapsed =
      mode === "ready"
        ? OPENING_TIMELINE.total + 0.01
        : mode === "playing"
          ? clock - (startTimeRef.current ?? clock)
          : 0;
    const frame = getOpeningFrame(elapsed);

    if (mode === "loading") {
      candy.visible = true;
      candy.position.set(0, 0, 0);
      candy.scale.setScalar(isMobile ? 0.56 : 0.72);
      candy.rotation.z = Math.sin(clock * ((Math.PI * 2) / 2.5)) * 0.1745;
      material.opacity = 1;
      decor.position.copy(candy.position);
      decor.scale.setScalar(isMobile ? 0.88 : 1);
      decor.rotation.z = Math.sin(clock * 0.35) * 0.06;
      if (moteRef.current) {
        moteRef.current.position.y = Math.sin(clock * 0.8) * 0.08;
      }
      revealParts(treeRef.current, 0);
      revealParts(giftRef.current, 0);
      if (magicMaterialRef.current) magicMaterialRef.current.opacity = 0;
      return;
    }

    const xFactor = isMobile ? 0.5 : 1;
    if (frame.expansion < 1) {
      const point = expansionCurve.getPoint(easeInOutCubic(frame.expansion));
      const tangent = expansionCurve.getTangent(frame.expansion);
      candy.position.set(point.x * xFactor, point.y, point.z);
      const scale = (isMobile ? 0.56 : 0.72) * (1 + frame.expansion * 2.45);
      candy.scale.set(
        scale * (1 + Math.sin(frame.expansion * Math.PI) * 0.12),
        scale * (1 - Math.sin(frame.expansion * Math.PI) * 0.06),
        scale,
      );
      candy.rotation.z = Math.atan2(tangent.y, tangent.x) - Math.PI / 2;
    } else if (frame.returnFlight < 1) {
      const progress = easeInOutCubic(frame.returnFlight);
      const point = returnCurve.getPoint(progress);
      const tangent = returnCurve.getTangent(progress);
      candy.position.set(point.x * xFactor, point.y, point.z);
      const scale = THREE.MathUtils.lerp(
        (isMobile ? 0.56 : 0.72) * 3.45,
        isMobile ? 0.34 : 0.42,
        progress,
      );
      candy.scale.setScalar(scale);
      candy.rotation.z = Math.atan2(tangent.y, tangent.x) - Math.PI / 2;
    } else {
      candy.position.set(3.02 * xFactor, 2.06, 0.72);
      candy.scale.setScalar(isMobile ? 0.34 : 0.42);
      candy.rotation.z += delta * 0.3;
    }

    candy.visible = frame.dissolve < 1;
    material.opacity = 1 - frame.dissolve;
    decor.position.copy(candy.position);
    decor.scale.copy(candy.scale).multiplyScalar(1.55);
    decor.rotation.z += delta * (frame.expansion > 0 ? 0.75 : 0.12);
    if (moteMaterialRef.current) {
      moteMaterialRef.current.opacity = THREE.MathUtils.lerp(
        0.58,
        0.12,
        frame.dissolve,
      );
    }
    if (magicRef.current) {
      const treeX = isMobile ? 0 : 2.35;
      magicRef.current.position.set(treeX, isMobile ? 0.92 : -0.48, 0);
      magicRef.current.rotation.y += reducedMotion ? 0 : delta * 0.22;
      if (ribbonRef.current) {
        ribbonRef.current.position.copy(magicRef.current.position);
        ribbonRef.current.rotation.y = magicRef.current.rotation.y;
        ribbonRef.current.scale.setScalar(isMobile ? 0.56 : 1);
      }
    }
    if (magicMaterialRef.current) {
      const arrival = Math.max(frame.dissolve, frame.tree);
      magicMaterialRef.current.opacity =
        mode === "ready" ? 0.5 : Math.min(0.88, arrival * 1.25);
    }
    if (ribbonMaterialRef.current) {
      ribbonMaterialRef.current.opacity =
        mode === "ready" ? 0.76 : Math.min(0.76, frame.tree * 0.9);
    }

    revealParts(treeRef.current, mode === "ready" ? 1 : frame.tree);
    revealParts(giftRef.current, mode === "ready" ? 1 : frame.gifts);

    if (
      !sentBackgroundRef.current &&
      elapsed >= OPENING_TIMELINE.backgroundStart
    ) {
      sentBackgroundRef.current = true;
      onBackgroundStart();
    }
    if (
      !sentInterfaceRef.current &&
      elapsed >= OPENING_TIMELINE.interface.start
    ) {
      sentInterfaceRef.current = true;
      onInterfaceReveal();
    }
    if (!sentCompleteRef.current && frame.complete) {
      sentCompleteRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 6, 6]} intensity={2.25} castShadow />
      <pointLight position={[-2, 2, 4]} intensity={10} color={palette.gold} />
      <CandyCane
        groupRef={candyRef}
        materialRef={candyMaterialRef}
        visible={mode !== "ready"}
      />
      <group ref={decorRef} visible={mode !== "ready"}>
        {[
          [-1.18, 0.82, 0.12, 1],
          [1.32, 0.58, -0.18, 0.72],
          [-1.42, -0.72, 0.22, 0.66],
          [1.06, -0.9, 0.05, 0.86],
          [0.2, 1.42, -0.2, 0.54],
        ].map(([x, y, z, scale], index) => (
          <mesh
            key={index}
            position={[x, y, z]}
            scale={scale}
            rotation={[0, 0, index * 0.34]}
          >
            <shapeGeometry args={[starShape]} />
            <meshStandardMaterial
              color={palette.gold}
              roughness={0.58}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        <points ref={moteRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[motes, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={moteMaterialRef}
            color={palette.gold}
            size={0.052}
            transparent
            opacity={0.58}
            depthWrite={false}
          />
        </points>
      </group>

      <points ref={magicRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[magicPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={magicMaterialRef}
          color="#efc46f"
          size={0.058}
          transparent
          opacity={mode === "ready" ? 0.5 : 0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh ref={ribbonRef}>
        <tubeGeometry args={[ribbonCurve, 112, 0.028, 6, false]} />
        <meshBasicMaterial
          ref={ribbonMaterialRef}
          color={palette.gold}
          transparent
          opacity={mode === "ready" ? 0.76 : 0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <TreeAndGifts
        treeRef={treeRef}
        giftRef={giftRef}
        isMobile={isMobile}
        ready={mode === "ready"}
      />
      <mesh
        position={[isMobile ? 0 : 2.35, isMobile ? -0.68 : -2.05, -0.48]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[isMobile ? 2.1 : 2.5, 42]} />
        <shadowMaterial transparent opacity={mode === "loading" ? 0 : 0.18} />
      </mesh>
    </>
  );
}

export function OpeningThreeScene(props: OpeningSceneProps) {
  const settings = QUALITY[props.quality];
  return (
    <div className="opening-three-scene" aria-hidden="true">
      <Canvas
        dpr={settings.dpr}
        camera={{ position: [0, 0.15, 8.2], fov: 46 }}
        gl={{
          antialias: props.quality !== "low",
          alpha: true,
          powerPreference: "high-performance",
        }}
        shadows={props.quality === "high" ? "percentage" : false}
        frameloop={props.reducedMotion ? "demand" : "always"}
        onCreated={() => props.onSceneReady()}
      >
        <OpeningWorld {...props} />
      </Canvas>
    </div>
  );
}
