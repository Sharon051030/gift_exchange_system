import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { readOpeningPalette, seededRandom } from "./opening-materials";

type Palette = ReturnType<typeof readOpeningPalette>;
type Point = [number, number, number];

// The tiny, deterministic colour variation is baked per triangle, like folded card.
function facets(
  geometry: THREE.BufferGeometry,
  contrast: number,
  seed: number,
) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const size = flat.attributes.position.count;
  const colors = new Float32Array(size * 3);
  const random = seededRandom(seed);
  for (let i = 0; i < size; i += 3) {
    const shade = 1 - random() * contrast;
    colors.fill(shade, i * 3, (i + 3) * 3);
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

export function candyGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, -1.78, 0),
    new THREE.Vector3(-0.35, -1.46, 0),
    new THREE.Vector3(-0.35, 0.64, 0),
    new THREE.Vector3(-0.22, 1.24, 0),
    new THREE.Vector3(0.16, 1.55, 0),
    new THREE.Vector3(0.62, 1.54, 0),
    new THREE.Vector3(0.97, 1.23, 0),
    new THREE.Vector3(1.04, 0.8, 0),
    new THREE.Vector3(1.0, 0.51, 0),
  ]);
  const segments = 40;
  const sides = 10;
  const tube = new THREE.TubeGeometry(curve, segments, 0.269, sides, false);
  const { position } = tube.attributes;
  for (let i = 0; i <= segments; i++) {
    const fromTip = Math.min(i, segments - i);
    if (fromTip >= 2) continue;
    const center = curve.getPointAt(i / segments);
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      const point = new THREE.Vector3().fromBufferAttribute(position, index);
      point.lerp(center, fromTip === 0 ? 1 : 0.13);
      position.setXYZ(index, point.x, point.y, point.z);
    }
  }
  return facets(tube, 0.16, 206);
}

export function starGeometry(radius: number) {
  const ring = Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = radius * (i % 2 === 0 ? 1 : 0.43);
    return [Math.cos(angle) * r, Math.sin(angle) * r, 0] satisfies Point;
  });
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < ring.length; i++) {
      const points: Point[] = [
        [0, 0, side * radius * 0.26],
        ring[i],
        ring[(i + 1) % ring.length],
      ];
      if (side < 0) points.reverse();
      for (const [x, y, z] of points) {
        positions.push(x, y, z);
        uvs.push(0.5 + x / radius / 2, 0.5 + y / radius / 2);
      }
    }
  }
  return facets(triangles(positions, uvs), 0.29, 416);
}

function triangles(positions: number[], uvs: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function foliageGeometry(radius: number, height: number, seed: number) {
  const random = seededRandom(seed);
  const sides = 10;
  const ridge = Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2;
    const r = radius * (i % 2 === 0 ? 1 : 0.84) * (0.95 + random() * 0.1);
    return [
      Math.cos(angle) * r,
      i % 2 === 0 ? 0 : height * 0.16,
      Math.sin(angle) * r,
    ] satisfies Point;
  });
  const fold = ridge.map(
    ([x, , z], i) =>
      [
        x * 0.56,
        height * (i % 2 === 0 ? 0.54 : 0.43),
        z * 0.56,
      ] satisfies Point,
  );
  const positions: number[] = [];
  const uvs: number[] = [];
  const tip: Point = [0.03, height, 0];
  const underside: Point = [0, -height * 0.16, 0];
  const add = (...points: Point[]) => {
    for (const [x, y, z] of points) {
      positions.push(x, y, z);
      uvs.push((x + 0.58 * z) / 1.8, (y + 0.42 * z) / 1.5);
    }
  };
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    add(tip, fold[next], fold[i]);
    add(fold[i], fold[next], ridge[i]);
    add(fold[next], ridge[next], ridge[i]);
    add(underside, ridge[i], ridge[next]);
  }
  return facets(triangles(positions, uvs), 0.36, seed);
}

