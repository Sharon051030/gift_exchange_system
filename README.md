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
- SameSite HttpOnly 展示 Session、CSRF token、基本速率限制與安全標頭

## 執行

```powershell
npm install
npm run dev
```

開啟 <http://localhost:3000>。

主持控制台：<http://localhost:3000/admin>。

Three.js 僅負責高價值視覺層；50 個禮物格仍是可鍵盤操作的語意按鈕，抽獎與防重送規則不依賴畫布。

## 驗證

```powershell
npm run verify
```

目前是單機活動 MVP：資料保存在 Node.js 記憶體，服務重啟會重置。正式活動必須接上 MySQL、認證與角色權限、物件儲存及 SSE／WebSocket；詳見 `OPTIMIZATION_BACKLOG.md` 與 `SECURITY_REVIEW.md`。
