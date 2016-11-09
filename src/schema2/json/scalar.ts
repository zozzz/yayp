import { ScalarValueMap, ScalarRegexMatch, ScalarResolverSet } from "../scalar"


export const ScalarToNull = new ScalarValueMap({ "null": null })

export const ScalarToBool = new ScalarValueMap({ "true": true, "false": false })

export const ScalarToInt = new ScalarRegexMatch(
	"+-0123456789",
	/^[-+]?(?:0|[1-9][0-9]*)$/,
	(match) => {
		return parseInt(match[0], 10)
	}
)

export const ScalarToFloat = new ScalarRegexMatch(
	"+-0123456789.",
	/^[-+]?(0|[1-9][0-9]*)(\.[0-9]*)?([eE][-+]?[0-9]+)?$/,
	(match) => {
		return parseFloat(match[0])
	}
)

export const JsonScalars = new ScalarResolverSet([
	ScalarToNull,
	ScalarToBool,
	ScalarToInt,
	ScalarToFloat
])