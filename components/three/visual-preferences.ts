"use client";

import { useCallback, useEffect, useState } from "react";

export type QualityLevel = "high" | "standard" | "low";

const STORAGE_KEY = "cmg-visual-quality-v1";
const QUALITY_ORDER: QualityLevel[] = ["standard", "high", "low"];

function detectDefaultQuality(): QualityLevel {
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;

  if (
    hardwareConcurrency <= 4 ||
    (deviceMemory !== undefined && deviceMemory <= 4)
  ) {
    return "low";
  }
  if (
    hardwareConcurrency >= 10 &&
    (deviceMemory === undefined || deviceMemory >= 8)
  ) {
    return "high";
  }
  return "standard";
}

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }),
    );
  } catch {
    return false;
  }
}

export function useVisualPreferences() {
  const [quality, setQualityState] = useState<QualityLevel>("standard");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [visualReady, setVisualReady] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let savedQuality: string | null = null;
    try {
      savedQuality = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private browsing and locked-down storage must not block the experience.
    }
    const nextQuality =
      savedQuality === "high" ||
      savedQuality === "standard" ||
      savedQuality === "low"
        ? savedQuality
        : detectDefaultQuality();

    const initializationFrame = window.requestAnimationFrame(() => {
      setQualityState(nextQuality);
      setReducedMotion(motionQuery.matches);
      setWebglAvailable(supportsWebGl());
      setVisualReady(true);
    });

    const handleMotionChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    motionQuery.addEventListener("change", handleMotionChange);
    return () => {
      window.cancelAnimationFrame(initializationFrame);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  const cycleQuality = useCallback(() => {
    setQualityState((current) => {
      const currentIndex = QUALITY_ORDER.indexOf(current);
      const next = QUALITY_ORDER[(currentIndex + 1) % QUALITY_ORDER.length]!;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // The in-memory preference still works when persistent storage is unavailable.
      }
      return next;
    });
  }, []);

  return { quality, reducedMotion, webglAvailable, visualReady, cycleQuality };
}

export function qualityLabel(quality: QualityLevel) {
  if (quality === "high") return "高畫質";
  if (quality === "low") return "省電";
  return "標準";
}
