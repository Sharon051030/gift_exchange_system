"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { DrawResult, Participant } from "@/lib/demo-store";
import type { GiftPool } from "@/lib/draw-engine";
import {
  INITIAL_INTERACTION,
  interactionReducer,
  tapCountFor,
} from "@/lib/experience-machine";
import {
  CloseIcon,
  ExpandIcon,
  GiftIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "./Icons";
import {
  qualityLabel,
  useVisualPreferences,
  type QualityLevel,
} from "./three/visual-preferences";

const CoverThreeScene = dynamic(
  () =>
    import("./three/ChristmasThreeScene").then(
      (module) => module.CoverThreeScene,
    ),
  { ssr: false },
);
const StageAtmosphere = dynamic(
  () =>
    import("./three/ChristmasThreeScene").then(
      (module) => module.StageAtmosphere,
    ),
  { ssr: false },
);
const PunchThreeEffect = dynamic(
  () =>
    import("./three/ChristmasThreeScene").then(
      (module) => module.PunchThreeEffect,
    ),
  { ssr: false },
);
const RevealAtmosphere = dynamic(
  () =>
    import("./three/ChristmasThreeScene").then(
      (module) => module.RevealAtmosphere,
    ),
  { ssr: false },
);

type EventState = {
  eventName: string;
  pool: GiftPool;
  paused: boolean;
  total: number;
  openedCount: number;
  remaining: number;
  complete: boolean;
  currentDrawer: Participant;
  opened: DrawResult[];
  csrfToken: string;
};

type LoadStatus = "idle" | "loading" | "ready" | "error";
function usePaperSound(enabled: boolean) {
  return useCallback(
    (kind: "tap" | "reveal") => {
      if (!enabled || typeof window === "undefined") return;
      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "reveal" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(
        kind === "reveal" ? 660 : 120,
        context.currentTime,
      );
      if (kind === "reveal") {
        oscillator.frequency.exponentialRampToValueAtTime(
          990,
          context.currentTime + 0.24,
        );
      }
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + (kind === "reveal" ? 0.38 : 0.11),
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === "reveal" ? 0.4 : 0.12));
      oscillator.addEventListener("ended", () => void context.close());
    },
    [enabled],
  );
}

