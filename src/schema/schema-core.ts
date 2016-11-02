import { YamlDocument } from "../document"
import { Mapping, Sequence, Scalar } from "../node"
import { ISchema, TypeFactory } from "./schema"
import { FromScalarFactory, JSONSchema } from "./schema-json"


const NullFactory = new FromScalarFactory(/^(?:null|Null|NULL|~|)$/, () => null)
const TrueFactory = new FromScalarFactory(/^(?:true|True|TRUE|on|On|ON|yes|Yes|YES)$/, () => true)
const FalseFactory = new FromScalarFactory(/^(?:false|False|FALSE|off|Off|OFF|no|No|NO)$/, () => false)


const IntFactory = new FromScalarFactory(
	new RegExp([
		"^(?:",
		"([+-]?)",				// group 1: sign
		"(?:",
		"([1-9][0-9]*)",	// group 2: int / base 10
		"|",
		"(0o[0-7]+)",		// group 3: int / base 8
		"|",
		"(0x[0-9a-fA-F]+)", // group 4: int / base 16
		")",
		")$"
	].join("")),
	(document, match) => {
		let res
		if (match[2]) {
			res = parseInt(match[2], 10)
		} else if (match[3]) {
			res = parseInt(match[3].slice(2), 8)
		} else if (match[4]) {
			res = parseInt(match[4].slice(2), 16)
		}
		return match[1] === "-" ? -res : res
	}
)

const FloatFactory = new FromScalarFactory(
	new RegExp([
		"^(?:",
		"(?:",
		"([+-]?)", // group 1: sign
		"(",
		"(?:\\.[0-9]+|[0-9]+(?:\\.[0-9]*)?)(?:[eE][+-]?[0-9]+)?",
		")", // group 2: number
		"|",
		"(\\.(?:inf|Inf|INF))", // group 3: Infinity
		")",
		"|",
		"(\\.(?:nan|NaN|NAN))", // group 4: NaN
		")$"
	].join("")),
	(document, match) => {
		if (match[2]) {
			let res = parseFloat(match[2])
			return match[1] === "-" ? -res : res
		} else if (match[3]) {
			return match[1] === "-" ? -Infinity : Infinity
		} else if (match[4]) {
			return NaN
		}
	}
)


const enum TimestampPart {
	YMD = 1,
	FULL_YMD,
	FULL_TIME,
	ZULU,
	TZ_OFFSET
}


const TimestampFactory = new FromScalarFactory(
	new RegExp([
		"^(?:",
		"([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])", // group 1: YYYY-MM-DD
		"|",
		"(?:",
		"([0-9][0-9][0-9][0-9]-[0-9]{1,2}-[0-9]{1,2})",
		"(?:[Tt]|[ \t]+)",
		"([0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}(?:\\.\\d+)?)",
		"(?:[ \t]*(?:(Z)|([-+][0-9]{1,2}(?::?[0-9]{1,2})?)))?",
		")",
		")$"
	].join("")),
	(document, match) => {
		let ds
		if (match[TimestampPart.YMD]) {
			ds = `${match[TimestampPart.YMD]}T00:00:00Z`
		} else {
			ds = `${match[TimestampPart.FULL_YMD]}T${match[TimestampPart.FULL_TIME]}`
			if (match[TimestampPart.TZ_OFFSET]) {
				let offset = match[TimestampPart.TZ_OFFSET]
				let sign = offset[0]
				let parts = offset.slice(1).split(/:/)
				if (parts[0].length === 4) {
					parts[1] = parts[0].slice(2)
					parts[0] = parts[0].slice(0, 2)
				}
				if (parts[0].length === 1) {
					ds += `${sign}0${parts[0]}00`
				} else {
					ds += `${sign}${parts[0]}`
					if (!parts[1]) {
						ds += "00"
					} else {
						ds += parts[1].length === 1 ? `0${parts[1]}` : parts[1]
					}
				}
			} else {
				ds += "Z"
			}
		}
		return new Date(ds)
	}
)

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


const FACTORIES: { [key: string]: TypeFactory } = {
	"tag:yaml.org,2002:null": NullFactory,
	"tag:yaml.org,2002:bool": new BoolFactory,
	"tag:yaml.org,2002:int": IntFactory,
	"tag:yaml.org,2002:float": FloatFactory,
	"tag:yaml.org,2002:timestamp": TimestampFactory
}


const FROM_SCALAR: FromScalarFactory[] = [
	NullFactory,
	TrueFactory,
	FalseFactory,
	IntFactory,
	FloatFactory,
	TimestampFactory
]


export class CoreSchema extends JSONSchema implements ISchema {
	public resolveTag(qname: string): TypeFactory | null {
		if (FACTORIES[qname]) {
			return FACTORIES[qname]
		}
		return super.resolveTag(qname)
	}

	public resolveScalar(document: YamlDocument, value: Scalar): any | undefined {
		for (let factory of FROM_SCALAR) {
			let v = factory.resolveFromScalar(document, value)
			if (v !== undefined) {
				return v
			}
		}
		return super.resolveScalar(document, value)
	}
}


export const SCHEMA_CORE = new CoreSchema