# Yet Another YAML Parser (yayp)

[![Travis](https://img.shields.io/travis/zozzz/yayp/master.svg?style=flat-square)](https://travis-ci.org/zozzz/yayp)
[![Coveralls](https://img.shields.io/coveralls/zozzz/yayp/master.svg?style=flat-square)](https://coveralls.io/github/zozzz/yayp)
[![npm](https://img.shields.io/npm/v/yayp.svg?style=flat-square)](https://www.npmjs.com/package/yayp)
[![npm](https://img.shields.io/npm/l/yayp.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/dt/yayp.svg?style=flat-square)](https://www.npmjs.com/package/yayp)

This library is fully written in TypeScript, but not is the main maotivation. The motivation is the
"event" based parsing with reasonable performance plus freer type handling.

## Installation

No dependencies, just run this:

```bash
npm i yayp
```

## Basic usage

### API

```javascript
import { load, loadAll, YamlError } from "yayp"
```

#### load(data: string, options: [LoadOptions](#loadoptions))
Load only one document from the given data. If more documents found in the given data
the error is raised.

#### loadAll(data: string, options: [LoadOptions](#loadoptions))
Load all document from the given data, and always return an Array of items.

#### LoadOptions

_all options are optional_

* `defaultVersion` _(float)_:  If YAML document dont specifiy the version with
  [directive](http://www.yaml.org/spec/1.2/spec.html#directive/YAML/),
  the `Loader` use this version.
* `forcedVersion` _(float)_: The loader always use this version to load documents from the data
* `extraSchema` _([ISchema](https://github.com/zozzz/yayp/blob/master/src/schema/schema.ts#L9))_:
  Use this additional schema plus the version schema (
      [SCHEMA_V11](https://github.com/zozzz/yayp/blob/master/src/schema/version-1.1/index.ts#L5),
      [SCHEMA_V12](https://github.com/zozzz/yayp/blob/master/src/schema/version-1.2/index.ts#L6)
  )
* `schema` _([ISchema](https://github.com/zozzz/yayp/blob/master/src/schema/schema.ts#L9))_:
  Use this schema only, no additional schemas
* `needComments` _(boolean)_: Control parser to call the `Loader.onComment` method or not
* `document` _([YamlDocument class](https://github.com/zozzz/yayp/blob/master/src/document.ts#L6))_:
  `Loader` use this class to construct a new decoument
* `filename` _(string)_: This filename appears in the error messages

#### Example

```javascript
console.log(load("Hello World")) // prints 'Hello World'
```

## Advanced usage

### API

### Create a custom type

The main interfaces found in [handler.ts](https://github.com/zozzz/yayp/blob/master/src/handler.ts)
and the abstract [TypeFactory](https://github.com/zozzz/yayp/blob/master/src/schema/type.ts#L5)
class is the base of the all custom types.

`Foo` type can handle strings, and prefix all strings with `foo-` (totally scrap type, but this si a demonstration).

```javascript
import { TypeFactory } from "yayp"

class Foo extends TypeFactory {
    onScalar(offset, value) {
        return `foo-${value}`
    }

    onQuotedString(offset, value) {
        return `foo-${value}`
    }

    onBlockString(offset, value) {
        return `foo-${value}`
    }
}
```

More examples in [builtin types](https://github.com/zozzz/yayp/blob/master/src/schema/basic/types.ts)

### Create a Schema

Instantiate the [Schema](https://github.com/zozzz/yayp/blob/master/src/schema/schema.ts#L24)
class with the right paramteres, like this:

```javascript
const MySchema = new Schema({
    "!foo": new Foo
    // or a fully qualified name
    "zozzz/yayp/foo": new Foo
})
```

And we can load the following YAML file:

```yaml
---
hello: !foo ok # result is {"hello": "foo-ok"}
...

%TAG !z! zozzz/yayp/
---
hello: !z!foo ok # result is {"hello": "foo-ok"}
...

---
hello: !<zozzz/yayp/foo> ok # result is {"hello": "foo-ok"}
...
```

### Load YAML documents with a custom schema

```javascript
import { loadAll } from "yayp"

loadAll("...", { extraSchema: MySchema })
```

Maybe this [SchemaCollection](https://github.com/zozzz/yayp/blob/master/src/schema/collection.ts#L6)
class is usefull, when you want combine more schemas.