function deps (broker) {
  const deps = {}

  broker.services.filter(svc => !svc.name.startsWith('$')).forEach(service => {
    if (!deps[service.name]) {
      deps[service.name] = {}
    }

    if (service.schema.dependencies) {
      service.schema.dependencies.forEach(dependency => {
        deps[dependency] = {
          ...deps[dependency],
          [service.name]: broker.registry.services.services.reduce(
            (a, svc) => svc.name === service.name && svc.node.available ? a + 1 : a, 0
          )
        }
      })
    }
  })

  return deps
}

function depsCount (broker) {
  const depsCount = {}

  Object.entries(deps(broker)).forEach(entry => {
    depsCount[entry[0]] = Object.values(entry[1]).reduce((p, c) => p + c, 0)
  })

  return depsCount
}

module.exports = {
  command: 'shutdown',
  description: 'Graceful shutdown',
  alias: 'd',
  async action (broker, args) {
    broker.logger.info(broker.services.map(service => ({
      name: service.name,
      dependencies: service.schema.dependencies
    })))
    broker.logger.info(deps(broker))

    // stop user's services
    for (; ;) {
      const dc = depsCount(broker)
      broker.logger.info(Object.entries(depsCount(broker)).reduce((p, c) => p + ` ${c[0]} - ${c[1]},`, 'Shutdown order'))

      if (!Object.values(dc).length) {
        break
      }

      await Promise.all(
        broker.services.map(svc =>
          dc[svc.name] !== undefined && dc[svc.name] === 0 ? broker.destroyService(svc) : Promise.resolve()
        )
      )
    }

    // stop internal services
    await Promise.all(broker.services.map(svc => broker.destroyService(svc)))

    // stop broker
    return broker.stop()
  }
}
