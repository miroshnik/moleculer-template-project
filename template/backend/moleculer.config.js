const Logger = require('./lib/logger')
const HealthCheckMiddleware = require('./middlewares/health.check.middleware')
const CheckRoleMiddleware = require('./middlewares/check.role.middleware')
const appConfig = require('./config/app.config')

module.exports = {
  namespace: '',
  nodeID: null,

  metadata: {},

  logger: new Logger(appConfig.env),
  logLevel: 'info',

  transporter: 'Redis',

  cacher: 'Redis',

  serializer: 'JSON',

  requestTimeout: 10 * 1000,

  retryPolicy: {
    enabled: false,
    retries: 5,
    delay: 100,
    maxDelay: 1000,
    factor: 2,
    check: err => err && !!err.retryable
  },

  maxCallLevel: 100,

  heartbeatInterval: 10,
  heartbeatTimeout: 30,

  contextParamsCloning: false,

  tracking: {
    enabled: true,
    shutdownTimeout: 60 * 1000,
  },

  disableBalancer: false,

  registry: {
    strategy: 'RoundRobin',
    preferLocal: true
  },

  circuitBreaker: {
    enabled: false,
    threshold: 0.5,
    minRequestCount: 20,
    windowTime: 60,
    halfOpenTime: 10 * 1000,
    check: err => err && err.code >= 500
  },

  bulkhead: {
    enabled: false,
    concurrency: 10,
    maxQueueSize: 100,
  },

  validator: true,

  errorHandler: null,

  metrics: {
    enabled: true,
    reporter: {
      type: 'Prometheus',
      options: {
        port: 3030,
        path: '/metrics',
        defaultLabels: registry => ({
          namespace: registry.broker.namespace,
          nodeID: registry.broker.nodeID
        })
      }
    }
  },

  tracing: {
    enabled: appConfig.env === 'local',
    exporter: {
      type: 'Console',
      options: {
        logger: null,
        colors: true,
        width: 100,
        gaugeWidth: 40
      }
    }
  },

  middlewares: [
    HealthCheckMiddleware(),
    CheckRoleMiddleware
  ],

  replCommands: require('./commands'),

  created (broker) { },

  async started (broker) { },

  async stopped (broker) { }
}