function bowGeometry(side: number) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(side * 0.15, 0.19, -0.06),
    new THREE.Vector3(side * 0.34, 0.27, -0.02),
    new THREE.Vector3(side * 0.37, 0.13, 0.065),
    new THREE.Vector3(side * 0.18, 0.035, 0.055),
    new THREE.Vector3(0, 0.02, 0),
  ]);
  const positions: number[] = [];
  const uvs: number[] = [];
  const segments = 10;
  function edge(index: number, sign: number) {
    const t = index / segments;
    const p = curve.getPoint(t);
    const width = 0.032 + 0.061 * Math.sin(t * Math.PI);
    positions.push(p.x, p.y + width * sign * 0.9, p.z + width * sign * 0.82);
    uvs.push(t, sign === 1 ? 1 : 0);
  }
  for (let i = 0; i < segments; i++) {
    edge(i, -1);
    edge(i + 1, -1);
    edge(i, 1);
    edge(i, 1);
    edge(i + 1, -1);
    edge(i + 1, 1);
  }
  return facets(triangles(positions, uvs), 0.18, 91);
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Point,
) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  return part;
}

function gift(
  width: number,
  height: number,
  depth: number,
  paper: THREE.Material,
  ribbon: THREE.Material,
) {
  const result = new THREE.Group();
  const lid = 0.17;
  const box = (
    dimensions: Point,
    material: THREE.Material,
    position: Point,
    radius: number,
  ) =>
    mesh(
      facets(new RoundedBoxGeometry(...dimensions, 1, radius), 0.13, 335),
      material,
      position,
    );

  result.add(
    box([width, height, depth], paper, [0, height / 2, 0], 0.04),
    box(
      [width + 0.065, lid, depth + 0.065],
      paper,
      [0, height - 0.012, 0],
      0.028,
    ),
  );
  for (const face of [-1, 1]) {
    result.add(
      box(
        [width * 0.16, height, 0.009],
        ribbon,
        [0, height / 2, face * (depth / 2 + 0.002)],
        0.004,
      ),
      box(
        [0.009, height, depth * 0.16],
        ribbon,
        [face * (width / 2 + 0.002), height / 2, 0],
        0.004,
      ),
      box(
        [width * 0.16, lid, 0.009],
        ribbon,
        [0, height - 0.012, face * (depth / 2 + 0.035)],
        0.004,
      ),
      box(
        [0.009, lid, depth * 0.16],
        ribbon,
        [face * (width / 2 + 0.035), height - 0.012, 0],
        0.004,
      ),
    );
  }
  const top = height - 0.012 + lid / 2;
  result.add(
    box(
      [width * 0.16, 0.012, depth + 0.065],
      ribbon,
      [0, top + 0.005, 0],
      0.005,
    ),
    box(
      [width + 0.065, 0.013, depth * 0.16],
      ribbon,
      [0, top + 0.008, 0],
      0.005,
    ),
    box([0.15, 0.11, 0.15], ribbon, [0, top + 0.056, 0], 0.029),
    mesh(bowGeometry(-1), ribbon, [0, top + 0.018, 0]),
    mesh(bowGeometry(1), ribbon, [0, top + 0.018, 0]),
  );
  return result;
}

