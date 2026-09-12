/** A refusal from the service: the request named by `sub` did not happen. */
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
