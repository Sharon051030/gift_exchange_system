import { type NextRequest } from "next/server";
import { adminOverview, demoStore } from "@/lib/demo-store";
import type { GiftPool } from "@/lib/draw-engine";

const csvCell = (value: string | number | null) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export function GET(request: NextRequest) {
  const pool: GiftPool =
    request.nextUrl.searchParams.get("pool") === "bad" ? "bad" : "good";
  const overview = adminOverview(demoStore);
  const rows = overview.gifts
    .filter((gift) => gift.pool === pool)
    .map((gift) =>
      [
        gift.inventoryNumber,
        gift.provider.name,
        pool === "good" ? "好禮物" : "壞禮物",
        gift.inventoryStatus,
        gift.assignmentStatus,
        gift.slotNumber,
        gift.drawerName,
      ]
        .map(csvCell)
        .join(","),
    );
  const header = [
    "禮物編號",
    "提供者",
    "獎池",
    "庫存狀態",
    "分配狀態",
    "格子",
    "抽獎者",
  ]
    .map(csvCell)
    .join(",");
  const csv = `\uFEFF${[header, ...rows].join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="christmas-${pool}-gifts.csv"`,
    },
  });
}