export function createChristmasModel(
  palette: Palette,
  paper: THREE.Texture,
  shadow: THREE.Texture,
) {
  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];
  const shadows: { material: THREE.MeshBasicMaterial; opacity: number }[] = [];
  function surface(
    color: string | THREE.Color,
    roughness: number,
    bump = 0.042,
    metalness = 0,
  ) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      map: paper,
      bumpMap: paper,
      bumpScale: bump,
      vertexColors: true,
      flatShading: true,
    });
    materials.push(mat);
    return mat;
  }
  const pine = new THREE.Color(palette.pine).lerp(
    new THREE.Color(palette.olive),
    0.54,
  );
  const foliage = surface(pine, 0.91, 0.055);
  const wood = surface("#87572d", 0.94, 0.08);
  const red = surface(palette.berry, 0.85);
  const ivory = surface("#e5c696", 0.82);
  const gold = surface("#e6ac4a", 0.47, 0.022, 0.15);
  const goldRibbon = surface(palette.gold, 0.54, 0.024, 0.1);
  const ivoryRibbon = surface(palette.ivory, 0.66, 0.02);
  const redRibbon = surface(palette.berry, 0.57, 0.02);
  for (const ribbon of [goldRibbon, ivoryRibbon, redRibbon])
    ribbon.side = THREE.DoubleSide;

  function contact(
    x: number,
    z: number,
    width: number,
    depth: number,
    opacity: number,
  ) {
    const material = new THREE.MeshBasicMaterial({
      map: shadow,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    shadows.push({ material, opacity });
    const plane = mesh(new THREE.PlaneGeometry(width, depth), material, [
      x,
      -2.46,
      z,
    ]);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);
  }

  contact(0.4, -0.25, 6.4, 4, 0.82);
  group.add(
    mesh(
      facets(new THREE.CylinderGeometry(0.3, 0.43, 1.24, 8, 3), 0.25, 73),
      wood,
      [0, -1.83, 0],
    ),
  );
  const tiers = [
    [1.84, 1.92, -1.44],
    [1.52, 1.66, -0.63],
    [1.18, 1.36, 0.23],
    [0.82, 1.16, 0.98],
    [0.48, 0.92, 1.68],
  ];
  tiers.forEach(([radius, height, y], index) => {
    const tier = mesh(
      foliageGeometry(radius, height, 89 + index * 387),
      foliage,
      [0, y, 0],
    );
    tier.rotation.y = index * 0.33 + 0.17;
    group.add(tier);
  });
  group.add(mesh(starGeometry(0.43), gold, [0, 2.76, 0.07]));

  const ornaments: {
    position: Point;
    type: "ball" | "drop";
    material: THREE.Material;
    size: number;
  }[] = [
    { position: [0.37, 1.28, 0.68], type: "drop", material: gold, size: 0.13 },
    { position: [-0.49, 0.88, 0.89], type: "ball", material: red, size: 0.2 },
    { position: [0.62, 0.02, 1.13], type: "drop", material: gold, size: 0.16 },
    {
      position: [-0.76, -0.12, 1.27],
      type: "ball",
      material: ivory,
      size: 0.18,
    },
    { position: [0.83, -0.87, 1.54], type: "ball", material: red, size: 0.22 },
    {
      position: [-0.52, -1.08, 1.74],
      type: "drop",
      material: gold,
      size: 0.14,
    },
  ];
  ornaments.forEach(({ position: [x, y, z], type, material, size }, i) => {
    const shape =
      type === "ball"
        ? new THREE.IcosahedronGeometry(size, 1)
        : new THREE.OctahedronGeometry(size);
    const ornament = mesh(facets(shape, 0.24, 175 + i), material, [x, y, z]);
    if (type === "drop") ornament.scale.y = 1.72;
    group.add(
      ornament,
      mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 5), gold, [
        x,
        y + size * (type === "ball" ? 1 : 1.7) + 0.12,
        z,
      ]),
      mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.062, 6), gold, [
        x,
        y + size * (type === "ball" ? 1 : 1.7),
        z,
      ]),
    );
  });

  const packages = [
    {
      x: -1.63,
      z: 0.65,
      w: 1.12,
      h: 1.04,
      d: 0.89,
      color: red,
      ribbon: ivoryRibbon,
      rotation: -0.22,
    },
    {
      x: 1.51,
      z: 0.69,
      w: 1.04,
      h: 0.91,
      d: 0.92,
      color: ivory,
      ribbon: goldRibbon,
      rotation: 0.2,
    },
    {
      x: -0.75,
      z: 1.46,
      w: 0.96,
      h: 0.65,
      d: 0.73,
      color: ivory,
      ribbon: redRibbon,
      rotation: -0.13,
    },
    {
      x: 0.91,
      z: 1.55,
      w: 0.97,
      h: 0.66,
      d: 0.76,
      color: red,
      ribbon: ivoryRibbon,
      rotation: 0.18,
    },
    {
      x: 0.05,
      z: 1.97,
      w: 1.22,
      h: 0.4,
      d: 0.74,
      color: foliage,
      ribbon: goldRibbon,
      rotation: -0.08,
    },
  ];
  packages.forEach(({ x, z, w, h, d, color, ribbon, rotation }) => {
    const box = gift(w, h, d, color, ribbon);
    box.position.set(x, -2.44, z);
    box.rotation.y = rotation;
    group.add(box);
    contact(x + 0.16, z - 0.08, w * 2.3, d * 2, 0.7);
  });
  group.traverse((part) => {
    if (
      part instanceof THREE.Mesh &&
      part.material instanceof THREE.MeshStandardMaterial
    ) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });

  // A depth-only copy keeps the outer silhouette intact during the opacity fade.
  const depthMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    side: THREE.DoubleSide,
  });
  const depth = group.clone(true);
  depth.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.visible = part.material instanceof THREE.MeshStandardMaterial;
    part.material = depthMaterial;
  });
  depth.visible = false;
  return { group, materials, shadows, depth, depthMaterial };
}
