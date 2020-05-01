module.exports = require('fs')
  .readdirSync(require('path').join(__dirname, '/'))
  .filter(file => file.match(/\.route\.js$/) !== null && file !== 'index.js')
  .map(file => require('./' + file))