export function ChristmasExperience() {
  const [coverVisible, setCoverVisible] = useState(true);
  const [coverLeaving, setCoverLeaving] = useState(false);
  const [pool, setPool] = useState<GiftPool>("good");
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [interaction, dispatchInteraction] = useReducer(
    interactionReducer,
    INITIAL_INTERACTION,
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pauseBusy, setPauseBusy] = useState(false);
  const requestKeyRef = useRef("");
  const coverTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const playSound = usePaperSound(soundEnabled);
  const { quality, reducedMotion, webglAvailable, cycleQuality } =
    useVisualPreferences();

  const activeSlot = interaction.slotNumber;
  const tapCount = tapCountFor(interaction.phase);
  const committing = interaction.phase === "draw-pending";
  const revealVisible =
    interaction.phase === "reveal" || interaction.phase === "closing";

  useEffect(
    () => () => {
      if (coverTimerRef.current !== null) {
        window.clearTimeout(coverTimerRef.current);
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (interaction.phase !== "breaking") return;
    revealTimerRef.current = window.setTimeout(
      () => dispatchInteraction({ type: "SHOW_REVEAL" }),
      reducedMotion ? 20 : 760,
    );
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [interaction.phase, reducedMotion]);

  const loadState = useCallback(async (selectedPool: GiftPool) => {
    setLoadStatus("loading");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/event/state?pool=${selectedPool}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("活動狀態暫時無法載入。請再試一次。");
      const state = (await response.json()) as EventState;
      setEventState(state);
      setLoadStatus("ready");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "活動狀態暫時無法載入。請再試一次。",
      );
      setLoadStatus("error");
    }
  }, []);

  function enterStage(skipAnimation = false) {
    if (coverLeaving) return;
    setCoverLeaving(true);
    void loadState(pool);
    coverTimerRef.current = window.setTimeout(
      () => setCoverVisible(false),
      skipAnimation || reducedMotion ? 20 : 1320,
    );
  }

  function resetInteraction() {
    dispatchInteraction({ type: "RESET" });
    requestKeyRef.current = "";
  }

  function choosePool(nextPool: GiftPool) {
    if (
      nextPool === pool ||
      interaction.phase === "draw-pending" ||
      interaction.phase === "breaking" ||
      revealVisible
    ) {
      return;
    }
    resetInteraction();
    setPool(nextPool);
    void loadState(nextPool);
  }

  async function submitDraw(slotNumber: number) {
    if (!eventState) return;
    setErrorMessage("");
    try {
      const response = await fetch("/api/draws", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": eventState.csrfToken,
        },
        body: JSON.stringify({
          pool,
          slotNumber,
          idempotencyKey: requestKeyRef.current,
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        result?: DrawResult;
        state?: Omit<EventState, "csrfToken">;
      };
      if (!response.ok || !payload.result || !payload.state) {
        throw new Error(payload.message ?? "目前無法確認驚喜，請重試。");
      }
      setEventState({ ...payload.state, csrfToken: eventState.csrfToken });
      dispatchInteraction({ type: "DRAW_CONFIRMED", draw: payload.result });
      playSound("reveal");
    } catch (error) {
      dispatchInteraction({ type: "FAIL" });
      setErrorMessage(
        error instanceof Error ? error.message : "目前無法確認驚喜，請重試。",
      );
    }
  }

  function handleSlot(slotNumber: number, trigger: HTMLButtonElement) {
    if (
      !eventState ||
      eventState.paused ||
      eventState.complete ||
      interaction.phase === "draw-pending" ||
      interaction.phase === "breaking" ||
      revealVisible
    ) {
      return;
    }
    const opened = eventState.opened.find(
      (draw) => draw.slotNumber === slotNumber,
    );
    lastTriggerRef.current = trigger;
    if (opened) {
      dispatchInteraction({ type: "REPLAY", draw: opened });
      return;
    }
    if (activeSlot !== null && activeSlot !== slotNumber) return;
    if (interaction.phase === "ready") {
      requestKeyRef.current = crypto.randomUUID();
      dispatchInteraction({ type: "SELECT", slotNumber });
      playSound("tap");
      return;
    }
    if (interaction.phase === "hit-1") {
      dispatchInteraction({ type: "HIT_AGAIN" });
      playSound("tap");
      return;
    }
    if (interaction.phase === "hit-2") {
      dispatchInteraction({ type: "REQUEST_DRAW" });
      void submitDraw(slotNumber);
    }
  }

  async function togglePause() {
    if (!eventState || pauseBusy) return;
    setPauseBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/event/pause", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": eventState.csrfToken,
        },
        body: JSON.stringify({ paused: !eventState.paused }),
      });
      const payload = (await response.json()) as {
        paused?: boolean;
        message?: string;
      };
      if (!response.ok || typeof payload.paused !== "boolean") {
        throw new Error(payload.message ?? "暫停狀態無法更新。");
      }
      setEventState((current) =>
        current ? { ...current, paused: payload.paused! } : current,
      );
      if (payload.paused) resetInteraction();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "暫停狀態無法更新。",
      );
    } finally {
      setPauseBusy(false);
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setErrorMessage("瀏覽器目前無法切換全螢幕。");
    }
  }

  function closeReveal() {
    if (!revealVisible) return;
    dispatchInteraction({ type: "CLOSE" });
    revealTimerRef.current = window.setTimeout(
      () => {
        const trigger = lastTriggerRef.current;
        resetInteraction();
        window.requestAnimationFrame(() => trigger?.focus());
      },
      reducedMotion ? 20 : 220,
    );
  }

  if (coverVisible) {
    return (
      <Cover
        leaving={coverLeaving}
        onEnter={enterStage}
        quality={quality}
        reducedMotion={reducedMotion}
        webglAvailable={webglAvailable}
        onCycleQuality={cycleQuality}
      />
    );
  }

  if (loadStatus !== "ready" || !eventState) {
    return (
      <main className="loading-page">
        <div className="loading-gift" aria-hidden="true">
          <span />
        </div>
        <p>聖誕驚喜裝訂中……</p>
        {loadStatus === "error" ? (
          <div className="load-error" role="alert">
            <p>{errorMessage}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadState(pool)}
            >
              重新載入
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  const openedBySlot = new Map(
    eventState.opened.map((draw) => [draw.slotNumber, draw]),
  );

  return (
    <main className="stage-page">
      {webglAvailable ? (
        <StageAtmosphere quality={quality} reducedMotion={reducedMotion} />
      ) : null}
      <div className="stage-shell" inert={revealVisible ? true : undefined}>
        <header className="status-rail">
          <div className="stage-brand">
            <span className="brand-sprig" aria-hidden="true">
              ✦
            </span>
            {eventState.eventName}
          </div>
          <div className="pool-switch" aria-label="選擇禮物獎池">
            <button
              type="button"
              className={pool === "good" ? "active" : ""}
              aria-pressed={pool === "good"}
              onClick={() => choosePool("good")}
            >
              <GiftIcon />
              好禮物
            </button>
            <button
              type="button"
              className={pool === "bad" ? "active" : ""}
              aria-pressed={pool === "bad"}
              onClick={() => choosePool("bad")}
            >
              <GiftIcon />
              壞禮物
            </button>
          </div>
          <div className="status-fact">
            <span>目前抽獎者</span>
            <strong>{eventState.currentDrawer.name}</strong>
          </div>
          <div className="status-fact">
            <span>已揭曉</span>
            <strong>
              {eventState.openedCount} / {eventState.total}
            </strong>
          </div>
          <div className="rail-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={soundEnabled ? "關閉音效" : "開啟音效"}
              onClick={() => setSoundEnabled((value) => !value)}
            >
              <VolumeIcon />
              <span className="action-label">音效</span>
            </button>
            <button
              type="button"
              className="icon-button quality-button"
              aria-label={`切換特效品質，目前為${qualityLabel(quality)}`}
              onClick={cycleQuality}
            >
              <span aria-hidden="true">✦</span>
              <span className="action-label">{qualityLabel(quality)}</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="切換全螢幕"
              onClick={() => void toggleFullscreen()}
            >
              <ExpandIcon />
              <span className="action-label">全螢幕</span>
            </button>
            <button
              type="button"
              className="pause-button"
              disabled={pauseBusy}
              aria-busy={pauseBusy}
              onClick={() => void togglePause()}
            >
              {eventState.paused ? <PlayIcon /> : <PauseIcon />}
              <span>{eventState.paused ? "繼續" : "暫停"}</span>
            </button>
          </div>
        </header>

        <section className="stage-intro" aria-labelledby="wall-title">
          <div>
            <p className="stage-kicker">
              {pool === "good" ? "GOOD GIFT WALL" : "MYSTERY GIFT WALL"}
            </p>
            <h1 id="wall-title">選一份，連續戳三次</h1>
          </div>
          <div className="turn-instruction" aria-live="polite">
            {eventState.complete
              ? "本獎池已完成完整接棒循環"
              : activeSlot
                ? interaction.phase === "breaking"
                  ? `第 ${activeSlot} 格：包裝正式破裂`
                  : interaction.phase === "draw-pending"
                    ? `第 ${activeSlot} 格：正在向伺服器確認結果`
                    : `第 ${activeSlot} 格：已戳 ${tapCount} / 3 次`
                : `還有 ${eventState.remaining} 份驚喜等待揭曉`}
          </div>
        </section>

        {errorMessage ? (
          <div className="page-alert" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage("")}>
              關閉
            </button>
          </div>
        ) : null}

        {eventState.paused ? (
          <section className="pause-card" role="status">
            <span className="snow-mark" aria-hidden="true">
              ✦
            </span>
            <h2>活動暫停中</h2>
            <p>已完成的驚喜都好好保存著。處理完現場狀況後，再按「繼續」。</p>
          </section>
        ) : null}

        {eventState.complete ? (
          <section className="complete-card" role="status">
            <p>Merry Christmas</p>
            <h2>{pool === "good" ? "好禮物" : "壞禮物"}接棒完成</h2>
            <span>50 位參加者都已完成，循環回到起點。</span>
          </section>
        ) : null}

        <section
          className="gift-wall"
          aria-label={`${pool === "good" ? "好禮物" : "壞禮物"}格子牆`}
          aria-busy={committing}
        >
          {Array.from({ length: eventState.total }, (_, index) => {
            const slotNumber = index + 1;
            const opened = openedBySlot.get(slotNumber);
            const isActive = activeSlot === slotNumber;
            const lockedByOther = activeSlot !== null && !isActive;
            const slotState = opened
              ? "opened"
              : isActive
                ? interaction.phase
                : "unopened";
            const showPunchEffect =
              webglAvailable &&
              isActive &&
              (interaction.phase === "hit-1" ||
                interaction.phase === "hit-2" ||
                interaction.phase === "draw-pending" ||
                interaction.phase === "breaking");
            return (
              <button
                key={slotNumber}
                type="button"
                className={`gift-slot pattern-${index % 6} ${slotState}`}
                disabled={
                  !opened &&
                  (eventState.paused ||
                    eventState.complete ||
                    lockedByOther ||
                    committing ||
                    interaction.phase === "breaking")
                }
                aria-label={
                  opened
                    ? `第 ${slotNumber} 格，已揭曉 ${opened.provider.name}，按下可重播`
                    : `第 ${slotNumber} 格，${isActive ? `已戳 ${tapCount} 次` : "未開啟"}`
                }
                onClick={(event) => handleSlot(slotNumber, event.currentTarget)}
              >
                {opened ? (
                  <>
                    <span
                      className={`slot-avatar tone-${opened.provider.avatarTone}`}
                      aria-hidden="true"
                    >
                      {opened.provider.initials}
                    </span>
                    <span className="opened-name">{opened.provider.name}</span>
                  </>
                ) : (
                  <>
                    <span className="slot-depth" aria-hidden="true" />
                    <span className="slot-ribbon" aria-hidden="true" />
                    <span className="slot-number">
                      {String(slotNumber).padStart(2, "0")}
                    </span>
                    {!webglAvailable && isActive ? (
                      <span className="crack" aria-hidden="true" />
                    ) : null}
                    {showPunchEffect ? (
                      <PunchThreeEffect
                        phase={
                          interaction.phase as
                            "hit-1" | "hit-2" | "draw-pending" | "breaking"
                        }
                        quality={quality}
                        reducedMotion={reducedMotion}
                      />
                    ) : null}
                    {interaction.phase === "draw-pending" && isActive ? (
                      <span className="slot-status">向伺服器確認中</span>
                    ) : interaction.phase === "breaking" && isActive ? (
                      <span className="slot-status">驚喜揭曉</span>
                    ) : isActive ? (
                      <span className="slot-status">
                        再戳 {3 - tapCount} 次
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </section>

        {activeSlot !== null &&
        interaction.phase !== "draw-pending" &&
        interaction.phase !== "breaking" &&
        !revealVisible ? (
          <div className="punch-controls" role="status">
            <span>已選第 {activeSlot} 格，其他格子暫時鎖定。</span>
            <button type="button" onClick={resetInteraction}>
              換一份
            </button>
          </div>
        ) : null}

        <footer className="stage-footer">
          <span>展示資料 · 結果由伺服器決定</span>
          <span>
            {reducedMotion
              ? "系統已依偏好減少動態效果"
              : `Three.js 特效：${qualityLabel(quality)}`}
          </span>
        </footer>
      </div>

      {interaction.draw && revealVisible ? (
        <RevealDialog
          draw={interaction.draw}
          closing={interaction.phase === "closing"}
          onClose={closeReveal}
          quality={quality}
          reducedMotion={reducedMotion}
          webglAvailable={webglAvailable}
        />
      ) : null}
    </main>
  );
}

function Cover({
  leaving,
  onEnter,
  quality,
  reducedMotion,
  webglAvailable,
  onCycleQuality,
}: {
  leaving: boolean;
  onEnter: (skipAnimation?: boolean) => void;
  quality: QualityLevel;
  reducedMotion: boolean;
  webglAvailable: boolean;
  onCycleQuality: () => void;
}) {
  return (
    <main
      className={`cover-page cover-storybook ${leaving ? "is-leaving" : ""}`}
    >
      <div className="cover-frame" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <section className="cover-copy" aria-labelledby="cover-title">
        <div className="cover-edition">
          <span>互動聖誕故事</span>
          <span>NO. 50</span>
        </div>
        <div className="cover-heading">
          <span className="cover-star" aria-hidden="true">
            ✦
          </span>
          <h1 id="cover-title">
            Christmas
            <span>Mystery Gift</span>
          </h1>
          <p>拆開禮物之前，先拆開今天的驚喜。</p>
        </div>
        <div className="cover-actions">
          <button
            className="primary-cta"
            type="button"
            disabled={leaving}
            onClick={() => onEnter(false)}
          >
            {leaving ? "穿越包裝紙中…" : "開啟聖誕驚喜"}
          </button>
          <button
            className="skip-link"
            type="button"
            disabled={leaving}
            onClick={() => onEnter(true)}
          >
            略過轉場
          </button>
        </div>
        <div className="cover-utility">
          <button type="button" onClick={onCycleQuality}>
            特效：{reducedMotion ? "減少動態" : qualityLabel(quality)}
          </button>
          <Link className="admin-entry" href="/admin">
            主持控制台
          </Link>
        </div>
      </section>

      <section className={`cover-theater ${webglAvailable ? "has-webgl" : ""}`}>
        <div className="theater-caption">
          <span>THE PAPER THEATER</span>
          <strong>一份會回應你的禮物</strong>
        </div>
        <Image
          className="cover-fallback-image"
          src="/assets/hero-gift.png"
          alt="紅色緞帶與復古包裝紙裝飾的聖誕禮物盒"
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 820px) 94vw, 54vw"
        />
        {webglAvailable ? (
          <CoverThreeScene
            quality={quality}
            reducedMotion={reducedMotion}
            leaving={leaving}
          />
        ) : null}
        <div className="theater-seal" aria-hidden="true">
          <span>CMG</span>
          <small>2026</small>
        </div>
      </section>
      <div className="torn-horizon" aria-hidden="true" />
      <div className="paper-transition" aria-hidden="true">
        <span />
        <span />
      </div>
    </main>
  );
}

function RevealDialog({
  draw,
  closing,
  onClose,
  quality,
  reducedMotion,
  webglAvailable,
}: {
  draw: DrawResult;
  closing: boolean;
  onClose: () => void;
  quality: QualityLevel;
  reducedMotion: boolean;
  webglAvailable: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button, [href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (reducedMotion || !cardRef.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("gsap").then(({ gsap }) => {
      if (cancelled || !cardRef.current) return;
      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .fromTo(
            cardRef.current,
            { opacity: 0, y: 34, rotateY: -12, scale: 0.94 },
            { opacity: 1, y: 0, rotateY: 0, scale: 1, duration: 0.62 },
          )
          .fromTo(
            ".postcard-photo",
            { rotateY: 88, x: -34 },
            { rotateY: 0, x: 0, duration: 0.64 },
            "-=0.38",
          )
          .fromTo(
            ".postcard-copy > *",
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.32, stagger: 0.065 },
            "-=0.28",
          );
      }, dialogRef);
      cleanup = () => context.revert();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  return (
    <div
      className={`reveal-backdrop ${closing ? "is-closing" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {webglAvailable ? (
        <RevealAtmosphere quality={quality} reducedMotion={reducedMotion} />
      ) : null}
      <div
        className="reveal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-name"
        aria-describedby="reveal-message"
        ref={dialogRef}
      >
        <div className="reveal-card-inner" ref={cardRef}>
          <button
            ref={closeRef}
            className="dialog-close"
            type="button"
            aria-label="關閉揭曉卡"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
          <div className="postcard-photo">
            <span
              className={`portrait tone-${draw.provider.avatarTone}`}
              aria-hidden="true"
            >
              {draw.provider.initials}
            </span>
            <small>
              FROM GIFT NO. {String(draw.slotNumber).padStart(2, "0")}
            </small>
          </div>
          <div className="postcard-copy">
            <div className="holly-mark" aria-hidden="true">
              ✦
            </div>
            <h2 id="reveal-name">{draw.provider.name}</h2>
            <p id="reveal-message">{draw.provider.message}</p>
            <div className="next-drawer">下一棒：{draw.provider.name}</div>
            <span className="draw-caption">
              {draw.drawer.name} 抽中了這份
              {draw.pool === "good" ? "好禮物" : "壞禮物"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
