
function expandRange(range: string): number[] {
	let parts: number[] = range.split(/-/).map<number>(v => v.charCodeAt(0))
	let result = []

	if (parts.length === 1) {
		return parts
	}

	for (let i=parts[0], l=parts[1] ; i <= l ; ++i) {
		result.push(i)
	}

	return result;
}

function collapseRange(items: number[]): string[] {
	let result: string[] = []
	let begin = null
	let end = null
	items = items.slice(0).sort((a, b) => a - b)

	for (let v of items) {
		if (begin === null) {
			begin = end = v
		} else if (end + 1 !== v) {
			if (end === begin) {
				result.push(String.fromCharCode(begin))
			} else if (end === begin + 1) {
				result.push(String.fromCharCode(begin))
				result.push(String.fromCharCode(end))
			} else {
				result.push(`${String.fromCharCode(begin)}-${String.fromCharCode(end)}`)
			}
			begin = end = v
		} else {
			end = v
		}
	}

	if (begin !== null) {
		if (end === begin) {
			result.push(String.fromCharCode(begin))
		} else if (end === begin + 1) {
			result.push(String.fromCharCode(begin))
			result.push(String.fromCharCode(end))
		} else {
			result.push(`${String.fromCharCode(begin)}-${String.fromCharCode(end)}`)
		}
	}

	return result
}

function union(...ranges: string[][]): string[] {
	let res = [];
	for (let r of ranges) {
		for (let v of r.map(expandRange)) {
			for (let c of v) {
				res.push(c)
			}
		}
	}

	return collapseRange(res.filter((v, i) => res.indexOf(v) === i));
}

function remove(range: string[], ...remove: string[][]): string[] {
	let result: number[] = []
	range.slice(0).map(expandRange)
		.forEach(v => {
			v.forEach(ch => {
				result.push(ch)
			})
		})

	for (let r of remove) {
		for (let v of r.map(expandRange)) {
			for (let c of v) {
				let idx = result.indexOf(c)
				if (idx > -1) {
					result.splice(idx, 1)
				}
			}
		}
	}
	return collapseRange(result.filter((v, i) => result.indexOf(v) === i));
}

function makeRegex(range: string[]): RegExp {
	let res = [], ranges = []

	for (let c of range) {
		res.push(c)
	}

	return new RegExp(`[${res.join("")}]`, "g");
}

// TODO: cache

export const BOM = ["\uFEFF"]
export const LETTER_DECIMAL = ["0-9"]
export const LETTER_HEX = ["0-9", "A-F"]
export const LETTER_ASCII = ["A-Z", "a-z"]
export const FLOW_INDICATOR = [",", "[", "]", "{", "}"]
export const INDICATOR = ["-", "?", ":", ",", "[", "]", "{", "}", "#", "&", "*", "!", "|", ">", "'", "\"", "%", "@", "`"]
export const EOL = ["\r\n", "\r", "\n"]
export const WHITE_SPACE = [" ", "\t", "\r", "\n"]
// export const PRINTABLE = ["\x09", "\x0A", "\x0D", "\x20-\x7E", "\x85", "\u00A0-\uD7FF", "\uE000-\uFFFD", "\U010000-\U10FFFF"]
export const WORD = union(LETTER_DECIMAL, LETTER_ASCII, ["-"])
export const URI = union(WORD, ["#", ";", "/", "?", ":", "@", "&", "=", "+", "$", ",", "_", ".", "!", "~", "*", "'", "(", ")", "[", "]"])
export const TAG = remove(URI, ["!"], FLOW_INDICATOR)
// export const NB_CHAR = remove(PRINTABLE, EOL, BOM)
// export const NS_CHAR = remove(NB_CHAR, WHITE_SPACE)

// export const PLAIN_STRING = remove(NS_CHAR, INDICATOR)


