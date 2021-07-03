const bencode = require('bencode')
const ssbKeys = require('ssb-keys')
const curve = require('ssb-keys/sodium')
const u = require('ssb-keys/util')
const bfe = require('./ssb-bfe')

module.exports.decodeBox2 = function(box2) {
  const decoded = bencode.decode(box2)
  return bfe.decode.convert(decoded)
}

// assumes msg has already been validated
// returns a classic compatible json object
module.exports.decode = function(bmsg) {
  const decoded = bencode.decode(bmsg)

  const result = {
    previous: bfe.decode.message(decoded[0][2]),
    author: bfe.decode.feed(decoded[0][0]),
    sequence: decoded[0][1],
    timestamp: decoded[0][3],
    signature: bfe.decode.signature(decoded[1])
  }

  if (Array.isArray(decoded[0][4]))
    Object.assign(result, {
      content: bfe.decode.convert(decoded[0][4][0]),
      contentSignature: bfe.decode.signature(decoded[0][4][1]),
    })
  else // box2
    Object.assign(result, {
      content: bfe.decode.convert(decoded[0][4])
    })

  return result
}

// input: json encoded msg from db
module.exports.encode = function(msg) {
  let content
  if (typeof msg.content === 'string' && msg.content.endsWith(".box2"))
    content = bfe.encode.convert(msg.content)
  else
    content = [
      bfe.encode.convert(msg.content),
      bfe.encode.signature(msg.contentSignature)
    ]

  return bencode.encode(
    [
      [
        bfe.encode.feed(msg.author),
        msg.sequence,
        bfe.encode.message(msg.previous),
        msg.timestamp,
        content
      ],
      bfe.encode.signature(msg.signature)
    ]
  )
}

// returns a classic compatible json object
module.exports.create = function(content, mfKeys, sfKeys, previous, sequence, timestamp, boxer) {
  const convertedContent = bfe.encode.convert(content)
  const contentSignature = Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(u.toBuffer(sfKeys.private),
               bencode.encode(convertedContent))
  ])

  let contentAndSignature = [
    convertedContent,
    contentSignature
  ]

  if (content.recps)
    contentAndSignature = boxer(
      bfe.encode.feed(mfKeys.id),
      bencode.encode(contentAndSignature),
      bfe.encode.message(previous),
      content.recps
    )

  const payload = [
    mfKeys.public,
    sequence + 1,
    previous,
    timestamp,
    contentAndSignature
  ]

  const convertedPayload = bfe.encode.convert(payload)
  const payloadSignature = Buffer.concat([
    Buffer.from([4]),
    Buffer.from([0]),
    curve.sign(u.toBuffer(mfKeys.private),
               bencode.encode(convertedPayload))
  ])

  const result = {
    previous,
    author: mfKeys.id,
    sequence,
    timestamp,
    signature: bfe.decode.signature(payloadSignature)
  }

  if (content.recps) {
    Object.assign(result, {
      content: contentAndSignature
    })
  } else {
    Object.assign(result, {
      content,
      contentSignature: bfe.decode.signature(contentSignature)
    })
  }

  return result
}

// msg must be a classic compatible msg
module.exports.hash = function(msg) {
  return '%' + ssbKeys.hash(module.exports.encode(msg)).replace(".sha256", '.bbmsg-v1')
}

// FIXME: might split this out and add validateBatch
function validateSingle(bmsg, previous) {
  
}
