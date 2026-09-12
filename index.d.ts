export declare const ENDPOINT: string

export declare const STREAMS: readonly string[]

export declare function endpoint(apiKey: string, base?: string): string

export interface SubscribeFrame {
  op: 'subscribe'
  stream: string
  id: number
  params?: Record<string, unknown>
}

export declare function subscribeFrame(
  stream: string,
  params?: Record<string, unknown>,
  id?: number,
): SubscribeFrame

export interface EventFrame<T = Record<string, unknown>> {
  op: 'event'
  sub: string
  stream: string
  /** The position of this event in the chain; a resume is made of it. */
  cursor: string
  data: T
}

export interface NoticeFrame {
  op: 'notice'
  /** `server_restart`, `gap`, `slow_consumer`, `dropped`, `client_queue_full`, … */
  code: string
  sub?: string
  message?: string
}

export interface Upgrade {
  plan: string
  priceCents: number
  currency: string
}

/** A refusal from the service: the request named by `sub` did not happen. */
export declare class TessiumError extends Error {
  code: string
  /** Set when `code` is `not_on_plan`: the capability the plan withholds. */
  feature?: string
  /** The cheapest plan that lifts the refusal, when one does. */
  upgrade?: Upgrade
  sub?: string
}

export interface ClientOptions {
  base?: string
  /** Reopen the socket and resume every subscription. Default: true. */
  reconnect?: boolean
  /** Events held for a slow reader before the oldest are dropped. Default: 10000. */
  maxQueue?: number
  onNotice?: (notice: NoticeFrame) => void
}

export declare class Client<T = Record<string, unknown>> {
  /** Open a subscription and return its name, which every one of its events carries. */
  subscribe(stream: string, params?: Record<string, unknown>, options?: { sub?: string }): string
  unsubscribe(sub: string): void
  close(): void
  [Symbol.asyncIterator](): AsyncGenerator<EventFrame<T>, void, void>
}

export declare function connect<T = Record<string, unknown>>(
  apiKey: string,
  options?: ClientOptions,
): Client<T>

export declare function events<T = Record<string, unknown>>(
  apiKey: string,
  stream: string,
  params?: Record<string, unknown>,
  options?: ClientOptions,
): AsyncGenerator<EventFrame<T>, void, void>
