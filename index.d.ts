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
  /** Persist this after processing to replay a short disconnect. */
  cursor: string
  data: T
}

export declare function events<T = Record<string, unknown>>(
  apiKey: string,
  stream: string,
  params?: Record<string, unknown>,
  options?: { base?: string },
): AsyncGenerator<EventFrame<T>, void, void>
