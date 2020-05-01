module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '5432',
    user: process.env.DB_USER || 'moleculer',
    password: process.env.DB_PASSWORD || 'moleculer',
    database: process.env.DB_DATABASE || 'moleculer',
    application_name: process.env.APP_ID || 'moleculer'
  },
  pool: {
    min: 2,
    max: 4,
    afterCreate: (conn, done) => {
      conn.query('select 1', function (err) {
        done(err, conn)
      })
    }
  },
  acquireConnectionTimeout: 30 * 1000,
  migrations: {
    tableName: 'migrations',
    directory: '../storage/db/migrations',
    stub: '../storage/db/templates/migration.js'
  },
  seeds: {
    directory: '../storage/db/seeds',
    stub: '../storage/db/templates/seed.js'
  }
}