export const RX_EOL = makeRegex(EOL)
export const RX_MULTI_EOL = new RegExp(`(?:${RX_EOL.source})+`, "g")
export const RX_TAG = makeRegex(TAG)
// export const RX_NS_CHAR = makeRegex(NS_CHAR)
export const RX_NS_CHARS = new RegExp(`[^\uFEFF\r\n\t ]+`, "g")
export const RX_NB_CHARS = new RegExp(`[^\r\n]+`, "g")
export const RX_WS = new RegExp(`[ \t\r\n]+`, "g")
// export const RX_PLAIN_STRING_CAHR = makeRegex(PLAIN_STRING)
// export const RX_PLAIN_STRING_CAHRS = new RegExp(`(?:${RX_PLAIN_STRING_CAHR.source})+`, "g")
export const RX_PLAIN_STRING = new RegExp(`.*?(?:(?::[ \t])|(?=(?:${RX_EOL.source})|(?:[ \t]*[,\\[\\]\\{\\}])|$))`, "g")
export const RX_INT_DEC = new RegExp(`[1-9][0-9]*`, "g")
export const RX_INT_OCT = new RegExp(`[0-7]+`, "g")
export const RX_INT_HEX = new RegExp(`[0-9A-Fa-f]+`, "g")
export const RX_FLOAT_SECOND_PART = new RegExp(`(?:(?:(\\.[0-9]+)?([eE][-+]?[0-9]+)?)|inf|Inf|INF|nan|Nan|NAN)`, "g")
export const YAML_DIRECTIVE_VALUE = new RegExp(`\\d+\\.\\d+`, "g")

export const TAG_DIRECTIVE_HANDLE = new RegExp(`!([0-9A-Za-z]*!)?`, "g")
export const TAG_DIRECTIVE_NS = new RegExp(`[0-9A-Za-z\\-\\#\\;\\/\\?\\:\\@\\&\\=\\+\\$\\,\\_\\.\\!\\~\\*\\'\\(\\)\\[\\]]+`, "g")
export const TAG_NAME = new RegExp(`[0-9A-Za-z\\-\\#\\;\\/\\?\\:\\@\\&\\=\\+\\$\\_\\.\\~\\*\\'\\(\\)]+`, "g")
export const RX_ANCHOR = new RegExp(`[^ \\t\\r\\n\\[\\]\\{\\}\\,]+`, "g")
export const PLAIN_MAPPING_KEY = new RegExp(`.+:\\s{1}`, "g")
export const RX_TIMESTAMP_PART = new RegExp(`\\d{2}`, "g")
export const RX_TIMESTAMP_MS = new RegExp(`\\d{1,3}`, "g")
export const RX_TIMESTAMP_TZ = new RegExp(`(\\d{2}:?\\d{2})|(\\d{1,2}(?!:))`, "g")


export const enum CharCode {
	TAB            = 0x09, // \t
	LF             = 0x0A, // \n
	CR             = 0x0D, // \r
	SPACE          = 0x20,
	EXCLAMATION    = 0x21, // !
	QUOTE_DOUBLE   = 0x22, // "
	QUOTE_SINGLE   = 0x27, // "
	HASH           = 0x23, // #
	PERCENT        = 0x25, // %
	AMPERSAND      = 0x26, // &
	LPAREN         = 0x28, // (
	RPAREN         = 0x29, // )
	ASTERIX        = 0x2A, // *
	PLUS           = 0x2B, // *
	COMMA          = 0x2C, // ,
	DASH           = 0x2D, // -
	DOT            = 0x2E, // .
	SLASH          = 0x2F, // /
	COLON          = 0x3A, // :
	SEMICOLON      = 0x3B, // ;
	LANGLE         = 0x3C, // <
	RANGLE         = 0x3E, // >
	EQ             = 0x3D, // =
	QUESTION       = 0x3F, // ?
	AT             = 0x40, // @
	LBRACKET       = 0x5B, // [
	RBRACKET       = 0x5D, // ]
	BACKSLASH      = 0x5C, // \
	BACKTICK       = 0x60, // `
	LBRACE         = 0x7B, // {
	RBRACE         = 0x7D, // {
	PIPE           = 0x7C, // |
	TILDE          = 0x7E, // ~
	BOM            = 0xFEFF
}


export const IS_NBS: {[key: number]: boolean} = {
	[CharCode.SPACE]: true,
	[CharCode.TAB]: true
}


export const IS_EOL: {[key: number]: boolean} = {
	[CharCode.CR]: true,
	[CharCode.LF]: true,
	[NaN]: true // EOF
}


export const IS_WS: {[key: number]: boolean} = {
	[CharCode.SPACE]: true,
	[CharCode.TAB]: true,
	[CharCode.CR]: true,
	[CharCode.LF]: true
}


