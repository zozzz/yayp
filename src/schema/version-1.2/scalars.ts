import { ScalarValueMap, ScalarRegexMatch, ScalarResolverSet } from "../scalar"


export const ScalarToNull = new ScalarValueMap({ "null": null, "Null": null, "NULL": null, "~": null, "": null })

export const ScalarToBool = new ScalarValueMap({
	"true": true, "True": true, "TRUE": true,
	"false": false, "False": false, "FALSE": false
})

export const ScalarToInt = new ScalarRegexMatch(
	"+-0123456789",
	`^(?:
		([+-]?)
		(?:
			((?:[1-9][0-9]*)|0)
			|
			(0x[0-9a-fA-F]+)
			|
			(0o[0-7]+)
		)
	)$`,
	(match) => {
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

export const ScalarToFloat = new ScalarRegexMatch(
	"+-.0123456789",
	`^(?:
		([+-]?)
		(?:
			((?:[0-9][0-9_]*)?\.[0-9.]*(?:[eE][-+][0-9]+))
			|
			([0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*)
			|
			(\\.(?:inf|Inf|INF))
		)
		|
		(\\.(?:nan|NaN|NAN))
	)$`,
	(match) => {
		if (match[2]) {
			let res = parseFloat(match[2].replace("_", ""))
			return match[1] === "-" ? -res : res
		} else if (match[3]) {
			return "TODO BASE 60 FLOAT"
		} else if (match[4]) {
			return match[1] === "-" ? -Infinity : Infinity
		} else if (match[5]) {
			return NaN
		}
	}
)

export const ScalarToDate = new ScalarRegexMatch(
	"0123", // if this program survives year 3000+ i'am very happy :)
	`^(?:
		([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])
		|
		(?:
			[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?
 			(?:[Tt]|[ \t]+)
			[0-9][0-9]?:[0-9][0-9]:[0-9][0-9]
 			(?:\.[0-9]*)?
 			((?:[ \t]*)Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?
		)
 	)$`,
	(match, doc) => {
		doc.error("TODO: DATETIME")
	}
)

export const V12Scalars = new ScalarResolverSet([
	ScalarToNull,
	ScalarToBool,
	ScalarToInt,
	ScalarToFloat,
	ScalarToDate
])