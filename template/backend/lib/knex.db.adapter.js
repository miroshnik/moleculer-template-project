const _ = require('lodash')
const assert = require('assert')
const Knex = require('knex')

class KnexDbAdapter {
  /**
   * Creates an instance of KnexDbAdapter.
   *
   * @param {Object} config
   *
   * @memberof KnexDbAdapter
   */
  constructor (config) {
    this.config = config
    this.schema = 'public'
  }

  /**
   * Initialize adapter
   *
   * @param {ServiceBroker} broker
   * @param {Service} service
   *
   * @memberof KnexDbAdapter
   */
  init (broker, service) {
    assert(broker, 'broker is required')
    assert(service, 'service is required')
    assert(service.schema && service.schema.table, 'table is required')

    this.broker = broker
    this.service = service
    this.table = this.service.schema.table
  }

  /**
   * Connect to database
   *
   * @returns {Promise}
   *
   * @memberof KnexDbAdapter
   */
  async connect () {
    if (this.config.testMode) {
      this.db = Knex({ client: 'pg', connection: {} })
    } else {
      this.db = Knex({
        ...this.config,
        connection: { ...this.config.connection, application_name: `${this.broker.nodeID}/${this.service.name}` }
      })
    }

    return Promise.resolve()
  }

  /**
   * Disconnect from database
   *
   * @returns {Promise}
   *
   * @memberof KnexDbAdapter
   */
  async disconnect () {
    if (this.db) {
      return this.db.destroy()
    }

    return Promise.resolve()
  }

  /**
   * Find all entities by filters.
   *
   * Available filter props:
   *  - limit
   *  - offset
   *  - sort
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} filters
   * @returns {Promise<Array>}
   *
   * @memberof KnexDbAdapter
   */
  async find (filters) {
    let query = this.db(this.table)

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.offset(filters.offset)
    }

    if (Array.isArray(filters.sort) && filters.sort.length) {
      const sortRules = filters.sort.map(
        sortField => {
          if (sortField[0] === '-') {
            return {
              column: sortField.substring(1),
              order: 'desc'
            }
          } else {
            return {
              column: sortField[0] === '+' ? sortField.substring(1) : sortField,
              order: 'asc'
            }
          }
        }
      )

      query = query.orderBy(sortRules)
    }

    if (filters.query) {
      query = this.applyQueryDefinition(query, filters.query)
    }

