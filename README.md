# serialized
Serialize and deserialize javascript objects into compact, url encoded strings.
Useful when you have to store rich objects (such as ElasticSearch queries) in browser url.
## Example
```js
// Describe field types
const ProductField = oneOfType([
  constant('id'),
  constant('name'),
  constant('price'),
  constant('category'),
  constant('manufacturer')
])

const PriceRange = mapOf(
  constant('price'),
  objectOf({ gte: numberType(), lte: numberType() })
)

function getType(productField) {
  switch (productField) {
    case 'id': return integerType()
    case 'price': return numberType()
    default: return stringType()
  }
}

const TermOrWildcard = withCalculatedType(
  getType,
  (from, Calculated) => mapOf(from(ProductField), Calculated)
)

const boolType = template(T => oneOfType([
  objectOf({ should: arrayOfType(T), must: arrayOfType(T) }),
  objectOf({ should: arrayOfType(T) }),
  objectOf({ must: arrayOfType(T) })
]))

const Query = oneOfType([
  objectOf({ term: TermOrWildcard }),
  objectOf({ wildcard: TermOrWildcard }),
  objectOf({ range: PriceRange }),
  objectOf({ bool: boolType(() => Query) })
])

const Search = objectOf({
  from: integerType(),
  size: oneOfType([constant(10), constant(100), constant(1000)]),
  query: Query
})

// Complex query
const search = {
  from: 15,
  size: 100,
  query: {
    bool: {
      must: [{
        bool: {
          should: [
            { wildcard: { name: '*tablet*' }},
            { term: { category: 'Electronics/Tablets' }}]}}, {
          bool: {
            should: [{
              bool: {
                must: [
                  { term: { manufacturer: 'Apple' }},
                  { range: { price: { gte: 0, lte: 1000 }}}]}}, {
              bool: {
                must: [
                  { term: { manufacturer: 'Samsung' }},
                  { range: { price: { gte: 0, lte: 500 }}}]}}]}}]}}}

// Serialize object
const serializedString = Search.serialize(search)
//=> f$1323111*tablet*$$03Electronics%2FTablets$$$313204Apple$$20$1000$$$3204Samsung$$20$500

Search.deserialize(serializedString)
//=> equals to 'search'
```

## API

### stringType([length])
Simple string. By default serializes strings with `encodeURIComponent`
- `length` Accept only strings with provided `length`

### integerType([max])
Positive integer
- `max` Accept only integers between `0` and `max`

### numberType()
Simple number

### constant(value)
- `value` Any javascript primitive type

### objectOf(schema)
- `schema` Object with `token` type values
```js
const Person = objectOf({
  name: stringType(),
  age: integerType(),
})
```

### mapOf(keyToken, valueToken)
Javascript object as map
- `keyToken` Type of map keys
- `valueToken` Type of map values


### oneOfType(tokens)
Union type
- `tokens` Array of possible types
```js
const OptionalString = oneOfType([
  constant(undefined),
  constant(null),
  stringType(),
])
```

### arrayOfType(token, [length])
- `token` Type of array item
- `length` Accept only arrays with provided `length`
```js
const Matrix = arrayOfType(numberType(), 9)
```

### template(callback)
```js
const nullableType = template(T => oneOfType([
  constant(null),
  T,
]))
const NullableString = nullableType(stringType())
```

### withCalculatedType(getType, callback)
Utility for deferred type calculation
