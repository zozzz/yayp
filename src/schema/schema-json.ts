import {YamlDocument} from "../document"
import {Mapping, Sequence, Scalar} from "../node"
import {ISchema, TypeFactory} from "./schema"
import {FailsafeSchema} from "./schema-failsafe"


export class FromScalarFactory extends TypeFactory {
	public constructor(public pattern: RegExp, public converter: (document: YamlDocument, match: RegExpMatchArray) => any) {
		super()
	}

	public onScalar(value: string): any {
		return this.createFromScalar(value)
	}

	public onQuotedString(value: string, quote: string): any {
		return this.createFromScalar(value)
	}

	public onBlockString(value: string, isFolded: boolean): any {
		return this.createFromScalar(value)
	}

	public createFromScalar(value: Scalar): any {
		let match = value.match(this.pattern)
		if (match) {
			return this.converter(this.document, match)
		} else {
			this.document.error(`Unexpected value: '${value}'`)
		}
	}

	public resolveFromScalar(document: YamlDocument, value: Scalar): any {
		let match = value.match(this.pattern)
		if (match) {
			return this.converter(document, match)
		}
	}
}


const NullFactory = new FromScalarFactory(/^null$/, () => null)
const TrueFactory = new FromScalarFactory(/^true$/, () => true)
const FalseFactory = new FromScalarFactory(/^false$/, () => false)
const IntFactory = new FromScalarFactory(/^-?(0|[1-9][0-9]*)$/, (d, v) => parseInt(v[0], 10))
const FloatFactory = new FromScalarFactory(/^-?(0|[1-9][0-9]*)(\.[0-9]*)?([eE][-+]?[0-9]+)?$/, (d, v) => parseFloat(v[0]))


class BoolFactory extends TypeFactory {
	public onScalar(value: string): any {
		return this.createFromScalar(value)
	}

	public onQuotedString(value: string, quote: string): any {
		return this.createFromScalar(value)
	}

	public createFromScalar(value: Scalar): any {
		let result = TrueFactory.resolveFromScalar(this.document, value)
		if (result !== undefined) {
			return result
		}

		result = FalseFactory.resolveFromScalar(this.document, value)

		if (result !== undefined) {
			return result
		}
	}
}


const FACTORIES: {[key: string]: TypeFactory} = {
	"null": NullFactory,
	"bool": new BoolFactory,
	"int": IntFactory,
	"float": FloatFactory
}


const FROM_SCALAR: FromScalarFactory[] = [
	NullFactory,
	TrueFactory,
	FalseFactory,
	IntFactory,
	FloatFactory
]


export class JSONSchema extends FailsafeSchema implements ISchema {

	public resolveTag(namespace: string, name: string): TypeFactory | null {
		if (namespace === "tag:yaml.org,2002:" && FACTORIES[name]) {
			return FACTORIES[name]
		}
		return super.resolveTag(namespace, name)
	}

	public resolveScalar(document: YamlDocument, value: Scalar): any | undefined {
		for (let factory of FROM_SCALAR) {
			let v = factory.resolveFromScalar(document, value)
			if (v !== undefined) {
				return v
			}
		}
		// do not call parent
	}
}


export const SCHEMA_JSON = new JSONSchema