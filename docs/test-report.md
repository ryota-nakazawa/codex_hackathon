# 試験記録

## 概要

- 対象: Dental Clinic PoC
- 実行日: 2026-03-29
- 実行コマンド: `npm test`
- 結果: 27件実行、27件成功、0件失敗

## 試験環境

- Node.js ベースのローカル実行
- HTTP サーバを起動して API / 画面シェルを検証
- ダミーデータは `data/` 配下の JSON を使用
- `live` 系試験は環境によって `live` または `fallback` のどちらでも破綻しないことを確認対象とした

## 1. 業務シナリオ試験

### 予約から院内反映

- `creates appointment from reservation form input`
  - 目的: 患者向け予約フォーム相当の入力から予約登録できること
  - 確認内容: `POST /api/appointments` で予約と患者情報が生成されること
  - 結果: 成功

### 患者詳細参照

- `returns patient detail with reports and xray metadata`
  - 目的: 院内画面で患者詳細を開いたときに必要情報が揃うこと
  - 確認内容: `GET /api/patients/:id` で患者基本情報、過去レポート、レントゲン情報が返ること
  - 結果: 成功

### 患者記録追加

- `adds report record to patient detail`
  - 目的: 患者詳細から新しい記録を追加できること
  - 確認内容: `POST /api/patients/:id/reports` で記録追加後の患者詳細が返ること
  - 結果: 成功

### 新規患者登録

- `POST /api/patients creates a new patient`
  - 目的: 院内画面から新規患者を登録できること
  - 確認内容: `POST /api/patients` で患者が生成されること
  - 結果: 成功

## 2. API 基本試験

### ヘルスチェック

- `health endpoint responds`
  - 目的: サービスが正常応答すること
  - 確認内容: `GET /api/health` が `200` を返すこと
  - 結果: 成功

### 初期表示データ

- `bootstrap returns clinic site and dashboard seed data`
- `GET /api/bootstrap returns patients and appointments`
  - 目的: 患者向けサイトと院内ダッシュボードの初期データを取得できること
  - 確認内容: `GET /api/bootstrap` で医院情報、患者一覧、予約一覧が返ること
  - 結果: 成功

### 画面シェル配信

- `GET / serves the app shell`
  - 目的: フロントエンドの入口HTMLが返ること
  - 確認内容: `/` でHTMLが配信され、基本セキュリティヘッダが付与されること
  - 結果: 成功

## 3. 診断補助ロジック試験

### レポート生成の基本動作

- `POST /api/generate-report returns report for memo-only input`
  - 目的: 片側入力でも診断補助レポートが生成できること
  - 確認内容: メモのみ入力で `fallback` レポートが返ること
  - 結果: 成功

- `fallback report includes markdown output`
  - 目的: レポートをMarkdownへ落とせること
  - 確認内容: fallback生成物にMarkdownが含まれること
  - 結果: 成功

### モード切替

- `mock mode stays on mock path`
- `mock mode stays on mock path`
  - 目的: `mock` モードがモック生成経路を維持すること
  - 確認内容: API層とサービス層の双方で `mock` が維持されること
  - 結果: 成功

- `live mode falls back when API key is absent`
- `live mode falls back when API key is not configured`
  - 目的: `live` 実行時に環境差異があっても破綻しないこと
  - 確認内容: `live` または安全な `fallback` で処理完了すること
  - 結果: 成功

### 医療系制約

- `notes only sets image constraint flag`
  - 目的: テキストのみ入力時に画像由来の断定を抑制すること
  - 確認内容: 制約フラグ `avoidImageDerivedSuggestions` が有効になること
  - 結果: 成功

- `image only sets background constraint flag`
  - 目的: 画像のみ入力時に背景依存の断定を避けること
  - 確認内容: 制約フラグ `avoidBackgroundClaims` が有効になること
  - 結果: 成功

- `fallback report avoids image-derived claims for text-only input`
  - 目的: テキストのみで画像所見を断定しないこと
  - 確認内容: 出力文面が画像由来の示唆を避けること
  - 結果: 成功

- `fallback report avoids background assumptions for image-only input`
  - 目的: 画像のみで患者背景を断定しないこと
  - 確認内容: 出力文面が背景依存の断定を避けること
  - 結果: 成功

## 4. バリデーション試験

### 空入力・形式不正

- `rejects empty input`
- `validateGeneratePayload rejects empty input`
  - 目的: 必須入力不足を拒否すること
  - 確認内容: 空入力が `400` または例外で拒否されること
  - 結果: 成功

- `POST /api/generate-report rejects non-JSON content types`
  - 目的: APIがJSON以外を受け付けないこと
  - 確認内容: `Content-Type: text/plain` を拒否すること
  - 結果: 成功

### サイズ制限

- `oversized text input is rejected`
  - 目的: 過大なテキスト入力を拒否すること
  - 確認内容: 上限超過入力が `400` になること
  - 結果: 成功

### 画像制約

- `invalid image type is rejected`
- `validation rejects unsupported image types`
  - 目的: 非対応画像形式を拒否すること
  - 確認内容: GIF や SVG などの非対応形式が拒否されること
  - 結果: 成功

## 5. セキュリティ試験

### サニタイズ

- `dangerous input is sanitized in output`
- `dangerous text is sanitized in generated output`
  - 目的: 悪意ある文字列がそのまま出力やMarkdownへ残らないこと
  - 確認内容: `<script>` 等が除去されること
  - 結果: 成功

### Cross-origin 制約

- `POST /api/generate-report blocks cross-origin requests`
  - 目的: 同一オリジン制約が機能すること
  - 確認内容: 別Origin付きリクエストを `403` で拒否すること
  - 結果: 成功

## 総括

- 患者向けサイト、予約、院内ダッシュボード、患者詳細、患者登録、診断補助APIの主要経路は自動試験上すべて成功した
- PoCとして必要な最低限の入力制約、文面制約、セキュリティ制約、画面入口APIは揃っている
- 現時点の更新データはメモリ保持であり、再起動時はダミーデータ初期状態に戻る
