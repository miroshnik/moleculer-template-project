const axios = require('axios')

module.exports = {
  name: 'request',

  settings: {
    config: {},
    defaults: {},
    interceptors: {
      request: [],
      response: []
    }
  },

  created () {
    this.instance = axios.create(this.settings.config)
    // this.instance.defaults = { ...this.instance.defaults, this.settings.defaults }
    this.settings.interceptors.request.forEach(interceptor => this.addInterceptor('request', interceptor.onFulfilled, interceptor.onRejected))
    this.settings.interceptors.response.forEach(interceptor => this.addInterceptor('response', interceptor.onFulfilled, interceptor.onRejected))
  },

  actions: {
    get: {
      params: {
        url: 'string',
        config: { type: 'object', optional: true }
      },
      handler (ctx) {
        return this.instance.get(ctx.params.url, ctx.params.config || {})
      }
    },

    post: {
      params: {
        url: 'string',
        data: [{
          type: 'object', optional: true
        }, {
          type: 'string', optional: true
        }],
        config: { type: 'object', optional: true }
      },
      handler (ctx) {
        return this.instance.post(ctx.params.url, ctx.params.data || {}, ctx.params.config || {})
      }
    }
  },

  methods: {
    addInterceptor (type, onFulfilled, onRejected) {
      if (!onRejected) {
        onRejected = (error) => {
          return Promise.reject(error)
        }
      }

      return this.instance.interceptors[type].use(onFulfilled.bind(this), onRejected.bind(this))
    },

    removeInterceptor (type, interceptor) {
      this.instance.interceptors[type].eject(interceptor)
    }
  }
}
