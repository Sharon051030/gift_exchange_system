"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getOpeningFrame,
  OPENING_TIMELINE,
  segmentProgress,
} from "@/lib/opening-experience";
import {
  createOrbitHalo,
  createSparkMaterial,
  updateOpeningLights,
} from "./opening-light-effects";
import {
  candyMap,
  createContactTexture,
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
  inView: boolean;
  onSceneReady: (grain: string) => void;
  onProgress: (background: number, copy: number) => void;
  onComplete: () => void;
};

const FRAME_HEIGHT = 7;
const QUALITY = {
  high: { dpr: 1.65, motes: 220 },
  standard: { dpr: 1.35, motes: 170 },
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

function growSection(section: THREE.Object3D, progress: number) {
  section.visible = progress > 0;
  section.scale.set(1, Math.max(0.01, progress), 1);
}

function assembleModel(
  model: ReturnType<typeof createChristmasModel>,
  tree: number,
  gifts: number,
) {
  model.group.visible = tree > 0;
  const star = fade(tree / 0.17);
  model.star.visible = star > 0;
  model.star.scale.setScalar(Math.max(0.01, star));
  model.branches.forEach((branch, index) =>
    growSection(branch, fade((tree - 0.13 - index * 0.142) / 0.22)),
  );
  model.baubles.forEach((bauble, index) => {
    const show = fade((tree - 0.44 - index * 0.077) / 0.12);
    bauble.visible = show > 0;
    bauble.scale.setScalar(Math.max(0.01, show));
  });
  growSection(model.trunk, fade((tree - 0.77) / 0.23));
  setOpacity(
    model.ground.material,
    model.ground.opacity * fade((tree - 0.7) / 0.3),
  );

  model.presents.forEach(({ box, x, z, rotation, contactShadow }, index) => {
    const delay = index * 0.095;
    const t = segmentProgress(gifts, { start: delay, end: delay + 0.62 });
    const spread = 1 - (1 - t) ** 2;
    const rise =
      t < 0.79
        ? Math.sin((Math.PI * t) / 0.79) * (0.42 + index * 0.043)
        : Math.sin((Math.PI * (t - 0.79)) / 0.21) * 0.075;
    box.visible = t > 0;
    box.position.set(
      x * spread,
      -2.44 + rise,
      THREE.MathUtils.lerp(0.38, z, spread),
    );
    box.rotation.set(
      0,
      rotation * spread,
      Math.sign(x) * 0.24 * Math.sin(Math.PI * t),
    );
    box.scale.setScalar(THREE.MathUtils.lerp(0.16, 1, fade(t / 0.64)));
    setOpacity(
      contactShadow.material,
      contactShadow.opacity * fade((t - 0.5) / 0.5),
    );
  });
}

function makeFlight(
  width: number,
  artX: number,
  artY: number,
  artScale: number,
) {
  const points = Array.from({ length: 22 }, (_, i) => {
    const p = i / 21;
    const angle = 2.35 - Math.PI * 2 * 1.48 * p;
    return new THREE.Vector3(
      Math.cos(angle) * width * 0.176 * p,
      Math.sin(angle) * 2.05 * p,
      p * 0.34,
    );
  });
  points.push(
    new THREE.Vector3(artX + artScale * 1.03, artY - artScale * 0.3, 0.24),
    new THREE.Vector3(artX + artScale * 0.57, artY + artScale * 1.84, 0.22),
    new THREE.Vector3(artX, artY + artScale * 2.45, 0.18),
  );
  return new THREE.CatmullRomCurve3(points);
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
  const halo = createOrbitHalo(garlandPoint);
  const sparkMaterial = createSparkMaterial();
  const random = seededRandom(491);
  const sparkSeeds = Array.from({ length: count }, (_, index) => ({
    phase: random(),
    x: random() * 2 - 1,
    y: random() * 2 - 1,
    depth: random(),
    spread: index % 3 ? 0.11 + random() * 0.22 : 0.25 + random() * 0.61,
  }));
  const sparkStyle = new THREE.Float32BufferAttribute(
    sparkSeeds.flatMap(({ phase, depth, x }, index) => [
      index % 11 === 0 ? 0.76 + depth * 0.24 : depth ** 2 * 0.63,
      phase * Math.PI * 2,
      1.0 + (1 + x) * 1.85,
    ]),
    3,
  );
  return {
    grain: grain.toDataURL("image/png"),
    paper,
    candyTexture,
    contact,
    model,
    candy,
    candyMaterial,
    star,
    starMaterial,
    halo,
    sparkMaterial,
    sparkStyle,
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
  reducedMotion,
  onSceneReady,
  onProgress,
  onComplete,
}: OpeningSceneProps) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const count = QUALITY[quality].motes;
  const assets = useMemo(() => createOpeningAssets(count), [count]);
  const particles = useMemo(() => makePoints(count), [count]);
  const initialParticles = useMemo(() => new Float32Array(count * 3), [count]);
  const nowPoint = useMemo(() => new THREE.Vector3(), []);
  const sample = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);
  const heroRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
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
    () => makeFlight(width, artX, artY, artScale),
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
        assets.halo.geometry,
      ]);
      const materials = new Set<THREE.Material>([
        assets.candyMaterial,
        assets.starMaterial,
        assets.halo.material,
        assets.sparkMaterial,
      ]);
      assets.model.group.traverse((part) => {
        if (part instanceof THREE.Mesh) {
          geometries.add(part.geometry);
          if (part.material instanceof THREE.Material)
            materials.add(part.material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      for (const texture of [assets.paper, assets.candyTexture, assets.contact])
        texture.dispose();
    },
    [assets],
  );

  useFrame(({ clock, gl }) => {
    const hero = heroRef.current;
    const stars = starsRef.current;
    if (!hero || !stars) return;

    const time = reducedMotion ? 0 : clock.elapsedTime;
    if (mode === "playing" && startRef.current === null) {
      startRef.current = time;
      // Keep the exact positions from the last loading frame as the launch pose.
      initialParticles.set(particles.array);
    }
    const elapsed =
      mode === "ready"
        ? OPENING_TIMELINE.total
        : time - (startRef.current ?? time);
    const frame = getOpeningFrame(elapsed);
    const dissolve = smooth(frame.dissolve);
    const travel = smooth(frame.flight);
    const skyFade = 1 - fade(frame.background * 1.5);
    const { model, candyMaterial, starMaterial, sparkSeeds } = assets;

    hero.visible = frame.dissolve < 1;
    if (hero.visible) {
      if (mode === "loading")
        loadingAngleRef.current = -0.22 + Math.sin(time * 2.05) * 0.08;
      flight.getPointAt(travel, nowPoint);
      const scale =
        candyScale * THREE.MathUtils.lerp(1, 0.16, smooth(frame.flight));
      hero.position.copy(nowPoint);
      hero.scale.setScalar(scale);
      hero.rotation.set(
        -0.08,
        -0.14 + Math.sin(travel * Math.PI) * 0.66,
        loadingAngleRef.current - travel * Math.PI * 2.5,
      );
      setOpacity(candyMaterial, 1 - dissolve);
    }

    stars.visible = skyFade > 0;
    if (stars.visible) setOpacity(starMaterial, skyFade);

    if (mode === "loading") {
      for (let i = 0; i < particles.count; i++) {
        const seed = sparkSeeds[i];
        const radius = 0.4 + seed.depth * 0.6;
        particles.setXYZ(
          i,
          seed.x * Math.min(width * 0.36, 3.5) * radius +
            Math.sin(time + seed.phase * 8) * 0.12,
          seed.y * 2.75 * radius +
            Math.cos(time * 0.75 + seed.phase * 11) * 0.14,
          -0.22 + seed.depth * 0.24,
        );
      }
    }

    assembleModel(model, frame.tree, frame.gifts);
    const garland = smooth(frame.garland);
    updateOpeningLights(
      assets.sparkMaterial,
      assets.halo.material,
      time,
      gl.getPixelRatio(),
      Math.sin(Math.PI * frame.flight),
      garland,
    );

    if (mode !== "loading") {
      for (let i = 0; i < count; i++) {
        const seed = sparkSeeds[i];
        const drift = Math.sin(time * 1.6 + seed.depth * 10) * 0.034;
        const lag =
          (0.018 + seed.phase * 0.16) * Math.sin((travel * Math.PI) / 2);
        flight.getPointAt(Math.max(0, travel - lag), sample);
        const spread = seed.spread * 0.4;
        sample.set(
          sample.x + seed.x * spread + drift,
          sample.y + seed.y * spread,
          sample.z + seed.depth * 0.3,
        );
        const gather = fade(frame.gather * (1 + seed.depth * 0.55));
        sample.lerp(destination.fromArray(initialParticles, i * 3), 1 - gather);

        const settle = fade((frame.garland - seed.phase * 0.35) / 0.65);
        const orbitPosition = THREE.MathUtils.clamp(
          seed.phase * garland + drift,
          0,
          1,
        );
        garlandPoint(orbitPosition, destination);
        destination.set(
          artX + (destination.x + seed.x * seed.spread * 0.75) * artScale,
          artY + (destination.y + seed.y * seed.spread * 0.75) * artScale,
          (destination.z + 0.22 + seed.depth * seed.spread) * artScale,
        );
        sample.lerp(destination, settle);
        particles.setXYZ(i, sample.x, sample.y, sample.z);
      }
    }
    updatePoints(particles);

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
      <hemisphereLight args={["#fff3d3", "#896344", 1.05]} />
      <ambientLight color="#ffe6b8" intensity={0.22} />
      <directionalLight
        position={[-5.8, 7, 4.5]}
        intensity={4.15}
        color="#ffedc0"
        castShadow={quality !== "low"}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-far={28}
        shadow-normalBias={0.028}
        shadow-bias={-0.0003}
        shadow-radius={3}
      />
      <directionalLight position={[3, 2, 4]} intensity={0.46} color="#f2dfb1" />
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
      </group>
      <group position={[artX, artY, 0]} scale={artScale}>
        <group rotation={[0.15, 0, 0]}>
          <primitive object={assets.model.group} />
        </group>
        <mesh
          geometry={assets.halo.geometry}
          material={assets.halo.material}
          renderOrder={1}
        />
      </group>
      <points
        material={assets.sparkMaterial}
        frustumCulled={false}
        renderOrder={2}
      >
        <bufferGeometry>
          <primitive object={particles} attach="attributes-position" />
          <primitive object={assets.sparkStyle} attach="attributes-spark" />
        </bufferGeometry>
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
        shadows={props.quality === "low" ? false : "percentage"}
        gl={{ antialias: true, alpha: true }}
        frameloop={props.reducedMotion || !props.inView ? "demand" : "always"}
      >
        <OpeningWorld {...props} />
      </Canvas>
    </div>
  );
}
