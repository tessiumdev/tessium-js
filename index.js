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
const TERMINAL = new Set(['unauthorized', 'key_revoked', 'account_banned', 'account_deleted'])

const BACKOFF_MIN_MS = 250
const BACKOFF_MAX_MS = 10_000
const DEFAULT_MAX_QUEUE = 10_000

export class TessiumError extends Error {
  constructor(frame) {
    super(frame.message || frame.code)
    this.name = 'TessiumError'
    this.code = frame.code
    this.feature = frame.feature
    this.upgrade = frame.upgrade
    this.sub = frame.sub
  }
}

export function endpoint(apiKey, base = ENDPOINT) {
  return `${base}?key=${apiKey}`
}

export function subscribeFrame(stream, params, id = 1) {
  const frame = { op: 'subscribe', stream, id }
  if (params) frame.params = params
  return frame
}

/**
 * One socket, as many subscriptions as the plan allows.
 *
 * Events are yielded whole because `cursor` lives on the frame and a resume is
 * made of it. The client remembers the last cursor of every subscription, so a
 * dropped socket costs nothing the replay window still covers.
 */
class Client {
  #url
  #reconnect
  #maxQueue
  #onNotice
  #ws = null
  #subs = new Map()
  #pending = new Map()
  #queue = []
  #wake = null
  #failure = null
  #done = false
  #nextId = 1
  #attempt = 0
  #timer = null
  #overflowed = false

  constructor(apiKey, { base = ENDPOINT, reconnect = true, maxQueue = DEFAULT_MAX_QUEUE, onNotice } = {}) {
    this.#url = endpoint(apiKey, base)
    this.#reconnect = reconnect
    this.#maxQueue = maxQueue
    this.#onNotice = onNotice
    this.#connect()
  }

  /** Open a subscription and return its name, which every one of its events carries. */
  subscribe(stream, params, { sub } = {}) {
    const name = sub ?? `${stream}_${this.#nextId}`
    if (this.#subs.has(name)) throw new Error(`tessium: subscription "${name}" already exists`)
    const entry = { stream, params, cursor: null, resumable: true }
    this.#subs.set(name, entry)
    if (this.#ws?.readyState === 1) this.#sendSubscribe(name, entry)
    return name
  }

  unsubscribe(sub) {
    if (!this.#subs.delete(sub)) return
    if (this.#ws?.readyState === 1) {
      this.#ws.send(JSON.stringify({ op: 'unsubscribe', sub, id: this.#nextId++ }))
    }
  }

  close() {
    this.#done = true
    clearTimeout(this.#timer)
    this.#ws?.close()
    this.#wake?.()
  }

  async *[Symbol.asyncIterator]() {
    try {
      while (true) {
        while (this.#queue.length) yield this.#queue.shift()
        if (this.#failure) throw this.#failure
        if (this.#done) return
        await new Promise((resolve) => {
          this.#wake = resolve
        })
      }
    } finally {
      this.close()
    }
  }

  #sendSubscribe(name, entry) {
    const id = this.#nextId++
    const frame = { op: 'subscribe', stream: entry.stream, sub: name, id }
    if (entry.params) frame.params = entry.params
    if (entry.cursor && entry.resumable) frame.cursor = entry.cursor
    this.#pending.set(id, name)
    this.#ws.send(JSON.stringify(frame))
  }

  #push(frame) {
    if (this.#queue.length >= this.#maxQueue) {
      this.#queue.shift()
      if (!this.#overflowed) {
        this.#overflowed = true
        this.#emit({
          op: 'notice',
          code: 'client_queue_full',
          message: 'events arrive faster than this program reads them; the oldest are being dropped',
        })
      }
    }
    this.#queue.push(frame)
    this.#wake?.()
  }

  #emit(frame) {
    this.#onNotice?.(frame)
  }

  #fail(error) {
    this.#failure ??= error
    this.#done = true
    clearTimeout(this.#timer)
    this.#wake?.()
  }

  #connect() {
    if (this.#done) return
    const ws = new WebSocket(this.#url)
    this.#ws = ws

    ws.addEventListener('open', () => {
      this.#attempt = 0
      for (const [name, entry] of this.#subs) this.#sendSubscribe(name, entry)
    })
    ws.addEventListener('message', (e) => {
      let frame
      try {
        frame = JSON.parse(e.data)
      } catch {
        return
      }
      this.#receive(frame)
    })
    // A socket that ends is the ordinary case, not a failure: the service drains
    // its sessions on every deploy, and says so before it does.
    ws.addEventListener('close', () => this.#retry())
    ws.addEventListener('error', () => ws.close())
  }

  #receive(frame) {
    switch (frame.op) {
      case 'event': {
        const entry = this.#subs.get(frame.sub)
        if (entry) entry.cursor = frame.cursor
        this.#push(frame)
        return
      }
      case 'ack':
        this.#pending.delete(frame.id)
        return
      case 'notice':
        if (TERMINAL.has(frame.code)) this.#fail(new TessiumError(frame))
        else this.#emit(frame)
        return
      case 'error': {
        const name = this.#pending.get(frame.id)
        this.#pending.delete(frame.id)
        if (TERMINAL.has(frame.code)) return this.#fail(new TessiumError(frame))
        // Replay is a paid capability, and losing it is not worth losing the
        // stream: the subscription opens again live instead of being abandoned.
        const entry = frame.feature === 'cursor' && name ? this.#subs.get(name) : undefined
        if (entry) {
          entry.resumable = false
          entry.cursor = null
          this.#sendSubscribe(name, entry)
          return
        }
        this.#fail(new TessiumError({ ...frame, sub: name }))
      }
    }
  }

  #retry() {
    if (this.#done || !this.#reconnect) {
      this.#done = true
      this.#wake?.()
      return
    }
    // Full jitter, because every client of a service that drains its sessions
    // would otherwise come back in the same instant it was let go.
    const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.#attempt++)
    this.#timer = setTimeout(() => this.#connect(), Math.random() * ceiling)
  }
}

export function connect(apiKey, options) {
  return new Client(apiKey, options)
}

/**
 * Yield `event` frames for a single subscription — the shortest thing that works.
 *
 * Reach for `connect` as soon as you want a second stream: one connection carries
 * all eight, while every call here spends a connection of its own.
 */
export async function* events(apiKey, stream, params, options) {
  const client = connect(apiKey, options)
  client.subscribe(stream, params)
  try {
    yield* client
  } finally {
    client.close()
  }
}
