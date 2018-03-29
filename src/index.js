const SERIALIZATION_ERROR = 'Unable to serialize value'

function is(C, v) {
  return v != null && (v.constructor === C || v instanceof C)
}

function padStart(s, l, c) {
  let output = s
  while (output.length < l) output = c + output
  return output
}

function last(v) {
  return v[v.length - 1]
}

let finalChar = '$'
let encodeString = encodeURIComponent
let decodeString = decodeURIComponent
let fromInteger = v => v.toString(36)
let toInteger = v => parseInt(v, 36)
let fromNumber = String
let toNumber = Number
let equals = (a, b) => a === b

export function configure({
  finalChar: _finalChar,
  encodeString: _encodeString,
  decodeString: _decodeString,
  fromInteger: _fromInteger,
  toInteger: _toInteger,
  fromNumber: _fromNumber,
  toNumber: _toNumber,
  equals: _equals,
}) {
  if (_finalChar) finalChar = _finalChar
  if (_encodeString) encodeString = _encodeString
  if (_decodeString) decodeString = _decodeString
  if (_fromInteger) fromInteger = _fromInteger
  if (_toInteger) toInteger = _toInteger
  if (_fromNumber) fromNumber = _fromNumber
  if (_toNumber) toNumber = _toNumber
  if (_equals) equals = _equals
}

export function createType(cb) {
  return (...args) => {
    const { serialize, deserialize } = cb(...args)
    return {
      serialize(input) {
        let output = serialize(input)
        while (output !== '' && last(output) === finalChar) {
          output = output.slice(0, -1)
        }
        return output
      },
      deserialize(input) {
        return deserialize(input)[0]
      },
      _deserialize: deserialize,
      _serialize: serialize,
    }
  }
}

export const template = cb => {
  return createType((...tokens) => {
    const getTokens = () =>
      tokens.map(token => (is(Function, token) ? token() : token))
    return {
      serialize(input) {
        return cb(...getTokens())._serialize(input)
      },

      deserialize(input) {
        return cb(...getTokens())._deserialize(input)
      },
    }
  })
}

export const stringType = createType(length => {
  const isFixedLength = length !== undefined
  return {
    serialize(input) {
      if (!is(String, input)) throw SERIALIZATION_ERROR
      let output = encodeString(input)
      if (isFixedLength && output.length !== length) throw SERIALIZATION_ERROR
      if (!isFixedLength) output += finalChar
      return output
    },

    deserialize(input) {
      let lastIndex, takenCount
      if (isFixedLength) {
        lastIndex = length
        takenCount = Math.min(length, input.length)
      } else {
        lastIndex = input.indexOf(finalChar)
        if (lastIndex === -1) {
          lastIndex = input.length
          takenCount = input.length
        } else {
          takenCount = lastIndex + 1
        }
      }
      const body = input.substring(0, lastIndex)
      const output = decodeString(body)
      return [output, takenCount]
    },
  }
})

export const integerType = createType(max => {
  const isFixedLength = max !== undefined
  const length = isFixedLength ? fromInteger(max).length : undefined
  const stringToken = stringType(length)
  return {
    serialize(input) {
      if (!Number.isInteger(input) || input < 0) throw SERIALIZATION_ERROR
      if (isFixedLength && input > max) throw SERIALIZATION_ERROR
      let value = fromInteger(input)
      if (length !== undefined) value = padStart(value, length, fromInteger(0))
      return stringToken._serialize(value)
    },

    deserialize(input) {
      const [body, takenCount] = stringToken._deserialize(input)
      const output = toInteger(body)
      return [output, takenCount]
    },
  }
})

export const numberType = createType(() => {
  const stringToken = stringType()
  return {
    serialize(input) {
      if (!is(Number, input)) throw SERIALIZATION_ERROR
      return stringToken._serialize(fromNumber(input))
    },

    deserialize(input) {
      const [body, takenCount] = stringToken._deserialize(input)
      const output = toNumber(body)
      return [output, takenCount]
    },
  }
})

export const constant = createType(value => {
  return {
    serialize(input) {
      if (!equals(value, input)) throw SERIALIZATION_ERROR
      return ''
    },

    deserialize() {
      return [value, 0]
    },
  }
})

