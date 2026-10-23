# Multiplayer Game

公開URL：https://road-to-kanagawa.fow-shogi.workers.dev

GitHub：https://github.com/nishi-0213/road-to-kanagawa

Cloudflare Workers + Durable Objects + WebSocket + Phaser の最小構成です。

ブラウザいっぱいの空のPhaserウィンドウに、HTMLの「1人で遊ぶ」「ルーム作成」「ルームコードを入力して入室」を重ねます。入室後はHTMLを隠します。入室すると「準備フェーズ」を表示し、右側に人数分の準備完了ボタンを並べます。自分のボタンのみ操作でき、全員が準備完了になると「戦闘フェーズ」へ移行します。戦闘ではWASDで移動し、Shiftで1.5倍のダッシュ（4秒消費・6秒回復）ができます。32pxタイルのランダムマップを左下から進み、右上の発光する脱出ゾーンへ全員が3秒集まると準備へ戻ります。ルームは最大4人で、ゲーム画面内にコードと人数、招待URLコピー、退出を表示します。準備完了は全員が押すまで取り消せます。戦闘開始後の途中参加はできません。アカウント認証ではなく入室操作のみです。

## ローカル開発（Node.js 22以降）

```sh
npm ci
npm run build
npm run server
```

http://localhost:8787 を開きます。別ターミナルで `npm run dev` を起動すると http://localhost:5173 でクライアント変更を自動反映できます。

## 検証・公開

```sh
npm test
npm run build
npm run deploy:check
# サーバー起動中
npm run test:ws
npm run test:battle:ws
# Cloudflare認証後に公開
npm run deploy
```

WebSocket専用トークンは不要。APIトークンはデプロイ環境のみに設定し、GitHubやブラウザには含めないでください。1人プレイは通信しません。協力プレイは休止対応のDurable Objects WebSocket APIを使用し、ルーム存在フラグのみ永続保存します。ルームコードは招待用で、個別ユーザー認証や進行保存はありません。

プレイヤーはユーザー提供の透過32×32 PNG（`client/assets/player.png`）を使用します。
