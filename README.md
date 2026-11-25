# Christmas Mystery Gift

依據 `Christmas_Mystery_Gift_企劃書_v2.0.docx` 製作的互動式交換禮物網站 MVP。

## 已實作

- 復古聖誕紙雕舞台與 Three.js 立體禮盒封面
- Three.js／React Three Fiber 粒子、紙面凹陷 shader、碎紙與揭曉光環
- 高／標準／省電三段畫質，WebGL 不可用及 reduced-motion 自動降級
- 好禮物／壞禮物雙獎池，各 50 格
- 同一格三次戳破；第三次才呼叫伺服器抽獎
- 伺服器端嚴格單循環接棒，不自抽、不提早成小圈
- Idempotency key 重送保留同一結果
- 已揭曉格子可重播，不會重新抽取
- 明確互動狀態機；伺服器確認前不會播放破紙揭曉動畫
- 全域暫停、全螢幕、音效開關、錯誤恢復與 reduced motion
- `/admin` 主持控制台：健康、參加者、禮物、抽獎控制、例外與紀錄匯出
- Better Auth 資料庫 Session、`admin / host / viewer` 角色權限與安全標頭
- PostgreSQL 持久化、交易列鎖、唯一約束與只追加稽核紀錄
- Upstash Redis 集中式操作限流；未設定時敏感操作採安全拒絕

## 執行

1. 複製 `.env.example` 為 `.env.local`，填入 PostgreSQL、Better Auth 與 Upstash Redis 憑證。
2. 初始化 Better Auth 與活動資料：

   ```powershell
   npm install
   npm run db:setup
   npm run db:bootstrap-admin
   ```

3. 立即從 `.env.local` 移除 `BOOTSTRAP_ADMIN_PASSWORD`，再啟動：

   ```powershell
   npm run dev
   ```

開啟 <http://localhost:3000>。

主持控制台：<http://localhost:3000/admin>。未登入會導向 `/login`。

## 角色權限

| 功能                     | admin | host | viewer／未登入 |
| ------------------------ | ----- | ---- | -------------- |
| 查看公開舞台與已揭曉結果 | 是    | 是   | 是             |
| 抽獎、暫停與恢復         | 是    | 是   | 否             |
| 查看主持控制台           | 是    | 是   | 否             |
| 匯出完整 CSV             | 是    | 否   | 否             |
| 重置整場活動             | 是    | 否   | 否             |

活動重置會清除好／壞禮物獎池的本輪抽獎結果、把接棒者復原至各池起點並解除暫停；參加者名單與既有稽核紀錄會保留。後台必須輸入完整活動名稱才會啟用重置按鈕。

正式環境不可設定 `ALLOW_ADMIN_BOOTSTRAP=true`，也不可保留一次性管理員密碼。帳號註冊 API 預設停用。

Three.js 僅負責高價值視覺層；50 個禮物格仍是可鍵盤操作的語意按鈕，抽獎與防重送規則不依賴畫布。

## 驗證

```powershell
npm run verify
```

目前程式已具備正式持久化與權限骨架，但在公開前仍須接上實際 PostgreSQL／Redis、完成真實環境 E2E 與 CSP nonce 化；詳見 `SECURITY_REVIEW.md`。
