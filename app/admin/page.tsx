import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "主持控制台 | Christmas Mystery Gift",
  description: "交換禮物活動主持與管理控制台",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
