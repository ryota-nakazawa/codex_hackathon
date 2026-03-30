# Dental Clinic PoC

歯科医院向けの PoC アプリです。患者向けの医院サイトと予約フォーム、院内向けの予約一覧と患者詳細を分けて実装しています。患者詳細では、レントゲン画像をアップロードして AI 解析レポートを生成し、患者履歴へ反映できます。

## できること

- 患者向けランディングページ: `/`
- 患者向け予約フォーム: `/reserve`
- 院内向け予約一覧: `/dashboard`
- 患者詳細画面: `/patients/:id`
- レントゲン画像アップロードと AI 解析
- `mock` / `live` / `fallback` を切り替えられる診断補助 API

## 動作環境

- Node.js `18.17` 以上
- macOS / Linux / Windows で動作可
- 追加パッケージ不要

## ローカルでの復元方法

1. リポジトリを clone する

```bash
git clone https://github.com/ryota-nakazawa/codex_hackathon.git
cd codex_hackathon
```

2. 環境変数ファイルを作る

```bash
cp .env.example .env
```

3. 必要なら `.env` を編集する

- `HOST`: 既定値は `127.0.0.1`
- `PORT`: 既定値は `3000`
- `OPENAI_API_KEY`: `live` モードや画像生成を使う場合だけ設定
- `OPENAI_MODEL`: 既定値は `gpt-4.1-mini`
- `OPENAI_BASE_URL`: 既定値は `https://api.openai.com/v1`

4. アプリを起動する

```bash
npm start
```

5. ブラウザで開く

```text
http://127.0.0.1:3000
```

補足:

- このプロジェクトは Node 標準機能だけで動くため `npm install` は不要です
- `.env` は `.gitignore` に含めているため、そのまま git へ入ることはありません

## 開発用コマンド

起動:

```bash
npm start
```

ウォッチ起動:

```bash
npm run dev
```

試験:

```bash
npm test
```

LP 画像の再生成:

```bash
node scripts/generate-lp-images.cjs
```

補足:

- 画像生成は OpenAI の Images API を使います
- OpenAI 側の課金上限や利用状況によっては生成に失敗します
- `OPENAI_API_KEY` 未設定でもアプリ本体は動作します
- `live` モードが使えない場合は自動で `fallback` に切り替わります

## 確認手順

1. `/` を開いて LP を確認する
2. `/reserve` で予約を 1 件送信する
3. `/dashboard` で予約一覧に反映されていることを確認する
4. `/patients/p-001` を開いて患者詳細を確認する
5. レントゲン画像をアップロードして AI 解析結果が `xrayStudies` と `reports` に反映されることを確認する

## 主な API

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/appointments`
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/appointments`
- `POST /api/patients`
- `POST /api/patients/:id/reports`
- `POST /api/patients/:id/xrays/analyze`
- `POST /api/generate-report`

## ディレクトリ概要

- `public/`: 画面 HTML / JS / CSS / 画像素材
- `server/`: Node 標準 HTTP サーバと API
- `data/`: ダミーデータ
- `test/`: 自動試験
- `docs/`: 設計メモ、試験記録、ワーキングログ
- `scripts/`: 補助スクリプト

## 補助ドキュメント

- 画面遷移図: `docs/screen-transition.md`
- 設計メモ: `docs/architecture.md`
- セキュリティメモ: `docs/security-review.md`
- 試験記録: `docs/test-report.md`
- ワーキングログ: `docs/working-log.md`

## 現在の状態

- 自動試験は `31` 件すべて成功
- レントゲン AI 解析は患者詳細画面から実行可能
- LP 画像のうち一部は OpenAI 画像生成で差し替え済み
- 画像生成は OpenAI 側の課金上限により一部再生成できない場合があります
