export const ENDPOINT = 'wss://api.tessium.dev/stream'

export const STREAMS = [
  'launches',
  'migrations',
  'pool_creations',
  'token_trades',
  'token_transfers',
  'candles',
  'wallet_trades',
  'wallet_transfers',
]

// Refusals no reconnection can fix. Everything else is worth another socket.
export const TERMINAL = new Set(['unauthorized', 'key_revoked', 'account_banned', 'account_deleted'])

export function endpoint(apiKey, base = ENDPOINT) {
  return `${base}?key=${apiKey}`
}

export function subscribeFrame(stream, params, id = 1) {
  const frame = { op: 'subscribe', stream, id }
  if (params) frame.params = params
  return frame
}
