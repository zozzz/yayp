
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
	RBRACE = 0x7D, // }
	PIPE = 0x7C, // |
	TILDE = 0x7E, // ~
	BOM = 0xFEFF
}


export function isNBS(ch: number): boolean {
	return CharCode.SPACE === ch
		|| CharCode.TAB === ch
		|| CharCode.UNICODE_SPACE === ch
}

export function isEOL(ch: number): boolean {
	return CharCode.CR === ch
		|| CharCode.LF === ch
}


export function isPeekEOL(ch: number): boolean {
	return CharCode.CR === ch
		|| CharCode.LF === ch
		|| CharCode.HASH === ch
}


export function isWS(ch: number): boolean {
	return CharCode.SPACE === ch
		|| CharCode.TAB === ch
		|| CharCode.CR === ch
		|| CharCode.LF === ch
		|| CharCode.UNICODE_SPACE === ch
}


export function isWSOrEOF(ch: number): boolean {
	return CharCode.SPACE === ch
		|| CharCode.TAB === ch
		|| CharCode.CR === ch
		|| CharCode.LF === ch
		|| CharCode.UNICODE_SPACE === ch
		|| !ch
}


export function isScalarDisallowedFirstChar(ch: number): boolean {
	return CharCode.DASH === ch
		|| CharCode.QUESTION === ch
		|| CharCode.COMMA === ch
}


export function isIndicator(ch: number): boolean {
	return CharCode.DASH === ch
		|| CharCode.QUESTION === ch
		|| CharCode.COLON === ch
		|| CharCode.COMMA === ch
		|| CharCode.LBRACKET === ch
		|| CharCode.RBRACKET === ch
		|| CharCode.LBRACE === ch
		|| CharCode.RBRACE === ch
		|| CharCode.HASH === ch
		|| CharCode.AMPERSAND === ch
		|| CharCode.ASTERIX === ch
		|| CharCode.EXCLAMATION === ch
		|| CharCode.PIPE === ch
		|| CharCode.RANGLE === ch
		|| CharCode.LANGLE === ch
		|| CharCode.QUOTE_SINGLE === ch
		|| CharCode.QUOTE_DOUBLE === ch
		|| CharCode.PERCENT === ch
		|| CharCode.AT === ch
		|| CharCode.BACKTICK === ch
}


export function isFlowIndicator(ch: number): boolean {
	return CharCode.COMMA === ch
		|| CharCode.LBRACKET === ch
		|| CharCode.RBRACKET === ch
		|| CharCode.LBRACE === ch
		|| CharCode.RBRACE === ch
}


export function isDigit(ch: number): boolean {
	return ch > 0x2F && ch < 0x3A
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