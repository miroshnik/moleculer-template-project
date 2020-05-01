const ApiGateway = require('moleculer-web')
const routes = require('./routes')
const { api: config } = require('../../config')

module.exports = {
  name: 'api',

  mixins: [ApiGateway],

  dependencies: [],

  settings: {
    port: config.port,

    path: '/api',

    logRequestParams: 'info',
    logResponseData: 'debug',
    log4XXResponses: true,

    use: [],

    cors: {
      // Configures the Access-Control-Allow-Origin CORS header.
      origin: '*',
      // Configures the Access-Control-Allow-Methods CORS header.
      methods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
      // Configures the Access-Control-Allow-Headers CORS header.
      allowedHeaders: [],
      // Configures the Access-Control-Expose-Headers CORS header.
      exposedHeaders: [],
      // Configures the Access-Control-Allow-Credentials CORS header.
      credentials: false,
      // Configures the Access-Control-Max-Age CORS header.
      maxAge: 3600
    },

    onError (req, res, err) {
      const errObj = {
        name: err.name,
        message: err.message,
        code: err.code,
        type: err.type,
        data: err.data
      }

      const numCode = +err.code

      res.writeHead(
        (Number.isNaN(numCode) || numCode > 599 || numCode < 100) ? 500 : err.code
      )

      res.end(JSON.stringify(errObj, null, 2))
    },

    callOptions: {
      timeout: 30 * 1000
    },

    routes,

    assets: {
      folder: 'public'
    }
  },

  methods: {

    /**
     * Authenticate the request. It check the `Authorization` token value in the request header.
     * Check the token value & resolve the user by the token.
     * The resolved user will be available in `ctx.meta.user`
     *
     * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
     *
     * @param {Context} ctx
     * @param {Object} route
     * @param {IncomingRequest} req
     * @returns {Promise}
     */
    async authenticate (ctx, route, req) {
      if (!req.headers.authorization) {
        return null
      }

      const [user] = await this.broker.call('db.users.find', { query: { token: req.headers.authorization } }, { meta: { $cache: false } })

      return user
    },

    /**
     * Authorize the request. Check that the authenticated user has right to access the resource.
     *
     * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
     *
     * @param {Context} ctx
     * @param {Object} route
     * @param {IncomingRequest} req
     * @returns {Promise}
     */
    async authorize (ctx, route, req) {
      const user = ctx.meta.user

      if (!user) {
        throw new ApiGateway.Errors.UnAuthorizedError('', {})
      }
    }
  }
}
