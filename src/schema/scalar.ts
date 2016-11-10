import { YamlDocument } from "../document"
import { TypeFactory } from "./type"


export abstract class ScalarResolver {
	public readonly decision: number[] = []

	public constructor(decision: string) {
		for (let ch of decision) {
			let c = ch.charCodeAt(0)
			if (this.decision.indexOf(c) === -1) {
				this.decision.push(c)
			}
		}
	}

	public abstract resolve(document: YamlDocument, value: string): any;
}


/**
 * usage:
 * ScalarToNull = new ScalarValueMap({"null": null, "Null": null})
 */
export class ScalarValueMap extends ScalarResolver {
	public constructor(public readonly valueMapping: { [key: string]: any }) {
		super(_makeDecision(valueMapping))
	}

	public resolve(document: YamlDocument, value: string): any {
		let v
		return (v = this.valueMapping[value]) !== undefined ? v : undefined
	}
}


export type ScalarRegexConverter = (match: RegExpMatchArray, document: YamlDocument) => any


/**
 * usage:
 * ScalarToInt = new ScalarRegexMatch("+-0123456789", /^[+-]?[1-9][0-9]+$/, (m) => parseInt(m[0]))
 */
export class ScalarRegexMatch extends ScalarResolver {
	public rx: RegExp

	public constructor(decision: string, rx: RegExp | string, public converter: ScalarRegexConverter) {
		super(decision)
		this.rx = rx instanceof RegExp ? rx : _makeRx(rx)
	}

	public resolve(document: YamlDocument, value: string): any {
		let m
		if (m = value.match(this.rx)) {
			return this.converter(m, document)
		}
		return undefined
	}
}


/**
 * usage:
 * Int = new ScalarResolverAsType(ScalarToInt)
 */
export class ScalarResolverAsType extends TypeFactory {
	public constructor(public sr: ScalarResolver) {
		super()
	}

	public onScalar(value: string): any {
		return this.sr.resolve(this.document, value)
	}

	public onQuotedString(value: string, quote: string): any {
		return this.sr.resolve(this.document, value)
	}
}


/**
 * usage:
 * JsonScalars = new ScalarResolverSet([ScalarToNull, ScalarToInt])
 */
export class ScalarResolverSet {
	protected map: ScalarResolver[][] = []

	public constructor(public readonly resolvers: ScalarResolver[] = []) {
		this._updateDecisionMap()
	}

	public resolve(document: YamlDocument, value: string): any {
		if (value) {
			let resolvers: ScalarResolver[]
			if ((resolvers = this.map[value.charCodeAt(0)]) === undefined) {
				return undefined
			} else {
				let resolved
				for (let resolver of resolvers) {
					if ((resolved = resolver.resolve(document, value)) !== undefined) {
						return resolved
					}
				}
			}
		}
		return undefined
	}

	public merge(other: ScalarResolverSet | ScalarResolverSet[] | ScalarResolver[]) {
		if (!Array.isArray(other)) {
			other = [other]
		}

		let resolvers = this.resolvers.slice(0)
		for (let obj of other) {
			if (obj instanceof ScalarResolverSet) {
				for (let r of obj.resolvers) {
					if (resolvers.indexOf(r) === -1) {
						resolvers.unshift(r)
					}
				}
			} else if (resolvers.indexOf(obj) === -1) {
				resolvers.unshift(obj)
			}
		}

		return new ScalarResolverSet(resolvers)
	}

	private _updateDecisionMap() {
		let map = this.map
		map.length = 0

		for (let resolver of this.resolvers) {
			for (let ch of resolver.decision) {
				if (!map[ch]) {
					map[ch] = [resolver]
				} else {
					map[ch].push(resolver)
				}
			}
		}
	}
}


function _makeDecision(mapping: { [key: string]: any }): string {
	let result = ""
	for (let k in mapping) {
		if (result.indexOf(k[0]) === -1) {
			result += k[0]
		}
	}
	return result
}


function _makeRx(rx: string): RegExp {
	return new RegExp(rx.replace(/[ \t]*[\r\n]+[ \t]*/g, ""))
}