import { inspect } from "util"
import { Loader, Parser, TypeFactory } from "../src"
import { State } from "../src/parser"


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
		// "scalar",
		"readScalar",
		"readQuotedString",
		"blockMapping",
		"mappingKey",
		"explicitKey",
		"tag",
		"anchor",
		"alias",
		// "storeAnchor",
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
		return (a1, a2, a3, a4, a5, a6, a7) => {
			let st = ""
			if (a1 && a1.onMappingStart) {
				st = this.readableState(a2)
			} else if (a2 && a2.onMappingStart) {
				st = this.readableState(a3)
			} else if (a3 && a3.onMappingStart) {
				st = this.readableState(a4)
			}

			console.log(`${this.indent(this.callStack)}>> ${name} ${st}  ${inspect(this.data.substr(this.offset, 10))}`)
			++this.callStack
			let res = fn.call(this, a1, a2, a3, a4, a5, a6, a7)
			--this.callStack
			console.log(`${this.indent(this.callStack)}== ${res} ${inspect(this.data.substr(this.offset, 10))}`)
			return res
		}
	}

	private readableState(state) {
		let res = []

		if (state & State.IN_FLOW_MAP) { res.push("IN_FLOW_MAP") }
		if (state & State.IN_FLOW_SEQ) { res.push("IN_FLOW_SEQ") }
		if (state & State.IN_BLOCK_SEQ) { res.push("IN_BLOCK_SEQ") }
		if (state & State.IN_BLOCK_MAP) { res.push("IN_BLOCK_MAP") }
		if (state & State.IN_EXPLICIT_KEY) { res.push("IN_EXPLICIT_KEY") }
		if (state & State.IN_IMPLICIT_KEY) { res.push("IN_IMPLICIT_KEY") }
		if (state & State.ONLY_COMPACT_MAPPING) { res.push("ONLY_COMPACT_MAPPING") }

		return `[${res.join(" | ")}]`
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