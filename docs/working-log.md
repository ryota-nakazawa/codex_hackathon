# ワーキングログ

## 概要

- 対象: 歯科医院向け患者サイト + 予約 + 院内管理画面 + 患者詳細 + レントゲンAI解析 PoC
- 開発方式: サブエージェント分担 + メインエージェント統合
- 実装基盤: Node 標準 HTTP サーバ、依存追加なし、ローカル JSON ダミーデータ

## 開発の流れ

### 1. 初期 PoC の組み立て

- 患者向け入力と診断補助レポート生成の PoC を作成
- `mock` / `live` / `fallback` の 3 経路を用意
- `POST /api/generate-report` を中心に、テキストと画像の入力制約を実装

### 2. サブエージェントで初期アプリを分担実装

- 設計エージェント
  - 最初の PoC の構造整理
  - API と画面責務の分離方針を提案
- UI エージェント
  - 患者向け画面と管理画面のベース UI を作成
- バックエンドエージェント
  - HTTP サーバ、API、ダミーデータ接続、診断補助ロジックを実装
- セキュリティチェックエージェント
  - CSP、同一オリジン制約、サイズ制限、レート制限などをレビュー
- 試験エージェント
  - `node:test` ベースで API とバリデーションの試験を整備

### 3. 要件の見直しと画面遷移の再整理

- ユーザー要望を受け、画面遷移を次の 4 URL に整理
  - `/`
  - `/reserve`
  - `/dashboard`
  - `/patients/:id`
- 画面遷移図を `docs/screen-transition.md` に作成
- 予約完了や登録完了は独立ページではなく、各ページ内の状態として扱う方針に変更

### 4. 単一 SPA から URL ごとの別画面へ変更

- `index.html` 1 枚に隠しセクションを並べる構成を廃止
- 画面ごとに別 HTML を返す構成へ変更
  - `public/index.html`
  - `public/reserve.html`
  - `public/dashboard.html`
  - `public/patient.html`
- 画面ロジックも分割
  - `public/home.js`
  - `public/reserve.js`
  - `public/dashboard.js`
  - `public/patient.js`
  - `public/common.js`
- サーバは URL ごとに対応する HTML を返すように変更

### 5. 歯科医院サイトらしい LP へ再設計

- 歯科医院サイトの一般的な導線を調査
- 特に以下の情報構造を重視
  - 通いやすさ
  - 診療時間
  - 症状から探す導線
  - おすすめ診療
  - 医院の特徴
  - FAQ
- 参照サイトとして、あいおい歯科グループ池袋駅前歯医者・矯正歯科の情報構造を参考に、seed データと矛盾しない形へ変換

## 直近のサブエージェント作業

### A. ランディングページデザイン担当

- 担当範囲
  - `public/index.html`
  - `public/home.js`
  - `public/styles.css`
- 実施内容
  - 症状別導線、医院の特徴、アクセス/診療時間、FAQ を中心に再設計
  - ヒーローを整理し、画像の見せ場と CTA を分離
  - 3 カラムの圧迫感を減らし、縦方向の余白を増やす方向へ調整
  - reveal アニメーションやヒーローの浮遊演出を追加

### B. レントゲンAI解析担当

- 担当範囲
  - `public/patient.html`
  - `public/patient.js`
  - `server/app.js`
  - `server/clinic-store.js`
  - `server/validation.js`
  - `test/api.test.js`
- 実施内容
  - 患者詳細画面にレントゲン画像アップロード UI を追加
  - `POST /api/patients/:id/xrays/analyze` を追加
  - 解析結果を `xrayStudies`、`reports`、`history` に反映
  - 既存の `POST /api/generate-report` を利用して `live` 優先、失敗時は `fallback` へ切替

### C. 画像生成担当

- 担当範囲
  - `scripts/generate-lp-images.cjs`
  - `public/assets/*.png`
- 実施内容
  - LP 向けの実写寄り画像を OpenAI Images API で生成
  - `gpt-image-1.5` を優先し、失敗時は `gpt-image-1` にフォールバック
  - 「余白感」「引きの構図」「上質な医療LP向け」のトーンに調整
- 補足
  - OpenAI 側の課金上限により、すべての画像を毎回再生成できるとは限らない

## メインエージェントの統合作業

- 各サブエージェントの差分を読み合わせ
- 誇張表現や seed データと矛盾する文言を修正
- API と画面遷移の接続を確認
- `.env` を git へ含めないよう `.gitignore` を整備
- README を他者再現できる内容へ全面更新
- ワーキングログをこのファイルへ集約

## GitHub 公開準備

- 公開先
  - `https://github.com/ryota-nakazawa/codex_hackathon`
- 実施内容
  - `git init -b main` でローカルリポジトリを初期化
  - `.gitignore` に `.env`、`node_modules/`、`.DS_Store`、`npm-debug.log*` を設定
  - README に clone、`.env` 作成、起動、試験、画像再生成、確認手順を記載
  - ワーキングログにサブエージェント分担と統合作業の流れを整理
  - 実装と README の差分を確認し、`OPENAI_MODEL` の既定値表記を実装に合わせて修正
  - git へ含めるファイルを確認し、ローカル専用の `.env` は除外されていることを確認

## 自動試験と確認

- 構文確認
  - `node --check public/home.js`
  - `node --check public/patient.js`
  - `node --check server/app.js`
  - `node --check server/clinic-store.js`
  - `node --check server/validation.js`
- 自動試験
  - `npm test`
- 結果
  - 31 件すべて成功

## 現時点での注意点

- 予約・患者情報はメモリ保持のため、サーバ再起動で seed データへ戻る
- `OPENAI_API_KEY` がなくてもアプリ本体は動く
- `live` が使えない場合は診断補助は `fallback` に切り替わる
- LP 画像再生成は OpenAI の利用状況に依存する
