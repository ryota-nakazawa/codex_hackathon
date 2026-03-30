# 設計エージェントメモ

## 推奨アーキテクチャ

- `Node標準HTTPサーバ` で API と静的ファイル配信を兼務
- `public/` に単一画面 UI を配置
- `server/app.js` が API と静的配信のエントリポイント
- `server/report-service.js` で `mock` `live` `fallback` を切り替え
- `server/openai.js` が OpenAI Responses API への任意接続を担当
- API 未設定または失敗時は `fallback` に自動退避
- データ永続化は行わず、PoC では送信都度処理

## ディレクトリ構成

- `public/`: UI
- `server/`: API、バリデーション、レポート生成
- `test/`: Node 標準テスト
- `docs/`: 設計・セキュリティ・試験メモ

## API

### `POST /api/generate-report`

入力:

```json
{
  "mode": "mock|live|fallback",
  "patientId": "string",
  "caseId": "string",
  "patientRequest": "string",
  "chartNotes": "string",
  "image": {
    "name": "string",
    "type": "image/png",
    "size": 1024,
    "dataUrl": "data:image/png;base64,..."
  }
}
```

出力:

```json
{
  "modeRequested": "live",
  "modeExecuted": "fallback",
  "generatedAt": "2026-03-29T00:00:00.000Z",
  "warnings": ["..."],
  "report": {
    "summary": "string",
    "checkpoints": ["string"],
    "patientExplanation": ["string"],
    "referencePoints": ["string"],
    "disclaimer": ["string"],
    "sourceSummary": {
      "hasImage": true,
      "hasText": true,
      "missingInputs": []
    }
  },
  "markdown": "# ..."
}
```

## 状態設計

- 初期: 未生成
- 入力中: フォーム編集、画像添付
- 生成中: ボタン押下後、ステータスを loading 表示
- 成功: レポートカードへ各セクションを分離表示
- 警告付き成功: `live -> fallback` などを明示
- 失敗: 入力不足、サイズ超過、API エラーを表示

## 要件対応

- 単一画面: `public/index.html`
- 3経路: `server/report-service.js`
- 単独入力許容: `server/validation.js`
- 制約順守: `server/report-generators.js`, `server/openai.js`
- Markdown エクスポート: `public/app.js`, `server/report-generators.js`
- 高セキュリティ配慮: `server/app.js`

## 実装注意

- PHI/PII を保存しない
- リクエスト本文をログ出力しない
- `live` は必ず失敗時退避を持つ
- 画像のみケースとテキストのみケースの文面ルールを固定化する
