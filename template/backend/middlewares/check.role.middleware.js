const { MoleculerClientError } = require('moleculer').Errors

module.exports = {
  name: 'check.role',

  localAction (handler, action) {
    if (action.roles) {
      return async function CheckRoleMiddleware (ctx) {
        if (ctx.meta.user) {
          if (!ctx.meta.user.roles || !ctx.meta.user.roles.filter(role => action.roles.includes(role)).length) {
            throw new MoleculerClientError('Forbidden', 403, 'FORBIDDEN')
          }
        } else {
          // throw new MoleculerClientError('Unauthorized', 401, 'UNAUTHORIZED')
        }

        return handler(ctx)
      }
    }

    return handler
  }
}
