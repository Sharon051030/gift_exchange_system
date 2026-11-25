import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/authorization";

export const metadata: Metadata = {
  title: "主持控制台 | Christmas Mystery Gift",
  description: "交換禮物活動主持與管理控制台",
};

export default async function AdminPage() {
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login?next=/admin");
  if (principal.role !== "admin" && principal.role !== "host")
    redirect("/forbidden");
  return <AdminDashboard principal={principal} />;
}
