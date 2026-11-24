"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DrawResult, Participant } from "@/lib/demo-store";
import type { GiftPool } from "@/lib/draw-engine";
import { PauseIcon, PlayIcon } from "./Icons";

type ModuleId =
  "overview" | "participants" | "gifts" | "control" | "exceptions" | "records";

type ParticipantRow = Participant & {
  attendance: string;
  goodDrawStatus: string;
  badDrawStatus: string;
  goodGiftStatus: string;
  badGiftStatus: string;
};

type GiftRow = {
  id: string;
  pool: GiftPool;
  inventoryNumber: string;
  provider: Participant;
  inventoryStatus: string;
  assignmentStatus: string;
  slotNumber: number | null;
  drawerName: string | null;
};

type PoolSummary = {
  eventName: string;
  pool: GiftPool;
  paused: boolean;
  total: number;
  openedCount: number;
  remaining: number;
  complete: boolean;
  currentDrawer: Participant;
  opened: DrawResult[];
  completedDrawerIds: string[];
  startParticipantId: string;
};

type AdminData = {
  event: {
    name: string;
    status: string;
    rulesVersion: string;
    participantCount: number;
    updatedAt: string;
  };
  paused: boolean;
  pools: Record<GiftPool, PoolSummary>;
  participants: ParticipantRow[];
  gifts: GiftRow[];
  auditLogs: Array<{
    id: string;
    createdAt: string;
    actor: string;
    action: string;
    target: string;
    detail: string;
    outcome: string;
  }>;
  health: {
    blockingIssues: string[];
    warnings: string[];
    connection: string;
    pendingCorrections: number;
    absentParticipants: number;
    missingGifts: number;
  };
  csrfToken: string;
};

const modules: Array<{ id: ModuleId; label: string; description: string }> = [
  { id: "overview", label: "活動總覽", description: "健康與進度" },
  { id: "participants", label: "參加者", description: "名單與資格" },
  { id: "gifts", label: "禮物管理", description: "庫存與分配" },
  { id: "control", label: "抽獎控制", description: "接棒與舞台" },
  { id: "exceptions", label: "例外中心", description: "缺額與修正" },
  { id: "records", label: "紀錄匯出", description: "稽核與 CSV" },
];

