# @tessiumdev/client

Minimal JavaScript client for [Tessium](https://tessium.dev) — a realtime Solana
data API. Open one WebSocket, subscribe to the streams you need, and receive
on-chain activity as structured events instead of raw RPC payloads you have to
decode yourself.

Eight streams over a single connection: `launches`, `migrations`,
`pool_creations`, `token_trades`, `token_transfers`, `candles`, `wallet_trades`,
`wallet_transfers`.

Zero dependencies — it uses the runtime's own `WebSocket`. Node 22+ or any
modern browser.

> **Preview.** `0.0.x` tracks the published protocol and has not been exercised
> against a production endpoint yet. Pin an exact version.

## Install

```bash
npm i @tessiumdev/client
```

## Watch new token launches

Every new token on pump.fun, printed as it happens:

```js
import { events } from '@tessiumdev/client'

for await (const frame of events('YOUR_API_KEY', 'launches', {
  platforms: ['pumpfun'],
})) {
  const launch = frame.data
  console.log(launch.symbol, launch.mint)
}
```

Frames arrive whole rather than unwrapped, because `frame.cursor` is what you
persist after processing an event — it is how you
[replay a short disconnect](https://tessium.dev/docs/protocol/cursor) instead of
losing the gap.

An [API key](https://tessium.dev/dashboard) on the
[free plan](https://tessium.dev/pricing) needs no payment details. Keep
production keys server-side.

## Also here

```js
import { ENDPOINT, STREAMS, endpoint, subscribeFrame } from '@tessiumdev/client'
```

`endpoint()` builds the URL, `subscribeFrame()` builds the subscribe frame —
useful when you drive the socket yourself. TypeScript types ship with the
package.

## More

- [Documentation](https://tessium.dev/docs/) — protocol frames, cursors and
  replay, per-stream payloads, limits
- [Runnable examples](https://github.com/tessiumdev/tessium-example) — launch to
  trades, early volume filter, Telegram alerts, in Node and Python
- [Coverage](https://tessium.dev/coverage) — every launchpad, AMM and router
  Tessium reads

## License

MIT
