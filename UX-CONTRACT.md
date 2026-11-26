# Christmas Mystery Gift UX Contract

## Routes

| Route    | Audience       | Purpose                                |
| -------- | -------------- | -------------------------------------- |
| `/`      | 參加者與投影   | 封面、禮物牆、三次戳破與揭曉           |
| `/admin` | 主持人與管理員 | 活動健康、名單、禮物、接棒、例外與稽核 |
| `/login` | 主持人與管理員 | 管理帳號登入並返回原先路徑             |

訪客可直接進入禮物牆、讀取舞台狀態並抽獎。伺服器以資料庫 Session 驗證管理操作，只有 admin/host 能暫停活動或進入主持控制台，完整匯出與重置僅限 admin。抽獎共用活動配額，接棒更新後重新載入已揭曉結果及當前接棒者。

## Canonical UI Map

| Capability         | Canonical owner               | Decision                                               |
| ------------------ | ----------------------------- | ------------------------------------------------------ |
| Scrollbar          | `app/globals.css`             | 全站 token 化，表格只控制自己的水平 overflow           |
| Status feedback    | 頁面內 `admin-alert`          | 成功用 status，錯誤用 alert；關鍵訊息不只放 toast      |
| Dataset navigation | 原生 semantic table           | 參加者與每池禮物皆有 50 筆上限，完整渲染               |
| Search             | `AdminDashboard` 的參加者搜尋 | 本地即時篩選；有清除鈕；姓名不寫入 URL                 |
| Pool switch        | `PoolToggle`                  | 好／壞禮物使用同一按鈕組與 `aria-pressed`              |
| Pause and resume   | `/api/event/pause`            | 等待伺服器確認後更新；失敗保留原狀態                   |
| Draw animation     | `interactionReducer`          | 視覺狀態不可決定結果；成功回應後才能破裂與揭曉         |
| Effect quality     | `useVisualPreferences`        | 高／標準／省電三級；遵守 reduced motion                |
| WebGL fallback     | DOM/CSS gift controls         | WebGL 不可用時保留完整抽獎、裂痕與揭曉流程             |
| Opening sequence   | `lib/opening-experience.ts`   | 固定視角；同一批光點成束，樹冠分層展開，禮物從樹根彈出 |
| Authentication     | Better Auth + `LoginForm`     | 泛用錯誤、不揭露帳號是否存在、支援密碼管理器           |
| Authorization      | `lib/authorization.ts`        | 頁面與 API 皆做伺服器端角色驗證                        |

## Flow Ledger

| Operation  | Trigger                      | Pending                      | Success                                              | Failure recovery                               |
| ---------- | ---------------------------- | ---------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| 更新後台   | 更新資料                     | 按鈕保持尺寸並標示更新中     | 替換成伺服器狀態並顯示確認                           | 保留既有資料並顯示可關閉錯誤                   |
| 暫停活動   | 緊急暫停                     | 禁止重複送出                 | 舞台與後台共同顯示已暫停                             | 保持原狀態並提供錯誤原因                       |
| 恢復活動   | 恢復活動                     | 禁止重複送出                 | 重新抓取健康與接棒狀態                               | 保持暫停並顯示錯誤                             |
| 搜尋參加者 | 輸入姓名或編號               | 本地同步，不顯示假 loading   | 更新可見列與數量                                     | 零結果提供清除搜尋                             |
| 匯出紀錄   | 匯出 CSV                     | 瀏覽器下載                   | 產生 UTF-8 CSV                                       | HTTP 錯誤，不改變活動狀態                      |
| 三次戳破   | 同一格連續操作               | 第三次進入 draw pending      | 伺服器確認後破裂並揭曉                               | 保留第二次裂痕，可安全重試                     |
| 開場動畫   | 首次開啟首頁／略過動畫       | 載入完成後執行單一轉場時間軸 | 樹、禮物及首頁操作完整出現；略過時直接抵達同一完成態 | WebGL 不可用或 reduced motion 時直接顯示完成態 |
| 關閉揭曉   | 關閉鈕／Escape               | 進入 closing，不重送抽獎     | 回到原格並恢復觸發按鈕焦點                           | 結果仍保留在已開啟格子                         |
| 重置活動   | 管理員輸入完整活動名稱並確認 | 對話框保持開啟且禁止重複送出 | 清除本輪結果、回復兩池起點、解除暫停並保留 AuditLog  | 交易回滾、保留輸入與既有活動狀態               |

## Responsive and Accessibility

- 桌面使用側欄，窄螢幕改為可水平捲動的模組列。
- 表格保留欄位與語意，手機使用明確水平捲動，不隱藏資料。
- 所有動作使用 `button` 或 `a`，有可見焦點、disabled 與 busy 狀態。
- 搜尋欄有可程式關聯的 label 與鍵盤可操作清除鈕。
- 狀態以文字和顏色共同表達，目標為 WCAG 2.2 AA。
- 揭曉期間背景設為 inert，焦點留在對話框內，關閉後回到原格。
- 3D Canvas 一律為裝飾層並從可及性樹隱藏；鍵盤與觸控操作由原生按鈕承擔。
- 系統 reduced-motion 啟用時跳過空間轉場，但不跳過狀態回饋或成功確認。
- 開場載入、轉場與首頁共用同一 DOM，不重新整理、不插入黑畫面；「略過動畫」必須立即抵達可操作完成態。
- 「前往抽獎」在同一頁面載入禮物牆並捲動至舞台，減少動態模式則立即移動。
- 完整活動重置僅向 admin 顯示；對話框以活動名稱做輸入確認、初始焦點停在保留活動，Escape 關閉並恢復觸發按鈕焦點。
