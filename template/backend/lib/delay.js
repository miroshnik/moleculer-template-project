class Delay {
  constructor (min = 1000, max = null, maxAttempts = -1) {
    this.min = min
    if (max === null) {
      this.max = this.min
    } else {
      this.max = max
    }

    this.maxAttempts = maxAttempts

    if (this.maxAttempts > 0) {
      this.step = Math.floor((this.max - this.min) / this.maxAttempts)
    } else if (this.min === this.max) {
      this.step = 0
    } else {
      this.step = 1000
    }

    this.timeout = this.min
    this.currentAttempt = 0
  }

  async wait () {
    if (
      this.maxAttempts > 0 &&
      this.currentAttempt > this.maxAttempts
    ) {
      throw new Error(
        `Delay error: attempts: ${this.currentAttempt}, timeout: ${this.timeout}`
      )
    }

    await this.waitP(this.timeout)

    if (this.max && this.timeout + this.step <= this.max) {
      this.timeout += this.step
    }

    ++this.currentAttempt
  }

  waitP (timeout) {
    return new Promise(
      resolve => setTimeout(() => resolve(), timeout)
    )
  }
}

module.exports = Delay
