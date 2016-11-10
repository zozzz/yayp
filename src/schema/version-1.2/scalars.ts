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
			res = parseInt(match[3].slice(2), 16)
		} else if (match[4]) {
			res = parseInt(match[4].slice(2), 8)
		}
		return match[1] === "-" ? -res : res
	}
)


export const ScalarToFloat = new ScalarRegexMatch(
	"+-.0123456789",
	`^(?:
		([+-]?)
		(?:
			([-+]?(?:[0-9][0-9_]*)?\\.?[0-9][0-9_]*(?:[eE][-+]?[0-9][0-9_]*)?)
			|
			([0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*)
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
			let base = 1, result = 0.0, numbers = []

			for (let part of match[3].replace("_", "").split(":")) {
				numbers.unshift(parseFloat(part))
			}

			for (let number of numbers) {
				result += number * base
				base *= 60
			}
			return match[1] === "-" ? -result : result
		} else if (match[4]) {
			return match[1] === "-" ? -Infinity : Infinity
		} else if (match[5]) {
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


export const ScalarToDate = new ScalarRegexMatch(
	"0123", // if this program survives year 3000+ i'am very happy :)
	`^(?:
		([0-9]{4}-[0-9]{2}-[0-9]{2})
		|
		(?:
			([0-9]{4}-[0-9]{1,2}-[0-9]{1,2})
			(?:[Tt]|[ \\t]+)
			([0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\\.\\d+)?)
			(?:[ \\t]*(?:(Z)|([-+][0-9]{1,2}(?::?[0-9]{1,2})?)))?
		)
	)$`,
	(match, doc) => {
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


export const V12Scalars = new ScalarResolverSet([
	ScalarToNull,
	ScalarToBool,
	ScalarToInt,
	ScalarToFloat,
	ScalarToDate
])