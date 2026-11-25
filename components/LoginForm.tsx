"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
    if (!normalizedEmail || !normalizedEmail.includes("@") || !password) {
      setError("請輸入完整的電子郵件與密碼。");
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        rememberMe: false,
      });
      if (result.error) {
        setPassword("");
        setError("電子郵件或密碼不正確，請重新確認。");
        return;
      }
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("登入服務目前無法連線，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {error ? (
        <div className="auth-error" role="alert">
          {error}
        </div>
      ) : null}
      <label htmlFor="login-email">電子郵件</label>
      <input
        ref={emailRef}
        id="login-email"
        name="email"
        type="email"
        value={email}
        autoComplete="username"
        inputMode="email"
        aria-invalid={Boolean(error)}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor="login-password">密碼</label>
      <div className="auth-password-field">
        <input
          id="login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={password}
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="button"
          aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((shown) => !shown)}
        >
          {showPassword ? "隱藏" : "顯示"}
        </button>
      </div>
      <button
        className="auth-submit"
        type="submit"
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "登入中…" : "登入主持台"}
      </button>
      <Link className="auth-back" href="/">
        返回交換禮物舞台
      </Link>
    </form>
  );
}
