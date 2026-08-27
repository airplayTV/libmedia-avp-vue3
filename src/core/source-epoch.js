export class SourceEpoch {
  #current = 0

  get current() {
    return this.#current
  }

  next() {
    this.#current += 1
    return this.#current
  }

  isCurrent(epoch) {
    return epoch === this.#current
  }
}