export const IS_INDICATOR: {[key: number]: boolean} = {
	[CharCode.DASH]: true,
	[CharCode.QUESTION]: true,
	[CharCode.COLON]: true,
	[CharCode.COMMA]: true,
	[CharCode.LBRACKET]: true,
	[CharCode.RBRACKET]: true,
	[CharCode.LBRACE]: true,
	[CharCode.RBRACE]: true,
	[CharCode.HASH]: true,
	[CharCode.AMPERSAND]: true,
	[CharCode.ASTERIX]: true,
	[CharCode.EXCLAMATION]: true,
	[CharCode.PIPE]: true,
	[CharCode.RANGLE]: true,
	[CharCode.LANGLE]: true,
	[CharCode.QUOTE_SINGLE]: true,
	[CharCode.QUOTE_DOUBLE]: true,
	[CharCode.PERCENT]: true,
	[CharCode.AT]: true,
	[CharCode.BACKTICK]: true
}


export const IS_SCALAR_FIRST_CHAR_DECISION: {[key: number]: boolean} = {
	[CharCode.DASH]: true,
	[CharCode.QUESTION]: true,
	[CharCode.COMMA]: true
}


export const IS_FLOW_INDICATOR: {[key: number]: boolean} = {
	[CharCode.COMMA]: true,
	[CharCode.LBRACKET]: true,
	[CharCode.RBRACKET]: true,
	[CharCode.LBRACE]: true,
	[CharCode.RBRACE]: true,
}


export const IS_DIGIT: {[key: number]: boolean} = {
	[0x30]: true,
	[0x31]: true,
	[0x32]: true,
	[0x33]: true,
	[0x34]: true,
	[0x35]: true,
	[0x36]: true,
	[0x37]: true,
	[0x38]: true,
	[0x39]: true
}


export const enum EscapeSequenceSpecial {
	EOL = -1,
	EMPTY = -2,
	HEX_2 = -3,
	HEX_4 = -4,
	HEX_8 = -5
}


export const ESCAPE_SEQUENCE: {[key: number]: number} = {
	[0] 	: 0,
	[0x61]	: 0x07,  /* \a */
	[0x62]	: 0x08,  /* \b */
	[0x74]	: 0x09,  /* \t */
	[0x6E]	: 0x0A,  /* \n */
	[0x4E]	: 0x85,  /* \N */
	[0x76]	: 0x0B,  /* \v */
	[0x66]	: 0x0C,  /* \f */
	[0x72]	: 0x0D,  /* \r */
	[0x65]	: 0x1B,  /* \e */
	[0x5F]	: 0xA0,  /* \_ */
	[0x4C]	: 0x2028,  /* \L */
	[0x50]	: 0x2029,  /* \P */
	[0x78]	: EscapeSequenceSpecial.HEX_2,  /* \x */
	[0x75]	: EscapeSequenceSpecial.HEX_4,  /* \u */
	[0x55]	: EscapeSequenceSpecial.HEX_8,  /* \U */

	[CharCode.CR]			: EscapeSequenceSpecial.EOL,
	[CharCode.LF]			: EscapeSequenceSpecial.EMPTY,
	[CharCode.TAB]			: EscapeSequenceSpecial.EMPTY,
	[CharCode.SPACE]		: EscapeSequenceSpecial.EMPTY,
	[CharCode.QUOTE_DOUBLE]	: CharCode.QUOTE_DOUBLE,
	[CharCode.QUOTE_SINGLE]	: CharCode.QUOTE_SINGLE,
	[CharCode.SLASH]		: CharCode.SLASH,
	[CharCode.BACKSLASH]	: CharCode.BACKSLASH,
	[CharCode.QUOTE_DOUBLE]	: CharCode.QUOTE_DOUBLE
}


export function isPrintable(charcode: number): boolean {
	return charcode === CharCode.TAB
		|| charcode === CharCode.LF
		|| charcode === CharCode.CR
		|| (charcode != 0x7F && charcode >= 0x20 && charcode <= 0xD7FF) // DEL is not printable
		|| (charcode >= 0xE000 && charcode <= 0xFFFD)
		|| (charcode >= 0x010000 && charcode <= 0x10FFFF)
}