
export const RX_NS_CHARS = new RegExp(`[^\uFEFF\r\n\t ]+`, "g")
export const RX_NB_CHARS = new RegExp(`[^\r\n]+`, "g")
export const YAML_DIRECTIVE_VALUE = new RegExp(`\\d+\\.\\d+`, "g")

export const TAG_DIRECTIVE_HANDLE = /!([0-9A-Za-z]*!)?/g
export const TAG_DIRECTIVE_NS = /(?:[0-9A-Za-z\-\#\;\/\?\:\@\&\=\+\$\,\_\.\!\~\*\'\(\)\[\]]|(?:\%[a-fA-F0-9]{2}))+/g
export const TAG_NAME = /(?:[0-9A-Za-z\-\#\;\/\?\:\@\&\=\+\$\_\.\~\*\'\(\)]|(?:\%[a-fA-F0-9]{2}))+/g
export const RX_ANCHOR = /[^ \t\r\n\[\]\{\}\,]+/g


export const enum CharCode {
	TAB = 0x09, // \t
	LF = 0x0A, // \n
	CR = 0x0D, // \r
	SPACE = 0x20,
	UNICODE_SPACE = 0xA0,
	EXCLAMATION = 0x21, // !
	QUOTE_DOUBLE = 0x22, // "
	QUOTE_SINGLE = 0x27, // "
	HASH = 0x23, // #
	PERCENT = 0x25, // %
	AMPERSAND = 0x26, // &
	LPAREN = 0x28, // (
	RPAREN = 0x29, // )
	ASTERIX = 0x2A, // *
	PLUS = 0x2B, // *
	COMMA = 0x2C, // ,
	DASH = 0x2D, // -
	DOT = 0x2E, // .
	SLASH = 0x2F, // /
	COLON = 0x3A, // :
	SEMICOLON = 0x3B, // ;
	LANGLE = 0x3C, // <
	RANGLE = 0x3E, // >
	EQ = 0x3D, // =
	QUESTION = 0x3F, // ?
	AT = 0x40, // @
	LBRACKET = 0x5B, // [
	RBRACKET = 0x5D, // ]
	BACKSLASH = 0x5C, // \
	BACKTICK = 0x60, // `
	LBRACE = 0x7B, // {
	RBRACE = 0x7D, // {
	PIPE = 0x7C, // |
	TILDE = 0x7E, // ~
	BOM = 0xFEFF
}


export const IS_NBS: { [key: number]: boolean } = {
	[CharCode.SPACE]: true,
	[CharCode.UNICODE_SPACE]: true,
	[CharCode.TAB]: true
}


export const IS_EOL: { [key: number]: boolean } = {
	[CharCode.CR]: true,
	[CharCode.LF]: true,
	[NaN]: true // EOF
}


export const IS_WS: { [key: number]: boolean } = {
	[CharCode.SPACE]: true,
	[CharCode.UNICODE_SPACE]: true,
	[CharCode.TAB]: true,
	[CharCode.CR]: true,
	[CharCode.LF]: true
}


export const IS_INDICATOR: { [key: number]: boolean } = {
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


export const IS_SCALAR_FIRST_CHAR_DECISION: { [key: number]: boolean } = {
	[CharCode.DASH]: true,
	[CharCode.QUESTION]: true,
	[CharCode.COMMA]: true
}


export const IS_FLOW_INDICATOR: { [key: number]: boolean } = {
	[CharCode.COMMA]: true,
	[CharCode.LBRACKET]: true,
	[CharCode.RBRACKET]: true,
	[CharCode.LBRACE]: true,
	[CharCode.RBRACE]: true,
}


export const IS_DIGIT: { [key: number]: boolean } = {
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
	CR = -1,
	LF = -2,
	EMPTY = -3,
	HEX_2 = -4,
	HEX_4 = -5,
	HEX_8 = -6
}


export const ESCAPE_SEQUENCE: { [key: number]: number } = {
	[0x30]: 0,	 /* \0 */
	[0x61]: 0x07,  /* \a */
	[0x62]: 0x08,  /* \b */
	[0x74]: 0x09,  /* \t */
	[0x6E]: 0x0A,  /* \n */
	[0x4E]: 0x85,  /* \N */
	[0x76]: 0x0B,  /* \v */
	[0x66]: 0x0C,  /* \f */
	[0x72]: 0x0D,  /* \r */
	[0x65]: 0x1B,  /* \e */
	[0x5F]: 0xA0,  /* \_ */
	[0x4C]: 0x2028,  /* \L */
	[0x50]: 0x2029,  /* \P */
	[0x78]: EscapeSequenceSpecial.HEX_2,  /* \x */
	[0x75]: EscapeSequenceSpecial.HEX_4,  /* \u */
	[0x55]: EscapeSequenceSpecial.HEX_8,  /* \U */

	[CharCode.CR]: EscapeSequenceSpecial.CR,
	[CharCode.LF]: EscapeSequenceSpecial.LF,
	[CharCode.TAB]: EscapeSequenceSpecial.EMPTY,
	[CharCode.SPACE]: EscapeSequenceSpecial.EMPTY,
	[CharCode.UNICODE_SPACE]: CharCode.SPACE,
	[CharCode.QUOTE_DOUBLE]: CharCode.QUOTE_DOUBLE,
	[CharCode.QUOTE_SINGLE]: CharCode.QUOTE_SINGLE,
	[CharCode.SLASH]: CharCode.SLASH,
	[CharCode.BACKSLASH]: CharCode.BACKSLASH,
	[CharCode.QUOTE_DOUBLE]: CharCode.QUOTE_DOUBLE
}


export function isPrintable(charcode: number): boolean {
	return charcode === CharCode.TAB
		|| charcode === CharCode.LF
		|| charcode === CharCode.CR
		|| (charcode != 0x7F && charcode >= 0x20 && charcode <= 0xD7FF) // DEL is not printable
		|| (charcode >= 0xE000 && charcode <= 0xFFFD)
		|| (charcode >= 0x010000 && charcode <= 0x10FFFF)
}