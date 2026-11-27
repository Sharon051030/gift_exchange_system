import * as THREE from "three";

export function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function paperVariation(gridSize: number, random: () => number) {
  const cells = Array.from({ length: gridSize ** 2 }, random);
  const cell = (x: number, y: number) =>
    cells[(y % gridSize) * gridSize + (x % gridSize)];
  return (u: number, v: number) => {
    const x = u * gridSize;
    const y = v * gridSize;
    const left = Math.floor(x);
    const top = Math.floor(y);
    const tx = THREE.MathUtils.smoothstep(x - left, 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - top, 0, 1);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(cell(left, top), cell(left + 1, top), tx),
      THREE.MathUtils.lerp(cell(left, top + 1), cell(left + 1, top + 1), tx),
      ty,
    );
  };
}

export function paperCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  const random = seededRandom(821);
  const size = canvas.width;
  const data = ctx.createImageData(size, size);
  const pulp = paperVariation(19, random);
  const flecks = paperVariation(53, random);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const grain =
        pulp(x / size, y / size) * 0.65 + flecks(x / size, y / size) * 0.35;
      const shade = 226 + (grain - 0.5) * 42 + (random() - 0.5) * 75;
      data.data[index] = data.data[index + 1] = data.data[index + 2] = shade;
      data.data[index + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  ctx.lineWidth = 0.65;
  for (let i = 0; i < 1450; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 2 + random() * 9;
    const angle = random() * Math.PI * 2;
    ctx.strokeStyle = i % 3 ? "#44301336" : "#ffffff80";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + length * 0.25,
      y - length * 0.35,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
    );
    ctx.stroke();
  }
  return canvas;
}

export function candyMap(grain: HTMLCanvasElement, red: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5d99d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = red;
  for (let i = -1; i < 9; i++) {
    const x = 38 + i * 181;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 82, 0);
    ctx.lineTo(x - 99, 256);
    ctx.lineTo(x - 181, 256);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.63;
  ctx.fillStyle = ctx.createPattern(grain, "repeat")!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createContactTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, "#614019b0");
  gradient.addColorStop(0.35, "#79502082");
  gradient.addColorStop(0.7, "#81562730");
  gradient.addColorStop(1, "#81562700");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function readOpeningPalette() {
  const style = getComputedStyle(document.documentElement);
  return {
    berry: style.getPropertyValue("--berry").trim(),
    pine: style.getPropertyValue("--pine").trim(),
    olive: style.getPropertyValue("--olive").trim(),
    gold: style.getPropertyValue("--antique-gold").trim(),
    ivory: style.getPropertyValue("--paper-raised").trim(),
  };
}