const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");
  const [pool, setPool] = useState<GiftPool>("good");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  async function requestOverview(signal?: AbortSignal) {
    const response = await fetch("/api/admin/overview", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("後台資料暫時無法載入。");
    const payload = (await response.json()) as AdminData;
    setData(payload);
    setError("");
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/overview", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("後台資料暫時無法載入。");
        return (await response.json()) as AdminData;
      })
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        )
          return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "後台資料暫時無法載入。",
        );
      });
    return () => controller.abort();
  }, []);

  const filteredParticipants = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-TW");
    if (!normalized || !data) return data?.participants ?? [];
    return data.participants.filter((participant) =>
      `${participant.name} ${participant.id}`
        .toLocaleLowerCase("zh-TW")
        .includes(normalized),
    );
  }, [data, query]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      await requestOverview();
      setNotice("後台資料已更新。");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "後台資料暫時無法載入。",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function togglePause() {
    if (!data || pauseBusy) return;
    setPauseBusy(true);
    setError("");
    try {
      const response = await fetch("/api/event/pause", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": data.csrfToken,
        },
        body: JSON.stringify({ paused: !data.paused }),
      });
      const payload = (await response.json()) as {
        paused?: boolean;
        message?: string;
      };
      if (!response.ok || typeof payload.paused !== "boolean") {
        throw new Error(payload.message ?? "活動狀態無法更新。");
      }
      await requestOverview();
      setNotice(
        payload.paused
          ? "活動已暫停，舞台停止接受新抽獎。"
          : "活動已恢復，舞台可以繼續抽獎。",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "活動狀態無法更新。",
      );
    } finally {
      setPauseBusy(false);
    }
  }

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  if (!data) {
    return (
      <main className="admin-loading">
        <span className="admin-loading-mark" aria-hidden="true">
          ✦
        </span>
        <h1>主持控制台載入中</h1>
        {error ? (
          <div className="admin-load-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void refresh()}>
              重新載入
            </button>
          </div>
        ) : (
          <p>正在核對名單、禮物與接棒狀態。</p>
        )}
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div>
          <p className="admin-brand">Christmas Mystery Gift</p>
          <span>主持控制台</span>
        </div>
        <div className="admin-event-state" aria-live="polite">
          <span
            className={`state-dot ${data.paused ? "paused" : "live"}`}
            aria-hidden="true"
          />
          <strong>{data.paused ? "活動暫停" : "活動進行中"}</strong>
          <span>{data.event.rulesVersion}</span>
        </div>
        <div className="admin-top-actions">
          <button
            type="button"
            className="admin-refresh"
            disabled={refreshing}
            aria-busy={refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? "更新中" : "更新資料"}
          </button>
          <Link href="/">前往舞台</Link>
        </div>
      </header>

      <div className="admin-demo-banner" role="note">
        <strong>展示後台</strong>
        <span>
          目前使用示範資料與展示
          Session；正式上線前必須接上帳號、角色權限與資料庫。
        </span>
      </div>

      {error ? (
        <div className="admin-alert admin-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            關閉
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="admin-alert admin-alert-success" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            關閉
          </button>
        </div>
      ) : null}

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav aria-label="後台模組">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={activeModule === module.id ? "active" : ""}
                aria-current={activeModule === module.id ? "page" : undefined}
                onClick={() => setActiveModule(module.id)}
              >
                <strong>{module.label}</strong>
                <span>{module.description}</span>
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-note">
            <span>最後更新</span>
            <strong>
              {timeFormatter.format(new Date(data.event.updatedAt))}
            </strong>
          </div>
        </aside>

        <section className="admin-content">
          {activeModule === "overview" ? (
            <OverviewPanel data={data} onOpenModule={setActiveModule} />
          ) : null}
          {activeModule === "participants" ? (
            <ParticipantsPanel
              rows={filteredParticipants}
              query={query}
              searchRef={searchRef}
              onQueryChange={setQuery}
              onClear={clearSearch}
            />
          ) : null}
          {activeModule === "gifts" ? (
            <GiftsPanel data={data} pool={pool} onPoolChange={setPool} />
          ) : null}
          {activeModule === "control" ? (
            <ControlPanel
              data={data}
              pool={pool}
              onPoolChange={setPool}
              pauseBusy={pauseBusy}
              onTogglePause={togglePause}
            />
          ) : null}
          {activeModule === "exceptions" ? (
            <ExceptionsPanel data={data} />
          ) : null}
          {activeModule === "records" ? (
            <RecordsPanel data={data} pool={pool} onPoolChange={setPool} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-section-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </header>
  );
}

function PoolToggle({
  pool,
  onChange,
}: {
  pool: GiftPool;
  onChange: (pool: GiftPool) => void;
}) {
  return (
    <div className="admin-pool-toggle" aria-label="選擇獎池">
      <button
        type="button"
        className={pool === "good" ? "active" : ""}
        aria-pressed={pool === "good"}
        onClick={() => onChange("good")}
      >
        好禮物
      </button>
      <button
        type="button"
        className={pool === "bad" ? "active" : ""}
        aria-pressed={pool === "bad"}
        onClick={() => onChange("bad")}
      >
        壞禮物
      </button>
    </div>
  );
}

function StatusTag({ value }: { value: string }) {
  const tone =
    value.includes("完成") ||
    value.includes("成功") ||
    value.includes("到場") ||
    value.includes("正常")
      ? "success"
      : value.includes("目前") || value.includes("進行")
        ? "current"
        : value.includes("暫停") || value.includes("待")
          ? "pending"
          : "neutral";
  return <span className={`status-tag ${tone}`}>{value}</span>;
}

function OverviewPanel({
  data,
  onOpenModule,
}: {
  data: AdminData;
  onOpenModule: (module: ModuleId) => void;
}) {
  const healthItems = [
    ["有效參加者", data.event.participantCount, "人"],
    ["好禮剩餘", data.pools.good.remaining, "份"],
    ["壞禮剩餘", data.pools.bad.remaining, "份"],
    ["欠繳禮物", data.health.missingGifts, "份"],
    ["待處理修正", data.health.pendingCorrections, "筆"],
    ["連線狀態", data.health.connection, ""],
  ] as const;
  return (
    <>
      <SectionHeader
        title="活動總覽"
        description="先確認活動健康，再讓下一位參加者上場。"
      />
      <section className="health-ledger" aria-label="活動健康指標">
        {healthItems.map(([label, value, unit]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {value}
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </section>

      <section className="admin-section-block">
        <div className="block-heading">
          <div>
            <h2>雙獎池進度</h2>
            <p>兩條接棒循環彼此獨立，結果只在第三次戳破成功後增加。</p>
          </div>
          <button
            type="button"
            className="text-action"
            onClick={() => onOpenModule("control")}
          >
            開啟抽獎控制
          </button>
        </div>
        <div className="pool-progress-list">
          {(["good", "bad"] as GiftPool[]).map((pool) => {
            const summary = data.pools[pool];
            return (
              <article key={pool} className="pool-progress-row">
                <div className={`pool-seal ${pool}`}>
                  {pool === "good" ? "好" : "壞"}
                </div>
                <div className="pool-progress-main">
                  <div>
                    <h3>{pool === "good" ? "好禮物獎池" : "壞禮物獎池"}</h3>
                    <span>
                      目前接棒：<strong>{summary.currentDrawer.name}</strong>
                    </span>
                  </div>
                  <progress value={summary.openedCount} max={summary.total}>
                    {summary.openedCount} / {summary.total}
                  </progress>
                </div>
                <div className="pool-progress-count">
                  <strong>{summary.openedCount}</strong>
                  <span>/ {summary.total}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-section-block readiness-block">
        <div className="block-heading">
          <div>
            <h2>開始條件</h2>
            <p>依企劃書的嚴格接棒政策檢查。</p>
          </div>
          <StatusTag
            value={
              data.health.blockingIssues.length === 0 ? "可繼續" : "需要處理"
            }
          />
        </div>
        <ul className="readiness-list">
          <li>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>名單與資格一致</strong>
              <p>50 位參加者在兩個獎池各有一次抽獎資格。</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>禮物庫存一致</strong>
              <p>好禮物與壞禮物各 50 份，皆標示已到場。</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>接棒鏈可以延續</strong>
              <p>目前沒有提早封閉的小圈或待處理修正。</p>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}

function ParticipantsPanel({
  rows,
  query,
  searchRef,
  onQueryChange,
  onClear,
}: {
  rows: ParticipantRow[];
  query: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <SectionHeader
        title="參加者管理"
        description="名單固定為 50 人；搜尋只在瀏覽器內篩選，不會把姓名寫入網址。"
        action={
          <div className="admin-search">
            <label htmlFor="participant-search">搜尋姓名或編號</label>
            <div>
              <input
                ref={searchRef}
                id="participant-search"
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="例如：林安安"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="清除參加者搜尋"
                  onClick={onClear}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        }
      />
      <div className="table-summary" role="status">
        顯示 {rows.length} / 50 位參加者
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">參加者</th>
              <th scope="col">到場</th>
              <th scope="col">好禮物資格</th>
              <th scope="col">壞禮物資格</th>
              <th scope="col">好禮物</th>
              <th scope="col">壞禮物</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((participant) => (
              <tr key={participant.id}>
                <th scope="row">
                  <span
                    className={`admin-avatar tone-${participant.avatarTone}`}
                    aria-hidden="true"
                  >
                    {participant.initials}
                  </span>
                  <span>
                    <strong>{participant.name}</strong>
                    <small>{participant.id}</small>
                  </span>
                </th>
                <td>
                  <StatusTag value={participant.attendance} />
                </td>
                <td>
                  <StatusTag value={participant.goodDrawStatus} />
                </td>
                <td>
                  <StatusTag value={participant.badDrawStatus} />
                </td>
                <td>
                  <StatusTag value={participant.goodGiftStatus} />
                </td>
                <td>
                  <StatusTag value={participant.badGiftStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="admin-empty">
            <strong>找不到符合的參加者</strong>
            <span>清除搜尋文字，查看完整名單。</span>
            <button type="button" onClick={onClear}>
              清除搜尋
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function GiftsPanel({
  data,
  pool,
  onPoolChange,
}: {
  data: AdminData;
  pool: GiftPool;
  onPoolChange: (pool: GiftPool) => void;
}) {
  const rows = data.gifts.filter((gift) => gift.pool === pool);
  const assigned = rows.filter(
    (gift) => gift.assignmentStatus === "已分配",
  ).length;
  return (
    <>
      <SectionHeader
        title="禮物管理"
        description="庫存到場與抽獎分配分開記錄；已分配結果不可直接覆寫。"
        action={<PoolToggle pool={pool} onChange={onPoolChange} />}
      />
      <div className="inventory-strip">
        <span>
          已到場 <strong>{rows.length}</strong>
        </span>
        <span>
          已分配 <strong>{assigned}</strong>
        </span>
        <span>
          待分配 <strong>{rows.length - assigned}</strong>
        </span>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">禮物編號</th>
              <th scope="col">提供者</th>
              <th scope="col">庫存</th>
              <th scope="col">分配</th>
              <th scope="col">格子</th>
              <th scope="col">抽獎者</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((gift) => (
              <tr key={gift.id}>
                <th scope="row">{gift.inventoryNumber}</th>
                <td>{gift.provider.name}</td>
                <td>
                  <StatusTag value={gift.inventoryStatus} />
                </td>
                <td>
                  <StatusTag value={gift.assignmentStatus} />
                </td>
                <td>
                  {gift.slotNumber
                    ? `#${String(gift.slotNumber).padStart(2, "0")}`
                    : "—"}
                </td>
                <td>{gift.drawerName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ControlPanel({
  data,
  pool,
  onPoolChange,
  pauseBusy,
  onTogglePause,
}: {
  data: AdminData;
  pool: GiftPool;
  onPoolChange: (pool: GiftPool) => void;
  pauseBusy: boolean;
  onTogglePause: () => Promise<void>;
}) {
  const summary = data.pools[pool];
  const recent = summary.opened.slice(-8).reverse();
  return (
    <>
      <SectionHeader
        title="抽獎控制"
        description="舞台只顯示公開結果；主持操作以已保存的狀態為準。"
        action={<PoolToggle pool={pool} onChange={onPoolChange} />}
      />
      <section className="control-stage-strip">
        <div>
          <span>目前接棒者</span>
          <strong>{summary.currentDrawer.name}</strong>
          <small>{pool === "good" ? "好禮物獎池" : "壞禮物獎池"}</small>
        </div>
        <div className="control-progress">
          <span>接棒進度</span>
          <strong>
            {summary.openedCount} / {summary.total}
          </strong>
          <progress value={summary.openedCount} max={summary.total}>
            {summary.openedCount} / {summary.total}
          </progress>
        </div>
        <button
          type="button"
          className={data.paused ? "resume-control" : "pause-control"}
          disabled={pauseBusy}
          aria-busy={pauseBusy}
          onClick={() => void onTogglePause()}
        >
          {data.paused ? <PlayIcon /> : <PauseIcon />}
          <span>{data.paused ? "恢復活動" : "緊急暫停"}</span>
        </button>
      </section>
      <section className="admin-section-block">
        <div className="block-heading">
          <div>
            <h2>最近接棒</h2>
            <p>重播只讀取既有結果，不會再次抽獎。</p>
          </div>
          <Link className="text-action" href="/">
            開啟舞台畫面
          </Link>
        </div>
        {recent.length ? (
          <ol className="chain-list">
            {recent.map((draw) => (
              <li key={draw.id}>
                <span>{String(draw.sequence).padStart(2, "0")}</span>
                <strong>{draw.drawer.name}</strong>
                <i aria-hidden="true">→</i>
                <strong>{draw.provider.name}</strong>
                <small>格子 #{String(draw.slotNumber).padStart(2, "0")}</small>
              </li>
            ))}
          </ol>
        ) : (
          <div className="admin-empty compact">
            <strong>尚未開始抽獎</strong>
            <span>第一位接棒者是 {summary.currentDrawer.name}。</span>
          </div>
        )}
      </section>
      <div className="control-note" role="note">
        <strong>管理限制</strong>
        <span>
          展示版未開放重抽與中段作廢，避免破壞既有接棒鏈。正式版需先顯示影響範圍，再以受控補償流程處理。
        </span>
      </div>
    </>
  );
}

function ExceptionsPanel({ data }: { data: AdminData }) {
  const policies = [
    ["臨時加入", "先暫停未完成獎池，重新檢查名額、禮物與接棒可行性。"],
    ["少帶禮物", "優先補入備用禮物；否則調整該池資格，不把欠繳算進庫存。"],
    ["第三擊斷線", "使用相同請求代碼查詢原結果，不產生第二筆抽獎。"],
    ["接棒無解", "阻止交易，顯示差額與可採取的補禮、資格調整或暫停方案。"],
  ];
  return (
    <>
      <SectionHeader
        title="例外處理中心"
        description="先停止新抽獎，再修正資料；已完成結果保留完整歷史。"
      />
      <section className="exception-status">
        <span className="exception-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2>目前沒有阻擋項目</h2>
          <p>
            缺席 {data.health.absentParticipants} 人、欠繳{" "}
            {data.health.missingGifts} 份、待處理修正{" "}
            {data.health.pendingCorrections} 筆。
          </p>
        </div>
        <StatusTag value="可繼續" />
      </section>
      <section className="admin-section-block">
        <div className="block-heading">
          <div>
            <h2>受控處理原則</h2>
            <p>以下動作在正式版會產生 AuditLog，且不能無痕改寫歷史。</p>
          </div>
        </div>
        <div className="policy-list">
          {policies.map(([title, description]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
              <button type="button" disabled title="展示版尚未開放資料修正">
                正式後台開放
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function RecordsPanel({
  data,
  pool,
  onPoolChange,
}: {
  data: AdminData;
  pool: GiftPool;
  onPoolChange: (pool: GiftPool) => void;
}) {
  return (
    <>
      <SectionHeader
        title="紀錄與匯出"
        description="抽獎紀錄只追加，不刪除；時間以台北時區顯示。"
        action={<PoolToggle pool={pool} onChange={onPoolChange} />}
      />
      <div className="export-strip">
        <div>
          <strong>{pool === "good" ? "好禮物" : "壞禮物"}庫存與分配</strong>
          <span>UTF-8 CSV，包含提供者、格子與抽獎者。</span>
        </div>
        <a href={`/api/admin/export?pool=${pool}`} download>
          匯出 CSV
        </a>
      </div>
      <div className="admin-table-wrap audit-table">
        <table>
          <thead>
            <tr>
              <th scope="col">時間</th>
              <th scope="col">操作者</th>
              <th scope="col">動作</th>
              <th scope="col">目標</th>
              <th scope="col">內容</th>
              <th scope="col">結果</th>
            </tr>
          </thead>
          <tbody>
            {data.auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{timeFormatter.format(new Date(log.createdAt))}</td>
                <td>{log.actor}</td>
                <td>{log.action}</td>
                <td>{log.target}</td>
                <td>{log.detail}</td>
                <td>
                  <StatusTag value={log.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.auditLogs.length === 0 ? (
          <div className="admin-empty">
            <strong>尚無抽獎紀錄</strong>
            <span>第三次戳破成功後，結果會出現在這裡。</span>
          </div>
        ) : null}
      </div>
    </>
  );
}
