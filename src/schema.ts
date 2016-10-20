var isPlainObject = require("is-plain-object")
import {TagFactory, YamlDocument} from "./document"


export interface ISchema {
	resolveTag(namespace: string, name: string): TagFactory | null
	resolveScalar(document: YamlDocument, value: string): any | undefined
}


export class SchemaCollection implements ISchema {
	public constructor(protected schemas: ISchema[]) {
	}

	public resolveTag(namespace: string, name: string): TagFactory | null {
		for (let s of this.schemas) {
			let factory = s.resolveTag(namespace, name)
			if (factory) {
				return factory
			}
		}
		return null
	}

	public resolveScalar(document: YamlDocument, value: string) {
		for (let s of this.schemas) {
			let result = s.resolveScalar(document, value)
			if (result !== undefined) {
				return result
			}
		}
		return undefined
	}
}


export class FailsafeSchema implements ISchema {
	public static readonly FACTORIES: {[key: string]: TagFactory} = {
		"map": (document, value) => {
			if (isPlainObject(value)) {
				return value
			} else {
				document.error("Map tag only allow plain objects")
			}
		},

		"seq": (document, value) => {
			if (Array.isArray(value)) {
				return value
			} else {
				document.error("Seq tag only allow sequences")
			}
		},

		"str": (document, value) => {
			return `${value}`
		}
	}

	public resolveTag(namespace: string, name: string): TagFactory | null {
		if (namespace === "tag:yaml.org,2002:") {
			return FailsafeSchema.FACTORIES[name]
		}
		return null
	}

	public resolveScalar() {
		return undefined
	}
}


export class JSONSchema implements ISchema {
	public static readonly NULL_VALUES = /^(?:null|Null|NULL|~)$/
	public static readonly TRUE_VALUES = /^(?:true|True|TRUE|on|On|ON|yes|Yes|YES)$/
	public static readonly FALSE_VALUES = /^(?:false|False|FALSE|off|Off|OFF|no|No|NO)$/
	public static readonly INF_VALUES = /^(\\+|-)?\\.(?:inf|Inf|INF)$/
	public static readonly NAN_VALUES = /^\\.(?:nan|NaN|NAN)$/

	public static readonly FACTORIES: {[key: string]: TagFactory} = {
		"null": (document, value) => {
			if (JSONSchema.NULL_VALUES.test(value)) {
				return null
			} else {
				document.error(`Invalid null value: ${value}`)
			}
		},

		"bool": (document, value) => {
			if (JSONSchema.TRUE_VALUES.test(value)) {
				return true
			} else if (JSONSchema.FALSE_VALUES.test(value)) {
				return false
			} else {
				document.error(`Invalid bool value: ${value}`)
			}
		},

		"int": (document, value) => {
			if (typeof value === "string") {
				return parseInt(value, 10)
			} else {
				return value
			}
		},

		"float": (document, value) => {
			if (typeof value === "string") {
				if (JSONSchema.INF_VALUES.test(value)) {
					if (value[0] === "-") {
						return -Infinity
					} else {
						return Infinity
					}
				} else if (JSONSchema.NAN_VALUES.test(value)) {
					return NaN
				}
				return parseFloat(value)
			} else {
				return value
			}
		}
	}

	public resolveTag(namespace: string, name: string): TagFactory | null {
		if (namespace === "tag:yaml.org,2002:") {
			return JSONSchema.FACTORIES[name]
		}
		return null
	}

	public resolveScalar(document: YamlDocument, value: any): any | undefined {
		if (JSONSchema.NULL_VALUES.test(value)) {
			return null;
		} else if (JSONSchema.TRUE_VALUES.test(value)) {
			return true
		} else if (JSONSchema.FALSE_VALUES.test(value)) {
			return false
		}
	}
}


export const CORE_SCHEMA = new SchemaCollection([
	new FailsafeSchema(),
	new JSONSchema()
])