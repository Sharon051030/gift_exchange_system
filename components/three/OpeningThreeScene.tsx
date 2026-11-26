"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getOpeningFrame, OPENING_TIMELINE } from "@/lib/opening-experience";
import {
  candyMap,
  createContactTexture,
  createGlowTexture,
  paperCanvas,
  readOpeningPalette,
  seededRandom,
} from "./opening-materials";
import {
  candyGeometry,
  createChristmasModel,
  starGeometry,
} from "./opening-models";
import type { QualityLevel } from "./visual-preferences";

export type OpeningMode = "loading" | "playing" | "ready";

type OpeningSceneProps = {
  mode: OpeningMode;
  quality: QualityLevel;
  reducedMotion: boolean;
  onSceneReady: (grain: string) => void;
  onProgress: (background: number, copy: number) => void;
  onComplete: () => void;
};

const FRAME_HEIGHT = 7;
const QUALITY = {
  high: { dpr: 1.65, motes: 182 },
  standard: { dpr: 1.35, motes: 130 },
  low: { dpr: 1, motes: 76 },
} as const;

const smooth = (t: number) => t * t * (3 - 2 * t);
const fade = (t: number) => smooth(THREE.MathUtils.clamp(t, 0, 1));

function fitCamera(camera: THREE.Camera, height: number) {
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = height / FRAME_HEIGHT;
    camera.updateProjectionMatrix();
  }
}

function setOpacity(material: THREE.Material, opacity: number) {
  material.opacity = opacity;
}

function updatePoints(points: THREE.BufferAttribute) {
  points.needsUpdate = true;
}

function setTableauOpacity(
  model: ReturnType<typeof createChristmasModel>,
  reveal: number,
) {
  model.group.visible = reveal > 0;
  const fading = reveal > 0 && reveal < 1;
  model.depth.visible = fading;
  for (const material of model.materials) {
    if (material.transparent !== fading) {
      material.transparent = fading;
      material.depthWrite = !fading;
      material.needsUpdate = true;
    }
    material.opacity = reveal;
  }
  for (const { material, opacity } of model.shadows)
    material.opacity = opacity * reveal;
}

function garlandPoint(t: number, point: THREE.Vector3) {
  const angle = t * Math.PI * 7.3 + 1.9;
  const radius = 0.43 + t * 1.8;
  return point.set(
    Math.cos(angle) * radius,
    2.33 - t * 3.97,
    Math.sin(angle) * radius,
  );
}

