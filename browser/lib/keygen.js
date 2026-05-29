const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

module.exports = function (uuid) {
  if (typeof uuid === typeof true && uuid) {
    return uuidv4()
  }
  const length = 10
  return crypto.randomBytes(length).toString('hex')
}
