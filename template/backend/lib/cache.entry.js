class CacheEntry {
  /**
   * Constructor
   * @param {*} value
   * @param {Number|undefined}  ttl - in milliseconds
   */
  constructor (value, ttl) {
    this.value = value
    this.updatedAt = Date.now()
    this.ttl = ttl
  }

  /**
   * Check if cache entry is expired
   * @returns {Number|boolean}
   */
  isExpired () {
    return Number.isInteger(this.ttl) && this.updatedAt + this.ttl < Date.now()
  }
}

module.exports = CacheEntry
