const { MoleculerClientError } = require('moleculer').Errors
const DbService = require('moleculer-db')

const Mixin = {

  POOL_MIN: 13,
  POOL_MAX: 74,

  mixins: [DbService],

  actions: {
    count: {
      cache: {
        enabled: true,
        ttl: 60 * 60 * 24
      },
      bulkhead: {
        enabled: true,
        concurrency: 4
      }
    },

    create: {
      bulkhead: {
        enabled: true,
        concurrency: 1
      }
    },

    find: {
      cache: {
        enabled: true,
        ttl: 60 * 60 * 24,
        keys: ['populate', 'fields', 'limit', 'offset', 'sort', 'search', 'searchFields', 'query', '#user.id', 'lang', 'with']
      },
      bulkhead: {
        enabled: true,
        concurrency: 20
      }
    },

    get: {
      cache: {
        enabled: true,
        ttl: 60 * 60 * 24,
        keys: ['id', 'populate', 'fields', 'mapping', '#user.id', 'lang', 'with']
      },
      bulkhead: {
        enabled: true,
        concurrency: 8
      }
    },

    insert: {
      bulkhead: {
        enabled: true,
        concurrency: 4
      }
    },

    list: {
      cache: {
        enabled: true,
        ttl: 60 * 60 * 24,
        keys: ['populate', 'fields', 'page', 'pageSize', 'sort', 'search', 'searchFields', 'query', '#user.id', 'lang', 'with']
      },
      bulkhead: {
        enabled: true,
        concurrency: 1
      }
    },

    remove: {
      bulkhead: {
        enabled: true,
        concurrency: 1
      },
      params: {
        id: { type: 'any' },
        lock: { type: 'object', optional: true }
      },
      handler (ctx) {
        const params = this.sanitizeParams(ctx, ctx.params)
        const id = this.decodeID(params.id)

        return this.adapter.removeById(id, ctx.params.lock)
          .then(doc => {
            if (!doc) {
              return Promise.reject(new MoleculerClientError(params.id))
            }

            return this.transformDocuments(ctx, params, doc)
              .then(json => this.entityChanged('removed', json, ctx).then(() => json))
          })
      }
    },

    removeMany: {
      bulkhead: {
        enabled: true,
        concurrency: 1
      },
      params: {
        query: { type: 'object' },
        lock: { type: 'object', optional: true }
      },
      handler (ctx) {
        const params = this.sanitizeParams(ctx, ctx.params)

        return this.adapter.removeMany(params.query || {}, params.lock)
      }
    },

    sync: {
      bulkhead: {
        enabled: true,
        concurrency: 1
      },
      params: {
        entities: { type: 'array' },
        conflicts: { type: 'array' },
        lock: { type: 'object', optional: true },
        newOnly: { type: 'string', optional: true },
        removeQuery: { type: 'object', optional: true },
        remove: { type: 'boolean', optional: true }
      },
      async handler (ctx) {
        const params = this.sanitizeParams(ctx, ctx.params)

        return this.validateEntity(params.entities)
          .then(entities => this.adapter.sync(
            entities, params.conflicts, params.lock,
            params.newOnly, params.removeQuery, params.remove
          ))
          .then(docs => this.transformDocuments(ctx, ctx.params, docs))
          .then(
            transformedDocs => {
              this.entityChanged('updated', transformedDocs, ctx)
                .catch(err => this.logger.error('sync', { err }))

              return Promise.resolve(transformedDocs)
            }
          )
      }
    },

    update: {
      bulkhead: {
        enabled: true,
        concurrency: 12
      },
      params: {
        id: { type: 'any', optional: false },
        lock: { type: 'object', optional: true },
        data: { type: 'object', optional: false }, // fields to update
        query: { type: 'object', optional: true }
      },
      handler (ctx) {
        const id = this.decodeID(ctx.params.id)

        return this.adapter.updateById(id, ctx.params.data, ctx.params.lock, ctx.params.query)
          .then(doc => {
            if (!doc) {
              return Promise.reject(new MoleculerClientError(ctx.params.id))
            }

            return this.transformDocuments(ctx, ctx.params, doc)
              .then(json => this.entityChanged('updated', json, ctx).then(() => json))
          })
      }
    },

    updateMany: {
      bulkhead: {
        enabled: true,
        concurrency: 12
      },
      params: {
        query: { type: 'object', optional: true },
        lock: { type: 'object', optional: true },
        data: { type: 'object', optional: false } // fields to update
      },
      handler (ctx) {
        const params = this.sanitizeParams(ctx, ctx.params)

        return this.adapter.updateMany(params.query, params.data, params.lock)
      }
    },

    /**
     * Upsert one or many entities.
     *
     * @actions
     *
     * @param {Object?} entity - Entity to upsert.
     * @param {Array.<Object>?} entities - Entities to upsert.
     *
     * @returns {Object|Array.<Object>} Upserted entity(ies).
     */
    upsert: {
      bulkhead: {
        enabled: true,
        concurrency: 24,
        maxQueueSize: 100000
      },
      params: {
        entity: { type: 'object', optional: true },
        entities: { type: 'array', optional: true },
        conflicts: { type: 'array' },
        lock: { type: 'object', optional: true },
        newOnly: { type: 'string', optional: true }
      },
      handler (ctx) {
        const params = this.sanitizeParams(ctx, ctx.params)

        if (params.newOnly && (
          (params.entity && !Object.keys(params.entity).includes(params.newOnly)) ||
          (params.entities && params.entities.length && !Object.keys(params.entities[0]).includes(params.newOnly))
        )) {
          return Promise.reject(
            new MoleculerClientError(`upsert: Wrong newOnly value. Entity(ies) must include ${params.newOnly} property`)
          )
        }
        return Promise.resolve()
          .then(() => {
            if (Array.isArray(params.entities)) {
              return this.validateEntity(params.entities)
                // Apply idField
                .then(entities => {
                  return entities.map(entity => this.adapter.beforeSaveTransformID(entity, this.settings.idField))
                })
                .then(entities => this.adapter.upsert(this.schema.table, params.conflicts, entities, null, params.newOnly, params.lock))
            } else if (params.entity) {
              return this.validateEntity(params.entity)
                // Apply idField
                .then(entity => this.adapter.beforeSaveTransformID(entity, this.settings.idField))
                .then(entity => this.adapter.upsert(this.schema.table, params.conflicts, entity, null, params.newOnly, params.lock))
            }
            return Promise.reject(new MoleculerClientError('Invalid request! The \'params\' must contain \'entity\' or \'entities\'!', 400))
          })
          .then(docs => {
            return this.transformDocuments(ctx, params, docs)
          })
          .then(json => this.entityChanged('upserted', json, ctx).then(() => json))
          .catch(err => {
            throw err
          })
      }
    }
  }
}

module.exports = Mixin