export const objectOf = createType(schema => {
  const keys = Object.keys(schema)
  return {
    serialize(input) {
      if (!is(Object, input)) throw SERIALIZATION_ERROR
      let output = ''
      keys.forEach(key => {
        const value = input[key]
        if (value === undefined) throw SERIALIZATION_ERROR
        output += schema[key]._serialize(value)
      })
      return output
    },

    deserialize(input) {
      const output = {}
      let takenCount = 0
      let inputTail = input

      keys.forEach(key => {
        const [chunk, chunkTakenCount] = schema[key]._deserialize(inputTail)
        output[key] = chunk
        inputTail = inputTail.substring(chunkTakenCount)
        takenCount += chunkTakenCount
      })
      return [output, takenCount]
    },
  }
})

export const oneOfType = createType(tokens => {
  const integerToken = integerType(tokens.length - 1)
  return {
    serialize(input) {
      let output = null
      tokens.forEach((token, i) => {
        if (output !== null) return
        try {
          const discriminator = integerToken._serialize(i)
          output = discriminator + token._serialize(input)
        } catch (error) {
          if (error === SERIALIZATION_ERROR) return
          throw error
        }
      })
      if (output === null) throw SERIALIZATION_ERROR
      return output
    },

    deserialize(input) {
      const [index, indexTakenCount] = integerToken._deserialize(input)
      const body = input.substring(indexTakenCount)
      const [output, bodyTakenCount] = tokens[index]._deserialize(body)
      return [output, bodyTakenCount + indexTakenCount]
    },
  }
})

export const arrayOfType = createType((token, length) => {
  const isFixedLength = length !== undefined
  return {
    serialize(input) {
      if (!is(Array, input)) throw SERIALIZATION_ERROR
      if (isFixedLength && input.length !== length) throw SERIALIZATION_ERROR
      let output = ''
      input.forEach(item => {
        output += token._serialize(item)
      })
      if (!isFixedLength) output += finalChar
      return output
    },

    deserialize(input) {
      const output = []
      let takenCount = 0
      let tailInput = input
      function parseChunk() {
        const [chunk, chunkTakenCount] = token._deserialize(tailInput)
        output.push(chunk)
        tailInput = tailInput.substring(chunkTakenCount)
        takenCount += chunkTakenCount
      }
      if (isFixedLength) {
        for (let i = 0; i < length; i++) parseChunk()
      } else {
        while (tailInput !== '' && tailInput[0] !== finalChar) parseChunk()
        if (tailInput !== '' && tailInput[0] === finalChar) takenCount += 1
      }
      return [output, takenCount]
    },
  }
})

export const mapOf = createType((keyToken, valueToken) => {
  const DenormalizedMap = arrayOfType(
    objectOf({
      key: keyToken,
      value: valueToken,
    }),
  )
  return {
    serialize(input) {
      if (!is(Object, input)) throw SERIALIZATION_ERROR
      const body = Object.keys(input).map(key => ({
        key,
        value: input[key],
      }))
      return DenormalizedMap._serialize(body)
    },

    deserialize(input) {
      const output = {}
      const [body, takenCount] = DenormalizedMap._deserialize(input)
      body.forEach(({ key, value }) => {
        output[key] = value
      })
      return [output, takenCount]
    },
  }
})

export const withCalculatedType = createType((getType, cb) => {
  return {
    serialize(input) {
      let value
      const calculateFrom = createType(token => ({
        serialize(innerInput) {
          value = innerInput
          return token._serialize(innerInput)
        },
      }))
      const CalculatedType = createType(() => ({
        serialize(innerInput) {
          return getType(value)._serialize(innerInput)
        },
      }))()
      return cb(calculateFrom, CalculatedType)._serialize(input)
    },

    deserialize(input) {
      let value
      const calculateFrom = createType(token => ({
        deserialize(innerInput) {
          const [output, takenCount] = token._deserialize(innerInput)
          value = output
          return [output, takenCount]
        },
      }))
      const CalculatedType = createType(() => ({
        deserialize(innerInput) {
          return getType(value)._deserialize(innerInput)
        },
      }))()
      return cb(calculateFrom, CalculatedType)._deserialize(input)
    },
  }
})
