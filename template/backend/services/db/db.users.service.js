const DbService = require('../../mixins/db.mixin')
const SqlAdapter = require('../../lib/knex.db.adapter')
const config = require('../../config')

module.exports = {
  name: 'db.users',

  table: 'users',

  mixins: [DbService],

  settings: {},

  adapter: new SqlAdapter({
    ...config.knex,
    pool: { ...config.knex.pool, min: DbService.POOL_MIN, max: DbService.POOL_MAX }
  }),

  actions: {
    find: { roles: ['root', 'admin'] },

    count: { roles: ['root', 'admin'] },

    get: { roles: ['root', 'admin'] },

    list: { roles: ['root', 'admin'] }
  }
}
