import * as THREE from "three";

export function createOrbitHalo(
  orbitPoint: (t: number, point: THREE.Vector3) => THREE.Vector3,
) {
  const segments = 160;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const center = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const behind = new THREE.Vector3();

  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    orbitPoint(t, center);
    orbitPoint(Math.min(1, t + 0.003), ahead);
    orbitPoint(Math.max(0, t - 0.003), behind);
    const tangent = ahead.sub(behind);
    const halfWidth = (0.18 + t * 0.11) / Math.hypot(tangent.x, tangent.y);
    for (const side of [-1, 1]) {
      positions.push(
        center.x - tangent.y * halfWidth * side,
        center.y + tangent.x * halfWidth * side,
        center.z + 0.1,
      );
      uvs.push(t, (side + 1) / 2);
    }
    if (index < segments) {
      const i = index * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    toneMapped: false,
    vertexShader: `
      varying vec2 haloUV;
      void main() {
        haloUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float progress;
      uniform float time;
      varying vec2 haloUV;
      void main() {
        float along = haloUV.x;
        float across = abs(haloUV.y * 2.0 - 1.0);
        float endFade = smoothstep(0.0, 0.07, along) * (1.0 - smoothstep(0.91, 1.0, along));
        float reveal = smoothstep(0.0, 0.13, progress - along) * endFade;
        float mist = (1.0 - smoothstep(0.0, 1.0, across)) * exp(-3.6 * across * across);
        float drift = 0.78 + 0.12 * sin(along * 31.0 - time * 1.45) + 0.10 * sin(along * 53.0 + time * 0.74);
        vec3 honey = mix(vec3(1.0, 0.37, 0.035), vec3(1.0, 0.64, 0.13), 1.0 - across);
        gl_FragColor = vec4(honey, mist * drift * reveal * 0.46);
        #include <colorspace_fragment>
      }
    `,
  });
  return { geometry, material };
}

export function createSparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: 1 },
      bloom: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      uniform float time;
      uniform float pixelRatio;
      uniform float bloom;
      attribute vec3 spark;
      varying float pulse;
      varying float heat;
      void main() {
        float wave = 0.5 + 0.5 * sin(time * spark.z + spark.y);
        pulse = 0.37 + 0.63 * pow(wave, 2.0);
        heat = spark.x;
        float diameter = mix(7.5, 37.0, heat) * (0.91 + bloom * 0.17 + pulse * 0.13);
        gl_PointSize = diameter * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float pulse;
      varying float heat;
      void main() {
        float radius = length(gl_PointCoord * 2.0 - 1.0);
        float falloff = 1.0 - smoothstep(0.48, 1.0, radius);
        float haze = exp(-4.8 * radius * radius) * falloff;
        float body = exp(-16.0 * radius * radius);
        float core = exp(-43.0 * radius * radius);
        vec3 gold = mix(vec3(0.98, 0.26, 0.026), vec3(1.0, 0.65, 0.18), body);
        vec3 color = mix(gold, vec3(1.0, 0.99, 0.92), core);
        float alpha = (0.42 * haze + 0.47 * body + 0.94 * core) * pulse * (0.93 + 0.07 * heat);
        gl_FragColor = vec4(color, min(alpha, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

export function updateOpeningLights(
  sparks: THREE.ShaderMaterial,
  halo: THREE.ShaderMaterial,
  time: number,
  pixelRatio: number,
  flightPulse: number,
  orbitProgress: number,
) {
  sparks.uniforms.time.value = halo.uniforms.time.value = time;
  sparks.uniforms.pixelRatio.value = pixelRatio;
  sparks.uniforms.bloom.value = flightPulse;
  // Let the soft leading edge travel fully off the last segment.
  halo.uniforms.progress.value = orbitProgress * 1.13;
}
