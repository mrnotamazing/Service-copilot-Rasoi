// Service clock. In live POS mode it is wall time; in simulation it can run
// faster than real time (and pause) so a whole dinner service fits in a demo.

export class Clock {
  private anchorReal = Date.now()
  private anchorSim = Date.now()
  speed = 1
  paused = false

  now(): number {
    return this.paused ? this.anchorSim : this.anchorSim + (Date.now() - this.anchorReal) * this.speed
  }

  private rebase() {
    this.anchorSim = this.now()
    this.anchorReal = Date.now()
  }

  setSpeed(speed: number) {
    this.rebase()
    this.speed = speed
  }

  pause() {
    this.rebase()
    this.paused = true
  }

  resume() {
    this.anchorReal = Date.now()
    this.paused = false
  }

  /** Jump to a given service time, e.g. the start of the evening, or past the last stored event. */
  set(at: number) {
    this.anchorSim = at
    this.anchorReal = Date.now()
  }
}
