import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "管理員登入 | Christmas Mystery Gift",
  description: "交換禮物主持與管理帳號登入",
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="auth-kicker">HOST ACCESS · 2026</p>
        <h1 id="login-title">回到聖誕主持台</h1>
        <p className="auth-intro">
          登入後才能控制抽獎、暫停活動或查看管理資料。
        </p>
        <Suspense fallback={<p className="auth-loading">正在準備安全登入…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
