module.exports = require('fs')
  .readdirSync(require('path').join(__dirname, '/'))
  .filter(file => file.match(/\.config\.js$/) !== null && file !== 'index.js')
  .reduce((p, c) => ({ ...p, [c.replace('.config.js', '')]: require('./' + c) }), {})
