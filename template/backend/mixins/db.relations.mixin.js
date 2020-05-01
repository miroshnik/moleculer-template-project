const _ = require('lodash')

module.exports = {
  settings: {
    with: {}
  },

  BELONGS_TO: 'belongsTo',
  HAS_ONE: 'hasOne',
  HAS_MANY: 'hasMany',
  HAS_MANY_THROUGH: 'hasManyThrough',

  hooks: {
    after: {
      async find (ctx, docs) {
        return this.compose(ctx, docs)
      },

      async list (ctx, docs) {
        return this.compose(ctx, docs)
      },

      async get (ctx, doc) {
        return (await this.compose(ctx, [doc]))[0]
      }
    },

    before: {
      async find (ctx) {
        return this.prepareFieldsParam(ctx)
      },

      async list (ctx) {
        return this.prepareFieldsParam(ctx)
      },

      async get (ctx) {
        return this.prepareFieldsParam(ctx)
      }
    }
  },

  actions: {
    find: {
      // cache: {
      //   keys: ['with']
      // },
      params: {
        with: { type: 'array', items: 'string', optional: true },
        withQuery: { type: 'object', optional: true }
      }
    },

    list: {
      // cache: {
      //   keys: ['with']
      // },
      params: {
        with: { type: 'array', items: 'string', optional: true },
        withQuery: { type: 'object', optional: true }
      }
    },

    get: {
      // cache: {
      //   keys: ['with']
      // },
      params: {
        with: { type: 'array', items: 'string', optional: true },
        withQuery: { type: 'object', optional: true }
      }
    }
  },

  methods: {
    async compose (ctx, docs) {
      const withs = {}

      const definitions = [
        ...(this.settings.with ? Object.keys(this.settings.with) : []),
        ...(this.settings.relations ? Object.keys(this.settings.relations) : []),
        ...(this.settings.relations ? Object.keys(this.settings.relations).map(relation => `${relation}Count`) : [])
      ];

      (ctx.params.with || []).forEach(path => {
        const [key, ...tail] = path.split('.')

        if (!definitions.includes(key)) {
          throw new Error(`'${key}' relation is not defined`)
        }

        if (withs[key]) {
          withs[key].push(tail.length ? tail.join('.') : [])
        } else {
          withs[key] = tail.length ? [tail.join('.')] : []
        }
      })

      const withResults = await Promise.all(
        Object.keys(withs).map(
          withRule => {
            let isCount = false
            if (withRule.slice(-5) === 'Count') {
              withRule = withRule.slice(0, -5)
              isCount = true
            }

            const relatedCtx = { params: { ...ctx.params }, meta: { ...ctx.meta } }

            relatedCtx.params.with = withs[withRule]

            if (ctx.locals.fields) {
              relatedCtx.params.fields = ctx.locals.fields[withRule]
            } else {
              delete relatedCtx.params.fields
            }

            if (this.settings.with && this.settings.with[withRule]) {
              return this.settings.with[withRule].call(this, withRule, relatedCtx, docs)
            } else if (this.settings.relations && this.settings.relations[withRule] && this.settings.relations[withRule].type) {
              if (!this[this.settings.relations[withRule].type]) {
                throw new Error(`Relation ${this[this.settings.relations[withRule].type]} is not supported`)
              }

              return this[this.settings.relations[withRule].type + (isCount ? 'Count' : '')](withRule, relatedCtx, docs, this.settings.relations[withRule])
            } else {
              return docs.map(() => null)
            }
          }
        )
      )

      if (docs.length && withResults.length) {
        docs.forEach(
          (doc, index) => {
            withResults.forEach(
              (withResult, withIndex) => {
                if (withResult[index] !== undefined) {
                  doc[Object.keys(withs)[withIndex]] = Number.isInteger(withResult[index]) ? withResult[index] : (Array.isArray(withResult[index]) ? withResult[index] : { ...doc[Object.keys(withs)[withIndex]], ...withResult[index] })
                }
              }
            )
          }
        )
      }

      return docs
    },

    async hasOne (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      const relatedEntities = await this.broker.call(
        `${relatedService}.find`,
        this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, relatedField, relatedQuery), [...passThroughParams, 'with', 'fields'], relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) }
      )

      return docs
        .map(
          doc => _.omit(
            relatedEntities.find(
              relatedEntity => this.compareEntities(
                doc, relatedEntity, relatingField, relatedField)
            ),
            [..._(relatedField).castArray().compact().value()]
          )
        )
    },

    async hasOneCount (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      return docs.map(doc => 1)
    },

    async belongsTo (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      const relatedEntities = await this.broker.call(
        `${relatedService}.find`,
        this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, relatedField, relatedQuery), [...passThroughParams, 'with', 'fields'], relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) }
      )

      return docs
        .map(doc => relatedEntities.find(relatedEntity => this.compareEntities(doc, relatedEntity, relatingField, relatedField)))
    },

    async belongsToCount (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      return docs.map(doc => 1)
    },

    async hasMany (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      const relatedEntities = await this.broker.call(
        `${relatedService}.find`,
        this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, relatedField, relatedQuery), [...passThroughParams, 'with', 'fields'], relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) }
      )

      return docs
        .map(
          doc => relatedEntities.filter(
            relatedEntity => this.compareEntities(
              doc, relatedEntity, relatingField, relatedField)
          )
            .map(
              relatedEntity => _.omit(
                relatedEntity,
                [..._(relatedField).castArray().compact().value()]
              )
            )
        )
    },

    async hasManyCount (withRule, ctx, docs, { relatingField, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      return Promise.all(docs.map(doc => this.broker.call(
        `${relatedService}.count`,
        this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, relatedField, relatedQuery), passThroughParams, relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) }
      )))
    },

    async hasManyThrough (withRule, ctx, docs, { relatingField, pivotService, pivotRelatedField, pivotRelatingField, pivotQuery = {}, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      const pivotEntities = await this.broker.call(`${pivotService}.find`,
        this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, pivotRelatedField, pivotQuery), passThroughParams, relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) })

      let relatedEntities = []
      if (pivotEntities.length) {
        relatedEntities = await this.broker.call(`${relatedService}.find`,
          this.getParams(ctx, this.getQueryParam(withRule, ctx, pivotEntities, pivotRelatingField, relatedField, relatedQuery), [...passThroughParams, 'with', 'fields'], relatedField),
          { meta: this.getPassThroughMeta(ctx, passThroughParams) }
        )
      }

      return docs
        .map(doc => pivotEntities.filter(pivotEntity => this.compareEntities(doc, pivotEntity, relatingField, pivotRelatedField))
          .reduce((result, pivotEntity) => {
            result.push(
              _.merge(
                _.omit(
                  pivotEntity,
                  [
                    ..._(pivotRelatedField).castArray().compact().value(),
                    ..._(pivotRelatingField).castArray().compact().value()
                  ]
                ),
                relatedEntities.find(relatedEntity => this.compareEntities(pivotEntity, relatedEntity, pivotRelatingField, relatedField))
              )
            )
            return result
          }, [])
        )
    },

    async hasManyThroughCount (withRule, ctx, docs, { relatingField, pivotService, pivotRelatedField, pivotRelatingField, pivotQuery = {}, relatedService, relatedField, relatedQuery = {}, passThroughParams = [] }) {
      if (!docs.length) {
        return []
      }

      return Promise.all(docs.map(doc => this.broker.call(
        `${pivotService}.count`, this.getParams(ctx, this.getQueryParam(withRule, ctx, docs, relatingField, pivotRelatedField, pivotQuery), passThroughParams, relatedField),
        { meta: this.getPassThroughMeta(ctx, passThroughParams) }
      )))
    },

    getQueryParam (withRule, ctx, docs, relatingField, relatedField, query = {}) {
      if (Array.isArray(relatingField) && Array.isArray(relatedField) && relatingField.length === relatedField.length) {
        return {
          $and: [
            {
              $or: docs.map(doc => ({
                ...relatingField.reduce((result, field, index) => {
                  result[relatedField[index]] = doc[field]
                  return result
                }, {})
              }))
            },
            query,
            ctx.params.withQuery && ctx.params.withQuery[withRule] ? ctx.params.withQuery[withRule] : {}
          ]
        }
      } else if ((typeof relatingField === 'string' || relatingField instanceof String) && (typeof relatedField === 'string' || relatedField instanceof String)) {
        return { $and: [{ [relatedField]: { $in: [...new Set(docs.map(doc => doc[relatingField]))] } }, query, ctx.params.withQuery && ctx.params.withQuery[withRule] ? ctx.params.withQuery[withRule] : {}] }
      } else {
        throw new Error('Mismatch of related fields types')
      }
    },

    getPassThroughParams (ctx, params) {
      return _.pick(ctx.params, params.filter(param => param.charAt(0) !== '#'))
    },

    getPassThroughMeta (ctx, params) {
      return _.pick(ctx.meta, params.filter(param => param.charAt(0) === '#').map(param => param.substring(1)))
    },

    prepareFieldsParam (ctx) {
      const relatedFields = {}
      const fields = [];

      (ctx.params.fields || []).forEach(path => {
        const [key, ...tail] = path.split('.')

        if (!tail.length) {
          fields.push(key)
        } else if (relatedFields[key]) {
          relatedFields[key].push(tail.length ? tail.join('.') : [])
        } else {
          relatedFields[key] = tail.length ? [tail.join('.')] : []
        }
      })

      if (fields && fields.length) {
        ctx.params.fields = fields
      } else {
        delete ctx.params.fields
      }

      if (Object.keys(relatedFields).length) {
        ctx.locals.fields = relatedFields
      }

      return Promise.resolve()
    },

    getParams (ctx, query, passThroughParams, relatedField) {
      const params = {
        query,
        ...this.getPassThroughParams(ctx, passThroughParams)
      }

      if (params.fields && params.fields.length && this.hasFirstLevelValues(params.fields) && !params.fields.includes(relatedField)) {
        params.fields.push(relatedField)
      }

      if (ctx.params.withQuery) {
        params.withQuery = this.cutFirstLevelPaths(ctx.params.withQuery)
      }

      return params
    },

    hasFirstLevelValues (arr) {
      return arr.reduce((p, c) => p || !c.includes('.'), false)
    },

    cutFirstLevelPaths (obj) {
      const res = {};

      (obj ? Object.keys(obj) : []).forEach(prop => {
        if (prop.includes('.')) {
          // eslint-disable-next-line
          const [key, ...tail] = prop.split('.')

          res[tail.join('.')] = obj[prop]
        }
      })

      return res
    },

    compareEntities (relatingEntity, relatedEntity, relatingField, relatedField) {
      if (Array.isArray(relatingField) && Array.isArray(relatingField) && relatingField.length === relatedField.length) {
        return relatingField.reduce((res, field, index) => res && (relatingEntity[field] === relatedEntity[relatedField[index]]), true)
      } else {
        return relatingEntity[relatingField] === relatedEntity[relatedField]
      }
    }
  }
}
