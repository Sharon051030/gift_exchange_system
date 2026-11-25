import { type NextRequest } from "next/server";
import { authorize } from "@/lib/authorization";
import { getAdminOverview } from "@/lib/event-repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { GiftPool } from "@/lib/draw-engine";

const csvCell = (value: string | number | null) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: NextRequest) {
  const access = await authorize(request.headers, ["admin"]);
  if (!access.ok)
    return Response.json(
      { message: access.message },
      { status: access.status },
    );
  const limited = await enforceRateLimit("export", access.principal.id);
  if (!limited.success)
    return Response.json(
      { message: limited.message },
      { status: limited.status },
    );
  const pool: GiftPool =
    request.nextUrl.searchParams.get("pool") === "bad" ? "bad" : "good";
  const overview = await getAdminOverview();
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
