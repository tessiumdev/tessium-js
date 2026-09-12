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

An [API key](https://tessium.dev/dashboard) on the
[free plan](https://tessium.dev/pricing) needs no payment details. Keep
production keys server-side.

## Several streams, one connection

`events()` spends a connection per stream, and a plan sells only a few. Reach for
`connect()` the moment you want a second one — every event names the subscription
it came from:

```js
import { connect } from '@tessiumdev/client'

const tessium = connect('YOUR_API_KEY')
tessium.subscribe('launches', { platforms: ['pumpfun'] }, { sub: 'new' })
tessium.subscribe('token_trades', { mint: 'So11111111111111111111111111111111111111112' }, { sub: 'sol' })

for await (const frame of tessium) {
  if (frame.sub === 'new') console.log('launch', frame.data.symbol)
  else console.log('trade', frame.data.tradeType, frame.data.valueUsd)
}
```

## Disconnects are handled for you

The socket will end — networks drop, and the service drains its sessions on every
deploy. The client reopens it with a jittered backoff and resubscribes **from the
last cursor it saw**, so the gap is filled by the replay window rather than lost.
Nothing is required of you.

Two details worth knowing:

- Replay is a paid capability. On the free plan the server refuses the cursor, and
  the client resubscribes live instead of giving up — you keep the stream, you just
  lose the events from the seconds you were away.
- Refusals raise. A wrong key, a stream the plan does not carry, `detail: "full"`
  without it — each throws a `TessiumError` carrying `code`, `feature` and the
  cheapest `upgrade` that lifts it. Nothing fails quietly.

```js
import { connect, TessiumError } from '@tessiumdev/client'

const tessium = connect('YOUR_API_KEY', {
  onNotice: (n) => console.warn(n.code, n.message),
})
tessium.subscribe('token_trades', { mint: MINT })

try {
  for await (const frame of tessium) handle(frame)
} catch (err) {
  if (err instanceof TessiumError) console.error(err.code, err.feature, err.upgrade)
  else throw err
}
```

`onNotice` is where the server's own remarks arrive: `server_restart` before a
handover, `gap` when a resume fell outside the window, `dropped` when a reader is
too slow to keep up.

Pass `{ reconnect: false }` for a single socket that ends when it ends.

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
