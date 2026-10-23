# Road to Kanagawa の開発

- 作業前に `docs/GAME_DESIGN.md` と `docs/CHANGELOG.md` を確認する。原案は `docs/ORIGINAL_PROPOSAL.md`。最新のユーザー指示を優先し、実装済み・仮設定・未決定を区別する。
- ユーザーとの会話で仕様が追加・変更されたら、実装と同じコミットで `docs/GAME_DESIGN.md` と `docs/CHANGELOG.md` を更新する。今後の会話も各開発タスクで反映する。トークンなどの秘密情報を記録しない。
- すべての可視UIはPhaserのゲームウィンドウ内に表示する。日本語IME・貼り付け用の非表示ネイティブ入力は利用できる。
- 1人プレイではWebSocketやルーム作成APIを使用しない。協力プレイの重要判定はDurable Objectが確定し、クライアント入力を検証する。
- JavaScriptを使用し、動作済み機能を保ちながら小さく検証する。画像がなければ図形で仮表示する。
- 各クラウドタスクは隔離済み。既存チェックアウトを使用し、ユーザーから明示的な依頼がない限りGit worktreeを作らない。
- 検証の基本は `npm test`、`npm run build`、Wrangler起動中の `node tests/websocket-smoke.js`。UI変更はブラウザでも確認する。起動方法はREADMEに記載する。
