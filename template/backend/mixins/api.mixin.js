const request = require('./request.mixin')

module.exports = (provider) => ({
  ...request,
  settings: {
    ...request.settings,
    interceptors: {
      request: [{
        onFulfilled: function (config) {
          return { ...config, metadata: { startTime: new Date() } }
        },
        onRejected: function (error) {
          return Promise.reject(error)
        }
      }],
      response: [{
        async onFulfilled (response) {
          try {
            await this.broker.emit(`${provider}.api.response.received`, {
              request: {
                method: response.config.method,
                url: response.config.url,
                headers: response.config.headers,
                params: response.config.params,
                data: response.config.data
              },
              request_date: response.config.metadata.startTime,
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data
              },
              response_date: new Date(),
              provider
            })
          } catch (error) {
            this.logger.error('api.mixin.interceptor', { error })
          }

          response.config.metadata.endTime = new Date()
          response.duration = response.config.metadata.endTime - response.config.metadata.startTime

          return response
        },
        onRejected (error) {
          return Promise.reject(error)
        }
      }]
    }
  }
})