    return query.select('*')
  }

  /**
   * Find an entities by ID.
   *
   * @param {String} id
   * @returns {Promise<Object>} Return with the found document.
   *
   * @memberof KnexDbAdapter
   */
  async findById (id) {
    return this.db(this.table)
      .where('id', id)
      .first()
  }

  /**
   * Find any entities by IDs.
   *
   * @param {Array} idList
   * @returns {Promise<Array>} Return with the found documents in an Array.
   *
   * @memberof KnexDbAdapter
   */
  async findByIds (idList) {
    return this.db(this.table)
      .whereIn('id', idList)
  }

  /**
   * Get count of filtered entities.
   *
   * Available query props:
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} [filters={}]
   * @returns {Promise<Number>} Return with the count of documents.
   *
   * @memberof KnexDbAdapter
   */
  async count (filters) {
    const result = await this.applyQueryDefinition(this.db(this.table), filters.query).count()

    return Number.parseInt(result[0].count)
  }

  /**
   * Insert an entity.
   *
   * @param {Object} entity
   * @returns {Promise<Object>} Return with the inserted document.
   *
   * @memberof KnexDbAdapter
   */
  async insert (entity) {
    return this.db(this.table)
      .insert(entity)
      .returning('*')
  }

  /**
   * Insert many entities
   *
   * @param {Array} entities
   * @param {Boolean} useTransaction
   * @returns {Promise<Array<Object>>} Return with the inserted documents in an Array.
   *
   * @memberof KnexDbAdapter
   */
  async insertMany (entities, useTransaction = false) {
    return this.db(this.table)
      .insert(entities)
      .returning('*')
  }

  /**
   * Update an entity by ID and `update`
   *
   * @param {String} id - ObjectID as hexadecimal string.
   * @param {Object} update
   * @param {Object} lock
   * @param {Object} query
   * @returns {Promise<Object>} Return with the updated document.
   *
   * @memberof KnexDbAdapter
   */
  async updateById (id, update, lock = {}, query) {
    return this.execTransaction(async trx => this.applyQueryDefinition(trx(this.table), { $and: [{ id }, query] }).update(update).returning('*'), lock)
  }

  async updateMany (query, update, lock = {}) {
    return this.execTransaction(async trx => this.applyQueryDefinition(trx(this.table), query).update(update).returning('*'), lock)
  }

  /**
   * Remove an entity by ID
   *
   * @param {String} id - ObjectID as hexadecimal string.
   * @param {Object} lock
   * @returns {Promise<Object>} Return with the removed document.
   *
   * @memberof KnexDbAdapter
   */
  async removeById (id, lock = {}) {
    return this.execTransaction(
      trx => trx(this.table)
        .where({ id })
        .del(),
      lock
    )
  }

  async sync (entities, conflicts, lock, newOnly, removeQuery = {}, remove = true) {
    return this.execTransaction(
      async trx => {
        const results = (
          await Promise.all(
            _.chunk(entities, 500).map(
              entitiesChunk => this.upsert(
                this.table, conflicts,
                entitiesChunk, trx, newOnly, {}
              )
            )
          )
        ).flat()

        if (remove && conflicts && conflicts.length) {
          await this.removeMany({
            $and: [removeQuery, {
              $not: {
                $or: entities.map(entity => conflicts.reduce((p, c) => ({
                  ...p,
                  [c]: entity[c]
                }), {}))
              }
            }]
          }, lock, trx)
        }

        return results
      }, lock
    )
  }

  async removeMany (query, lock = {}, trx = null) {
    if (trx) {
      return this.applyQueryDefinition(trx(this.table), query).del()
    } else {
      return this.execTransaction(async trx => this.applyQueryDefinition(trx(this.table), query).del(), lock)
    }
  }

  /**
   * Convert DB entity to JSON object. It converts the `_id` to hexadecimal `String`.
   *
   * @param {Object} entity
   * @returns {Object}
   * @memberof KnexDbAdapter
   */
  entityToObject (entity) {
    return Object.assign({}, entity)
  }

  /**
   * For compatibility only.
   * @param {Object} entity
   * @param {String} idField
   * @memberof KnexDbAdapter
   * @returns {Object} Entity
   */
  beforeSaveTransformID (entity, idField) {
    return entity
  }

  /**
   * For compatibility only.
   * @param {Object} entity
   * @param {String} idField
   * @memberof KnexDbAdapter
   * @returns {Object} Entity
   */
  afterRetrieveTransformID (entity, idField) {
    return entity
  }

  hashCode (s) {
    return s.split('').reduce(function (a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
  }

  createTransaction () {
    return new Promise((resolve) => {
      return this.db.transaction(resolve)
    })
  }

  setAdvisoryLock (trx, lock) {
    return this.db.raw(
      `select pg_advisory_xact_lock(${this.hashCode(Object.entries(lock).sort((a, b) => a - b).join('|'))})`
    ).transacting(trx)
  }

  async upsert (table, conflicts, item, trx, newOnly, lock = {}) {
    if (trx) {
      return this.upsertQuery(table, conflicts, item, trx, newOnly)
    } else {
      return this.execTransaction(
        trx => this.upsertQuery(table, conflicts, item, trx, newOnly),
        lock
      )
    }
  }

  async execTransaction (action, lock) {
    const trx = await this.createTransaction()
    try {
      if (lock && Object.keys(lock).length > 0) {
        await this.setAdvisoryLock(trx, lock)
      }

      const result = await action(trx)
      await trx.commit()

      return result
    } catch (err) {
      await trx.rollback()

      return Promise.reject(err)
    }
  }

  async upsertQuery (table, conflicts, item, trx, newOnly) {
    let items
    let updates
    let bindings
    let sql

    try {
      items = _(item).castArray().compact().value()
      updates = Object.keys(items[0]).reduce((p, c) => conflicts.includes(c) ? p : [...p, `"${c}" = excluded."${c}"`], [])
      bindings = this.flatExtract(items)

      sql = `
          INSERT INTO ${table} as t (${Object.keys(items[0]).join(', ')})
          VALUES${new Array(items.length).fill(`(${new Array(Object.keys(items[0]).length).fill('?').join(', ')})`).join(',')}
            ON CONFLICT (${conflicts.map(i => `"${i}"`).join(', ')})
              DO ${updates.length ? 'UPDATE SET ' + updates.join(', ') : 'NOTHING'}
          ${newOnly ? `where t."${newOnly}" is null or excluded."${newOnly}" >= t."${newOnly}"` : ''}
          RETURNING *`

      const res = await (trx || this).raw(sql, bindings)

      return Array.isArray(item) ? res.rows : res.rows[0]
    } catch (error) {
      this.service.logger.error('upsertQuery error', { error, sql, bindings })

      throw error
    }
  }

  flatExtract (items) {
    return items.reduce((p, c) => [...p, ...Object.values(c)], [])
  }

  applyQueryDefinition (query, queryDefinition) {
    if (!queryDefinition || (typeof queryDefinition === 'object' && !Object.keys(queryDefinition).length)) {
      return query
    }

    if (typeof queryDefinition !== 'object' || Array.isArray(queryDefinition)) {
      throw new Error('Query definition must be an object')
    }

    const adapter = this

    const [operator] = Object.keys(queryDefinition)
    const operand = queryDefinition[operator]

    if (Object.keys(queryDefinition).length > 1) {
      Object.keys(queryDefinition).forEach(qd => {
        this.applyQueryDefinition(query, { [qd]: queryDefinition[qd] })
      })

      return query
    } else {
      const [subOperator] = operand ? Object.keys(operand) : [operand]
      const subOperand = subOperator ? operand[subOperator] : null

      if (!operator.startsWith('$') && typeof operand === 'object' && !Array.isArray(operand) && subOperator && !subOperator.startsWith('$')) {
        return query.andWhereRaw(`"${operator}" = '${JSON.stringify(operand)}'`)
      }

      switch (operator) {
        case '$not':
          return query.whereNot(function () {
            return adapter.applyQueryDefinition(this, operand)
          })

        case '$and':
          if (Array.isArray(operand)) {
            operand.forEach(o => {
              query.andWhere(function () {
                if (o && typeof o === 'object') {
                  adapter.applyQueryDefinition(this, o)
                } else {
                  query.andWhere({ [o]: operand[o] })
                }
              })
            })
            return query
          } else if (operand && typeof operand === 'object') {
            return query.andWhere(function () {
              Object.keys(operand).forEach(o => {
                adapter.applyQueryDefinition(this, { [o]: operand[o] })
              })
            })
          }
          break

        case '$or':
          if (Array.isArray(operand)) {
            operand.forEach(o => {
              query.orWhere(function () {
                if (o && typeof o === 'object') {
                  adapter.applyQueryDefinition(this, o)
                } else {
                  query.orWhere({ [o]: operand[o] })
                }
              })
            })
            return query
          } else if (operand && typeof operand === 'object') {
            return query.orWhere(function () {
              Object.keys(operand).forEach(o => {
                adapter.applyQueryDefinition(this, { [o]: operand[o] })
              })
            })
          }
          break
      }

      switch (subOperator) {
        case '$eq':
          return query.where({ [operator]: subOperand })

        case '$ne':
          return query.where(operator, '!=', subOperand)

        case '$gt':
          return query.where(operator, '>', subOperand)

        case '$gte':
          return query.where(operator, '>=', subOperand)

        case '$lt':
          return query.where(operator, '<', subOperand)

        case '$lte':
          return query.where(operator, '<=', subOperand)

        case '$is':
          return query.where({ [operator]: subOperand })

        case '$in':
          return query.whereIn(operator, subOperand)

        case '$notIn':
          return query.whereNotIn(operator, subOperand)

        case '$between':
          return query.whereBetween(operator, subOperand)

        case '$notBetween':
          return query.whereNotBetween(operator, subOperand)

        case '$like':
          return query.where(operator, 'like', subOperand)

        case '$iLike':
          return query.where(operator, 'iLike', subOperand)

        case '$overlap':
          return query.where(operator, '&&', subOperand)

        case '$contains':
          return query.where(operator, '@>', subOperand)

        case '$contained':
          return query.where(operator, '<@', subOperand)

        default:
          if (operator.charAt(0) !== '$') {
            if (operand && !Array.isArray(operand) && typeof operand === 'object' && Object.keys(operand).length > 1) {
              return this.applyQueryDefinition(query, { [operator]: { $and: Object.keys(operand).map(o => ({ [o]: operand[o] })) } })
            } else if (operand && !Array.isArray(operand) && typeof operand === 'object' && Object.keys(operand).length === 1) {
              if (Array.isArray(subOperand)) {
                return this.applyQueryDefinition(query, { [subOperator]: subOperand.map(o => ({ [operator]: o })) })
              } else if (subOperand && typeof subOperand === 'object') {
                return this.applyQueryDefinition(query, { [subOperator]: Object.keys(subOperand).map(o => ({ [operator]: { [o]: subOperand[o] } })) })
              } else {
                // console.log('!!!', { operator, operand, subOperator, subOperand })
                return this.applyQueryDefinition(query, { [subOperator]: { [operator]: subOperand } })
              }
            } else if (Array.isArray(operand)) {
              throw new Error('Incorrect value type \'array\'')
            } else {
              return query.where({ [operator]: operand })
            }
          } else {
            throw new Error(`Unsupported operator '${operator}'`)
          }
      }
    }
  }
}

module.exports = KnexDbAdapter
