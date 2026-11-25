# 漏洞檢視表

檢查日期：2026-11-25。這是程式碼與部署前設定檢查，不等同第三方滲透測試或合規認證。

## 本次已修補

| 項目                 | 狀態   | 實作證據                                                                        | 驗收重點                                            |
| -------------------- | ------ | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| 管理員登入與 Session | 已修補 | Better Auth email/password、PostgreSQL Session；公開註冊預設停用                | 建立管理員後，無 Cookie 存取 `/admin` 會回登入頁    |
| 角色權限             | 已修補 | `admin / host / viewer`；頁面與每支敏感 API 都重新查 Session/RBAC               | host 不可匯出；viewer 直接進 `/admin` 會到 403      |
| 匿名抽獎／暫停       | 已修補 | `/api/draws`、`/api/event/pause` 僅允許 admin/host，並檢查同源                  | 未登入 POST 應回 401；跨來源應回 403                |
| 後台資料外洩         | 已修補 | overview 僅 admin/host；export 僅 admin；公開狀態只含目前與已揭曉資料           | 未登入 overview/export 不得回傳名單                 |
| 記憶體資料遺失       | 已修補 | PostgreSQL `events / participants / pool_states / draws / audit_logs`           | 重啟與多 instance 後結果一致                        |
| 多節點重複抽獎       | 已修補 | 交易、`FOR UPDATE`、格子／順序／提供者／抽獎者／idempotency 唯一約束            | 同格並發只允許一筆成功                              |
| 單機限流可繞過       | 已修補 | Upstash Redis 分散式 sliding window；未設定時敏感操作回 503                     | 多 instance 共用計數，429 帶 Retry-After            |
| 無稽核軌跡           | 已修補 | 抽獎與暫停操作寫入只追加 audit log，記錄操作者                                  | 後台可追蹤 actor/action/target/time                 |
| 活動重置遭誤觸或越權 | 已修補 | 僅 admin、同源驗證、Redis 限流、輸入活動名稱、資料庫 transaction；保留 AuditLog | host／viewer 直接呼叫應回 403；失敗不得留下部分重置 |
| 供應鏈已知漏洞       | 通過   | `package-lock.json` 固定版本；本次執行 `npm audit`                              | 公開前仍應在 CI 持續掃描                            |

## 公開前仍需處理

| 風險                           | 等級     | 現況                                               | 公開前處理                                                            |
| ------------------------------ | -------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| 尚未接入正式 PostgreSQL／Redis | 阻擋公開 | 程式與 migration 已完成，但本機未提供服務憑證      | 在 Vercel Marketplace 建立資料庫與 Redis，設定環境變數並跑 `db:setup` |
| 尚未完成真實環境 E2E／壓力測試 | 阻擋公開 | 靜態、單元與建置測試不能證明外部服務行為           | 測試登入、撤銷、RBAC、重啟持久化、50 人閉環與並發抽獎                 |
| CSP 仍含 `unsafe-inline`       | 中       | Next.js 現有 CSP 為相容目前 inline script/style    | 依 Next.js 16 nonce 指南改成 nonce/hash CSP，再移除 `unsafe-inline`   |
| 登入僅密碼、未啟用 MFA         | 中       | 有集中式登入限流與 12 字元最低密碼                 | 公開管理後台前建議加 TOTP/WebAuthn 或企業 SSO                         |
| 資料備份與保留政策未定         | 中       | PostgreSQL 可持久化，但尚未定義 PITR、刪除與保留期 | 啟用供應商備份，定義稽核與個資保留政策並演練還原                      |
| 監控與告警未接                 | 中       | API 會安全失敗，但未外送錯誤與異常登入事件         | 接 Vercel Logs／監控，對 401/403/429/5xx 與 DB 錯誤告警               |
| 照片上傳尚未實作               | 待追蹤   | 未有上傳攻擊面                                     | 實作時驗證 magic bytes、重新編碼、大小限制、私有儲存與短效 URL        |

## 安全設定檢查

- `.env*` 預設被 Git 忽略，只有不含真實秘密的 `.env.example` 可提交。
- `BETTER_AUTH_SECRET` 至少 32 位隨機值；Production 與 Preview 使用不同秘密。
- `BOOTSTRAP_ADMIN_PASSWORD` 只在本機執行一次，建立後立即移除；Vercel 不得設定。
- PostgreSQL 帳號採最小權限並使用 TLS；Redis Token 不得加 `NEXT_PUBLIC_`。
- GitHub 保持 Private，待本表的阻擋項完成並由你驗收後，再改 Public。
