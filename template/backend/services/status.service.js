const apps = {
  api: {},
  cli: { optional: false }
}

module.exports = {
  name: 'status',

  actions: {
    async get () {
      const nodeList = await this.broker.call('$node.list')

      const appStatuses = Object.keys(apps).map(app => ({
        name: app,
        status: !apps[app].optional && nodeList.find(node => node.metadata.appId === app) ? 'OK' : 'UNAVAILABLE'
      }))

      return {
        status: appStatuses.reduce((p, c) => p && c.status === 'OK', true) ? 'OK' : 'FAIL',
        apps: appStatuses
      }
    }
  }
}