function createOpeningAssets(count: number) {
  const palette = readOpeningPalette();
  const grain = paperCanvas();
  const paper = new THREE.CanvasTexture(grain);
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.colorSpace = THREE.SRGBColorSpace;
  paper.anisotropy = 4;
  const candyTexture = candyMap(grain, "#b63d24");
  const glow = createGlowTexture();
  const contact = createContactTexture();
  const model = createChristmasModel(palette, paper, contact);
  const candyMaterial = new THREE.MeshStandardMaterial({
    map: candyTexture,
    bumpMap: candyTexture,
    bumpScale: 0.025,
    flatShading: true,
    vertexColors: true,
    roughness: 0.75,
    alphaHash: true,
  });
  candyMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       float edge = pow(1.0 - max(dot(normalize(vViewPosition), normal), 0.0), 2.5);
       float leftLight = smoothstep(0.05, 0.85, dot(normal, normalize(vec3(-0.9, 0.38, 0.12))));
       totalEmissiveRadiance += vec3(1.0, 0.62, 0.19) * edge * leftLight * 2.1;`,
    );
  };
  const starMaterial = new THREE.MeshStandardMaterial({
    color: palette.gold,
    roughness: 0.54,
    metalness: 0.13,
    bumpMap: paper,
    bumpScale: 0.025,
    vertexColors: true,
    flatShading: true,
    alphaHash: true,
  });
  const candy = candyGeometry();
  const star = starGeometry(1);
  const ribbon = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 112 }, (_, i) =>
        garlandPoint(i / 111, new THREE.Vector3()),
      ),
    ),
    146,
    0.011,
    4,
    false,
  );
  const random = seededRandom(491);
  const sparkSeeds = Array.from({ length: count }, (_, index) => ({
    phase: random(),
    x: random() * 2 - 1,
    y: random() * 2 - 1,
    depth: random(),
    spread: index % 3 ? 0.11 + random() * 0.22 : 0.25 + random() * 0.61,
  }));
  return {
    palette,
    grain: grain.toDataURL("image/png"),
    paper,
    candyTexture,
    glow,
    contact,
    model,
    candy,
    candyMaterial,
    star,
    starMaterial,
    ribbon,
    sparkSeeds,
  };
}

const STARS = [
  [-0.39, 0.6, 0.2],
  [-0.6, 0.27, 0.082],
  [-0.38, -0.1, 0.106],
  [-0.4, -0.61, 0.078],
  [0.38, 0.58, 0.095],
  [0.56, 0.13, 0.185],
  [0.3, -0.42, 0.17],
];

function makePoints(count: number) {
  return new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
    THREE.DynamicDrawUsage,
  );
}

function OpeningWorld({
  mode,
  quality,
  onSceneReady,
  onProgress,
  onComplete,
}: OpeningSceneProps) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const count = QUALITY[quality].motes;
  const assets = useMemo(() => createOpeningAssets(count), [count]);
  const loadingPoints = useMemo(
    () => makePoints(Math.floor(count / 4)),
    [count],
  );
  const trailPoints = useMemo(() => makePoints(count), [count]);
  const nowPoint = useMemo(() => new THREE.Vector3(), []);
  const sample = useMemo(() => new THREE.Vector3(), []);
  const heroRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const loadingGlowRef = useRef<THREE.PointsMaterial>(null);
  const trailGlowRef = useRef<THREE.PointsMaterial>(null);
  const ribbonRef = useRef<THREE.MeshBasicMaterial>(null);
  const startRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const settledRef = useRef(false);
  const loadingAngleRef = useRef(-0.22);
  const width = (size.width / Math.max(1, size.height)) * FRAME_HEIGHT;
  const mobile = size.width <= 760;
  const artScale = mobile
    ? Math.min(0.54, width / 5.15)
    : Math.min(1.07, (width * 0.51) / 4.7);
  const artX = mobile ? 0 : width * 0.247;
  const artY = mobile ? 1.5 : -0.22;
  const candyScale = mobile ? Math.min(1, width / 3.3) : 1.18;
  const flight = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-width * 0.105, 0.42, 0.12),
        new THREE.Vector3(-width * 0.045, 1.16, 0.18),
        new THREE.Vector3(width * 0.095, 0.89, 0.29),
        new THREE.Vector3(width * 0.19, -0.59, 0.35),
        new THREE.Vector3(artX + artScale * 0.84, artY - artScale * 0.7, 0.28),
        new THREE.Vector3(artX + artScale * 0.89, artY + artScale * 1.16, 0.12),
        new THREE.Vector3(artX, artY + artScale * 2.47, 0),
      ]),
    [artX, artY, artScale, width],
  );

  useLayoutEffect(() => {
    // Match framing to the viewport only on resize. Animation never touches the camera.
    fitCamera(camera, size.height);
  }, [camera, size.height]);

  useEffect(
    () => () => {
      const geometries = new Set<THREE.BufferGeometry>([
        assets.candy,
        assets.star,
        assets.ribbon,
      ]);
      assets.model.group.traverse((part) => {
        if (part instanceof THREE.Mesh) geometries.add(part.geometry);
      });
      geometries.forEach((geometry) => geometry.dispose());
      for (const material of [
        assets.candyMaterial,
        assets.starMaterial,
        ...assets.model.materials,
      ])
        material.dispose();
      for (const { material } of assets.model.shadows) material.dispose();
      assets.model.depthMaterial.dispose();
      for (const texture of [
        assets.paper,
        assets.candyTexture,
        assets.glow,
        assets.contact,
      ])
        texture.dispose();
    },
    [assets],
  );

  useFrame(({ clock }) => {
    const hero = heroRef.current;
    const stars = starsRef.current;
    const loadingGlow = loadingGlowRef.current;
    const trailGlow = trailGlowRef.current;
    const ribbon = ribbonRef.current;
    if (!hero || !stars || !loadingGlow || !trailGlow || !ribbon) return;

    const time = clock.elapsedTime;
    if (mode === "playing") startRef.current ??= time;
    const elapsed =
      mode === "ready"
        ? OPENING_TIMELINE.total
        : time - (startRef.current ?? time);
    const frame = getOpeningFrame(elapsed);
    const dissolve = smooth(frame.dissolve);
    const reveal = smooth(frame.tableau);
    const travel = smooth(frame.flight);
    const skyFade = 1 - fade(frame.background * 1.5);
    const { model, candyMaterial, starMaterial, sparkSeeds } = assets;

    hero.visible = frame.dissolve < 1;
    if (hero.visible) {
      if (mode === "loading")
        loadingAngleRef.current = -0.22 + Math.sin(time * 2.05) * 0.08;
      flight.getPoint(travel, nowPoint);
      const scale =
        candyScale * THREE.MathUtils.lerp(1, 0.16, smooth(frame.flight));
      hero.position.copy(nowPoint);
      hero.scale.setScalar(scale);
      hero.rotation.set(
        -0.08,
        -0.14 + Math.sin(travel * Math.PI) * 0.66,
        loadingAngleRef.current - travel * Math.PI * 1.8,
      );
      setOpacity(candyMaterial, 1 - dissolve);
    }

    stars.visible = skyFade > 0;
    if (stars.visible) {
      setOpacity(starMaterial, skyFade);
      loadingGlow.opacity = 0.91 * skyFade;
      for (let i = 0; i < loadingPoints.count; i++) {
        const seed = sparkSeeds[i];
        loadingPoints.setXYZ(
          i,
          seed.x * width * 0.34 + Math.sin(time + seed.phase * 8) * 0.12,
          seed.y * 2.65 + Math.cos(time * 0.75 + seed.phase * 11) * 0.14,
          -0.18,
        );
      }
      updatePoints(loadingPoints);
    }

    setTableauOpacity(model, reveal);

    if (mode !== "loading") {
      const halo = fade(frame.flight * 3);
      const garland = smooth(frame.garland);
      const thread = assets.ribbon.index;
      ribbon.opacity = garland * 0.88;
      assets.ribbon.setDrawRange(
        0,
        thread ? Math.floor((thread.count / 24) * garland) * 24 : 0,
      );
      trailGlow.opacity = Math.max(halo * (1 - dissolve), garland) * 0.92;
      for (let i = 0; i < count; i++) {
        const seed = sparkSeeds[i];
        const t = (seed.phase + time * (0.035 + seed.depth * 0.028)) % 1;
        if (frame.dissolve < seed.phase) {
          flight.getPoint(Math.max(0, travel - t * 0.18), sample);
          const spread = seed.spread * (0.35 + t + dissolve);
          sample.set(
            sample.x + seed.x * spread,
            sample.y + seed.y * spread * 0.83,
            sample.z + 0.24,
          );
        } else {
          garlandPoint(t * garland, sample);
          sample.set(
            artX + (sample.x + seed.x * seed.spread) * artScale,
            artY + (sample.y + seed.y * seed.spread) * artScale,
            (sample.z + 0.22 + seed.depth * seed.spread) * artScale,
          );
          if (dissolve < 1 && garland < 1) {
            // The same sparks leave the candy and land on the opening turn of the garland.
            sample.lerp(
              hero.position,
              1 - fade((frame.dissolve - seed.phase) * 5),
            );
          }
        }
        trailPoints.setXYZ(i, sample.x, sample.y, sample.z);
      }
      updatePoints(trailPoints);
    }

    if (!readyRef.current) {
      readyRef.current = true;
      onSceneReady(assets.grain);
    }
    if (mode === "playing") {
      onProgress(smooth(frame.background), smooth(frame.interface));
      if (frame.complete && !settledRef.current) {
        settledRef.current = true;
        onComplete();
      }
    }
  });

  return (
    <>
      <hemisphereLight args={["#fff1ce", "#a68763", 1.4]} />
      <ambientLight color="#f8e0bd" intensity={0.41} />
      <directionalLight position={[-4, 6, 4]} intensity={2.8} color="#ffe5b0" />
      <directionalLight
        position={[-4, 3, -3]}
        intensity={2.6}
        color="#ffd17e"
      />
      <directionalLight
        position={[4, 0.4, 2]}
        intensity={0.31}
        color="#c6d7c2"
      />
      <group ref={heroRef} visible={mode !== "ready"}>
        <mesh geometry={assets.candy} material={assets.candyMaterial} />
      </group>
      <group ref={starsRef} visible={mode !== "ready"}>
        {STARS.map(([x, y, radius], index) => (
          <mesh
            key={index}
            geometry={assets.star}
            material={assets.starMaterial}
            position={[x * width * (mobile ? 0.72 : 0.51), y * 3.3, -0.12]}
            scale={radius * 1.12}
            rotation={[0, 0.12 + 0.07 * index, -0.24 + 0.06 * index]}
          />
        ))}
        <points frustumCulled={false}>
          <bufferGeometry>
            <primitive object={loadingPoints} attach="attributes-position" />
          </bufferGeometry>
          <pointsMaterial
            ref={loadingGlowRef}
            map={assets.glow}
            size={19}
            sizeAttenuation={false}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>
      <group position={[artX, artY, 0]} scale={artScale}>
        <group rotation={[0.15, 0, 0]}>
          <primitive object={assets.model.depth} />
          <primitive object={assets.model.group} />
        </group>
        <mesh geometry={assets.ribbon}>
          <meshBasicMaterial
            ref={ribbonRef}
            color="#fff1ae"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <points frustumCulled={false}>
        <bufferGeometry>
          <primitive object={trailPoints} attach="attributes-position" />
        </bufferGeometry>
        <pointsMaterial
          ref={trailGlowRef}
          map={assets.glow}
          size={14}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}

const OPENING_CAMERA = {
  position: [0, 0, 12] as [number, number, number],
  near: 0.1,
  far: 32,
};

export function OpeningThreeScene(props: OpeningSceneProps) {
  return (
    <div className="opening-three-scene" aria-hidden="true">
      <Canvas
        orthographic
        camera={OPENING_CAMERA}
        dpr={QUALITY[props.quality].dpr}
        gl={{ antialias: true, alpha: true }}
        frameloop={props.reducedMotion ? "demand" : "always"}
      >
        <OpeningWorld {...props} />
      </Canvas>
    </div>
  );
}
