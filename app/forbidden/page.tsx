import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "權限不足 | Christmas Mystery Gift",
};

export default function ForbiddenPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="forbidden-title">
        <p className="auth-kicker">403 · Access denied</p>
        <h1 id="forbidden-title">這個帳號沒有後台權限</h1>
        <p>請改用管理員或主持人帳號登入，或回到交換禮物舞台。</p>
        <Link className="auth-primary-link" href="/">
          回到舞台
        </Link>
      </section>
    </main>
  );
}
