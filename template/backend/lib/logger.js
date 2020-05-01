const util = require('util')
const os = require('os')
const host = os.hostname()

const ConsoleLogger = require('moleculer').Loggers.Console

class Logger extends ConsoleLogger {
  constructor (env) {
    super({
      level: 'info',
      colors: env === 'local',
      moduleColors: env === 'local',
      objectPrinter: o => util.inspect(o, { depth: 8, colors: true, breakLength: 100 }),
      formatter: env === 'local' ? 'full' : (level, args, bindings) => {
        const logLevelMapping = {
          fatal: 2,
          error: 3,
          warn: 4,
          info: 6,
          debug: 7,
          trace: 8
        }

        const data = {
          timestamp: new Date().toISOString(),
          level: logLevelMapping[level],
          env,
          container: host,
          project: 'bk/sportsbook',
          appId: process.env.APP_ID || '-'
        }

        const message = args[0]

        data.message = `${bindings.nodeID}/${
          bindings.svc || bindings.mod}${bindings.ver ? `/${bindings.ver}` : ''}: ${message}`

        const context = args[1]

        if (context) {
          if (context instanceof Error) {
            data.context = {
              ...Logger.normalizeError(context)
            }
          } else if (context.error && context.error instanceof Error) {
            data.context = {
              ...context,
              error: Logger.normalizeError(context.error)
            }
          } else if (typeof context === 'string') {
            data.message += context
          } else {
            data.context = {
              ...context
            }

            if (this.env !== 'local') {
              Object.keys(data.context).forEach(
                key => {
                  data.context[key] = util.inspect(data.context[key])
                }
              )
            }
          }
        }

        return [JSON.stringify(data)]
      }
    })
  }

  static normalizeError (error) {
    const result = {}
    const errorPros = Object.getOwnPropertyNames(error) || []

    errorPros.forEach(
      propName => {
        if (propName === 'stack') {
          result.stack = util.inspect(error.stack, { breakLine: Infinity })
        } else {
          result[propName] = util.inspect(error[propName])
        }
      }
    )

    return result
  }
}

module.exports = Logger
