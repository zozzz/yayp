import { inspect } from "util"
import { Loader, Parser } from "../src"


export class PatchedParser extends Parser {
	private callStack: number = 0
	private patchFns = [
		"parseFile",
		"parseDocument",
		"parseValue",
		"isDocumentSeparator",
		"isDocumentStart",
		"isDocumentEnd",
		// "isBlockMappingKey",
		"directive",
		"blockSequence",
		"flowSequence",
		"flowMapping",
		"readScalar",
		"readQuotedString",
		"blockMapping",
		"mappingKey",
		"explicitKey",
		"tag",
		"anchor",
		"alias",
		"storeAnchor",
		"peek"
	]


	public constructor(loader) {
		super(loader)
		// this.patch()
	}

	public patch() {
		for (let k of this.patchFns) {
			let fn = this[k]
			if (typeof fn === "function") {
				this[k] = this.patchFn(k, fn)
			}
		}
	}

	private patchFn(name, fn) {
		return (a1, a2, a3, a4, a5) => {
			console.log(`${this.indent(this.callStack)}-> ${name}  ${inspect(this.data.substr(this.offset, 10))}`)
			++this.callStack
			let res = fn.call(this, a1, a2, a3, a4, a5)
			--this.callStack
			console.log(`${this.indent(this.callStack)}<- ${res} ${inspect(this.data.substr(this.offset, 10))}`)
			return res
		}
	}

	private indent(x) {
		let res = ""
		for (var i = 0; i < x; ++i) {
			res += "  "
		}
		return res
	}
}


export class PatchedLoader extends Loader {
	public readonly parser = new PatchedParser(this)
}