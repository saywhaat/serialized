import {
  stringType,
  integerType,
  numberType,
  constant,
  oneOfType,
  objectOf,
  withSelf,
  arrayOfType,
  withCalculatedType,
  createType,
} from './'

function spring(t, v) {
  return t.deserialize(t.serialize(v))
}

test('stringType', () => {
  const FluidString = stringType()
  const FixedString = stringType(4)

  const data1 = 'qwer asdf'
  const data2 = 'qwer'
  const data3 = ''

  expect(spring(FluidString, data1)).toEqual(data1)
  expect(() => spring(FixedString, data1)).toThrow()
  expect(spring(FixedString, data2)).toEqual(data2)
  expect(spring(FluidString, data3)).toEqual(data3)
})

test('integerType', () => {
  const FluidInteger = integerType()
  const FixedInteger = integerType(100)
  const ArrayOfFluidInteger = arrayOfType(FluidInteger)
  const ArrayOfFixedInteger = arrayOfType(FixedInteger)

  const data1 = 1234
  const data2 = 1.0
  const data3 = 100
  const data4 = 0.1
  const data5 = [95, 96, 97, 98, 99]

  expect(spring(FluidInteger, data1)).toEqual(data1)
  expect(() => spring(FixedInteger, data1)).toThrow()
  expect(spring(FixedInteger, data2)).toEqual(data2)
  expect(spring(FixedInteger, data3)).toEqual(data3)
  expect(() => spring(FluidInteger, data4)).toThrow()
  expect(FixedInteger.serialize(data2).length).toEqual(
    FixedInteger.serialize(data3).length,
  )
  expect(ArrayOfFixedInteger.serialize(data5).length).toBeLessThan(
    ArrayOfFluidInteger.serialize(data5).length,
  )
})

test('numberType', () => {
  const NumberType = numberType()
  const IntegerType = integerType()

  const data1 = -1.2345e67
  const data2 = '1234567'
  const data3 = 1234567

  expect(spring(NumberType, data1)).toEqual(data1)
  expect(() => spring(NumberType, data2)).toThrow()
  expect(IntegerType.serialize(data3).length).toBeLessThan(
    NumberType.serialize(data3).length,
  )
})

test('constant', () => {
  const NullConstant = constant(null)
  const NumberConstant = constant(0.1 + 0.2)

  const data1 = 0.1 + 0.2
  const data2 = 0.3
  const data3 = null

  expect(() => spring(NullConstant, data1)).toThrow()
  expect(spring(NullConstant, data3)).toEqual(data3)
  expect(spring(NumberConstant, data1)).toEqual(data1)
  expect(() => spring(NumberConstant, data2)).toThrow()
})

test('oneOfType', () => {
  const Type = oneOfType([
    constant(null),
    constant(0),
    stringType(4),
    stringType(),
    objectOf({ a: objectOf({ b: stringType() }) }),
    objectOf({ a: stringType(4), b1: stringType() }),
    objectOf({ a: stringType(), b2: stringType() }),
  ])

  const LongType = oneOfType(
    new Array(36 * 36 + 1).fill().map((_, i) => constant(i)),
  )

  const data1 = null
  const data2 = 0
  const data3 = 'qwer'
  const data4 = 'qwerasdf'
  const data5 = { a: { b: '2' } }
  const data6 = { a: 'asdf', b1: '111' }
  const data7 = { a: 'asdf', b2: '111' }
  const data8 = false
  const data9 = 700

  expect(spring(Type, data1)).toEqual(data1)
  expect(spring(Type, data2)).toEqual(data2)
  expect(spring(Type, data3)).toEqual(data3)
  expect(spring(Type, data4)).toEqual(data4)
  expect(spring(Type, data5)).toEqual(data5)
  expect(spring(Type, data6)).toEqual(data6)
  expect(spring(Type, data7)).toEqual(data7)
  expect(spring(LongType, data9)).toEqual(data9)
  expect(() => spring(Type, data8)).toThrow()

  expect(Type.serialize(data2).length).toBeLessThan(
    Type.serialize(data5).length,
  )
  expect(Type.serialize(data6).length).toBeLessThan(
    Type.serialize(data7).length,
  )
})

test('objectOf', () => {
  const SimpleObject = objectOf({
    a: constant('a'),
    b: stringType(3),
    c: stringType(),
    d: stringType(),
  })

  const RecursiveObject = withSelf(Self =>
    oneOfType([
      constant(null),
      objectOf({
        a: stringType(3),
        b: Self,
      }),
    ]),
  )

  const data1 = { a: 'a', b: 'bbb', c: 'qwer', d: 'asdf' }
  const data2 = { a: 'aa', b: 'bbb', c: 'qwer', d: 'asdf' }
  const data3 = {
    a: '111',
    b: {
      a: '222',
      b: {
        a: '333',
        b: null,
      },
    },
  }

  expect(spring(SimpleObject, data1)).toEqual(data1)
  expect(() => spring(SimpleObject, data2)).toThrow()
  expect(spring(RecursiveObject, data3)).toEqual(data3)
})

test('withCalculatedType', () => {
  const Obj = objectOf({ a: stringType() })

  const Test = arrayOfType(
    withCalculatedType(
      type => {
        switch (type.substring(0, 3)) {
          case 'str':
            return stringType()
          case 'int':
            return integerType()
          case 'obj':
            return Obj
          default:
            return constant(type)
        }
      },
      (calculateFrom, CalculatedType) =>
        objectOf({
          type: calculateFrom(stringType()),
          value: CalculatedType,
        }),
    ),
  )

  const data1 = [
    { type: `str${Math.random()}`, value: 'qwer' },
    { type: `int${Math.random()}`, value: 1234 },
    { type: `obj${Math.random()}`, value: { a: 'asdf' } },
    { type: 'qwer', value: 'qwer' },
  ]

  expect(spring(Test, data1)).toEqual(data1)
})
