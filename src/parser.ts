import { YamlDocument, Directive, Mapping, Sequence, TagName } from "./document"
import {
	CharCode,
	IS_NBS,

	EOL,
	RX_MULTI_EOL,
	RX_NS_CHARS,
	RX_NB_CHARS,
	RX_PLAIN_STRING,
	RX_INT_DEC,
	RX_INT_HEX,
	RX_INT_OCT,
	RX_FLOAT_SECOND_PART,
	YAML_DIRECTIVE_VALUE,
	TAG_DIRECTIVE_HANDLE,
	TAG_DIRECTIVE_NS,
	TAG_NAME,
	PLAIN_MAPPING_KEY,
	FLOW_INDICATOR,
	RX_ANCHOR,
	RX_TIMESTAMP_PART,
	RX_TIMESTAMP_MS,
	RX_TIMESTAMP_TZ,
	RX_WS
} from "./lexer"


// const enum State {
// 	FILE,
// 	DOCUMENT,
// 	BLOCK_MAPPING,
// 	INLINE_MAPPING,
// 	BLOCK_SEQUENCE,
// 	INLINE_SEQUENCE,
// 	SIMPLE_STRING,
// 	BLOCK_STRING_LITERAL,
// 	BLOCK_STRING_FOLDED
// }


export type Cursor = {
	line: number
	col: number
};


const enum BlockCollection {
	MAPPING,
	SEQUENCE,
	OTHER
}


const enum PlainStringType {
	STRING,
	MAPPING_KEY
}


type CollectionItem = {
	kind: BlockCollection
	item: any
	column: number
}


type PlainString = string & {type: PlainStringType}


class CollectionStack extends Array<CollectionItem> {
	public get current(): CollectionItem {
		return this[this.length - 1]
	}

	public add(kind: BlockCollection, item: any, column: number): any {
		this.push({ kind, item, column })
		return item
	}

	public removeUntil(column: number) {
		let i = this.length
		if (i) {
			while (i-- && this[i].column > column);
			this.splice(++i, this.length - i)
		}
	}
}


export type DocumentFactory<D extends YamlDocument> = (parser: Parser<D>) => D


export interface DocumentCls<D extends YamlDocument> {
	create(parser: Parser<D>): D
}


export type Location = {
	file: string,
	column: number,
	line: number,
	offset: number
};


export class YamlError extends Error {
	public constructor(message: string, public location: Location) {
		super(`${message} @ ${location.file ? location.file + ":" : ""}${location.line},${location.column}`)
	}
}


export class Parser<D extends YamlDocument> {
	public fileName: string

	protected offset: number
	protected data: string
	protected documents: D[] = []
	protected doc: D
	protected documentFactory: any
	protected linePosition: number

	protected _currentString: string // maybe collection?
	protected _inFlow: number = 0
	protected _lastPlainStringType: PlainStringType
	protected _blockCollectionStack: CollectionStack
	protected _anchor: string
	protected _implicitKey: number = 0

	public constructor(documentFactory: DocumentFactory<D> | DocumentCls<D>) {
		this.documentFactory = documentFactory
	}

	public parse(data: string, fileName: string = null): D[] {
		this.linePosition = 0
		this.offset = 0
		this.data = data.replace(/\s+$/m, "")
		this.fileName = fileName
		this.parseFile()
		this.documentEnd()
		return this.documents
	}

	// public get cursor(): Cursor {
	// 	let data = this.data.substr(0, this.offset)
	// 	let lines = data.split(/\r?\n/)
	// 	return {
	// 		line: lines.length,
	// 		col: lines.length ? lines[lines.length - 1].length + 1 : 0
	// 	}
	// }

	public getLocation(offset: number = null): Location {
		if (offset === null) {
			offset = this.offset
		}
		let data = this.data.substr(0, offset)
		let lines = data.split(/\r?\n/)
		return {
			file: this.fileName,
			column: lines.length ? lines[lines.length - 1].length + 1 : 0,
			line: lines.length,
			offset: offset
		}
	}

	public get column(): number {
		return this.offset - this.linePosition
	}

	protected parseFile(): any {
		this.nextLine()

		console.log("XXXX", this.data.slice(this.offset))

		if (!this.doc) {
			if (typeof this.documentFactory.create === "function") {
				this.doc = this.documentFactory.create(this)
			} else {
				this.doc = this.documentFactory(this)
			}
		}

		switch (this.data[this.offset]) {
			case "%": return this.directive()
			case "-": this.documentStart()
		}

		(<any> this.doc)._content = this.parseDocument()
	}

	protected parseDocument() {
		// this._mappingStack = new Stack<Mapping>()
		// this._seqStack = new Stack<Sequence>()
		this._blockCollectionStack = new CollectionStack()
		// this.parseStartOfLine()
		return this.parseValue()
	}

	protected parseValue(): any {

		switch (this.data[this.offset]) {
			case "'": return this.quotedString("'")
			case "\"": return this.quotedString("\"")
			case "[": return this.inlineSequence()
			case "{": return this.inlineMapping()
			case "!": return this.tag()
			case "&": return this.anchor()
			case "*": return this.alias()
			case "?": return this.implicitKey()

			case "0":
			case "1":
			case "2":
			case "3":
			case "4":
			case "5":
			case "6":
			case "7":
			case "8":
			case "9":
				return this.number()

			case "+": ++this.offset; return this.number()
			case "-":
				// TODO: ez itt szerintem lehetne optimálisabb
				++this.offset

				let maybeNumber = this.number()
				if (maybeNumber !== null) {
					return -maybeNumber
				}
				return this.blockSequence()

			case ".":
				let maybeFloat = this.number("0")
				if (maybeFloat !== null) {
					return maybeFloat
				}
				return this.documentEnd()

			case "@": return this.error("reserved character '@'")
			case "`": return this.error("reserved character '`'")
			default: return this.plainString()
		}
	}

	protected directive() {
		++this.offset

		let name = this._read(RX_NS_CHARS)
		if (!name) {
			return this.unexpected()
		}

		this.eatNBS()

		switch (name) {
			case "YAML":
				this.doc.onDirective(name, this._read(YAML_DIRECTIVE_VALUE))
				break

			case "TAG":
				this.doc.onDirective(name, {
					prefix: this._read(TAG_DIRECTIVE_HANDLE),
					namespace: this.eatNBS() || this._read(TAG_DIRECTIVE_NS)
				})
				break

			default:
				this.doc.onDirective(name, this._read(RX_NB_CHARS))
				break
		}

		this.parseFile()
	}

	protected documentStart(): void {
		if (this.data[++this.offset] === "-") {
			if (this.data[++this.offset] === "-") {
				++this.offset
				this.nextLine()
			} else {
				this.unexpected()
			}
		} else {
			--this.offset
		}
	}

	protected documentEnd() {
		this.nextLine()

		if (this.data.length <= this.offset + 1) {
			if (this.documents.indexOf(this.doc) === -1) {
				this.documents.push(this.doc)
			}
			return null
		}

		if (this.data[++this.offset] === ".") {
			if (this.data[++this.offset] === ".") {
				this.documents.push(this.doc)
			} else {
				this.unexpected(".")
			}
		} else {
			this.unexpected(".")
		}

		return null
	}

	protected blockSequence(): any {
		// nincs szóköz azaz megy a számokhoz
		// if (p === this.position) {
		// 	return this.number()
		// }

		let col = this.column - 1,
			seq = this.storeAnchor(this.getBlockCollection(col, BlockCollection.SEQUENCE))

		this.nextLine()
		this.doc.onSequenceEntry(seq, this.parseValue())

		if (this.nextLine(col)) {
			this.parseValue()
		}

		return this.doc.onSequenceEnd(seq)
	}

	protected inlineSequence() {
		let seq = this.storeAnchor(this.doc.onSequenceStart())

		if (this.data[++this.offset] === "]") { // empty array
			return this.doc.onSequenceEnd(seq)
		}

		++this._inFlow
		this.nextLine()

		while (true) {
			this.doc.onSequenceEntry(seq, this.parseValue())
			this.nextLine()

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.nextLine()

					if (this.data[this.offset] === "]") {
						--this._inFlow
						++this.offset
						return this.doc.onSequenceEnd(seq)
					}
				break

				case "]":
					--this._inFlow
					++this.offset
					return this.doc.onSequenceEnd(seq)

				default:
					--this._inFlow
					this.unexpected([",", "]"])
					return null
			}
		}
	}

	protected inlineMapping() {
		let mapping = this.storeAnchor(this.doc.onMappingStart()),
			key

		if (this.data[++this.offset] === "}") { // empty mapping
			return mapping
		}

		++this._inFlow
		this.nextLine()

		while (true) {
			switch (this.data[this.offset]) {
				case "\"":
					key = this.readQuotedString("\"")
				break

				case "'":
					key = this.readQuotedString("'")
				break

				case "?":
					++this._implicitKey
					++this.offset
					this.eatNBS()
					key = this.parseValue()
					--this._implicitKey
				break

				case "}": // if ends with comma
					--this._inFlow
					++this.offset
					return this.doc.onMappingEnd(mapping)

				case ":":
					key = null
					--this.offset
				break

				default:
					key = this.readPlainString()

					if (this._lastPlainStringType === PlainStringType.MAPPING_KEY) {
						--this.offset
					}
				break
			}

			this.nextLine()

			if (this.data[this.offset] === ":") {
				++this.offset
				this.nextLine()
				this.doc.onMappingKey(mapping, key, this.parseValue())
				this.nextLine()
			} else {
				this.doc.onMappingKey(mapping, key, null)
			}

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.nextLine()
				break

				case "}":
					--this._inFlow
					++this.offset
					return this.doc.onMappingEnd(mapping)

				default:
					--this._inFlow
					this.unexpected([",", "}"])
					return null
			}
		}
	}

	protected quotedString(quote: string) {
		let column = this.column,
			str = this.readQuotedString(quote)

		this.eatNBS()

		// mapping key
		if (!this._implicitKey && this.data[this.offset] === ":") {
			++this.offset
			return this.blockMapping(column, str)
		}

		return this.doc.onQuotedString(str, quote)
	}

	protected plainString(): any {
		let column = this.column,
			str = this.readPlainString()

		if (this._lastPlainStringType === PlainStringType.MAPPING_KEY) {
			return this.blockMapping(column, str)
		} else {
			return this.doc.onPlainString(str)
		}
	}

	protected implicitKey(): any {
		let column = this.column

		++this.offset
		this.eatNBS()

		++this._implicitKey
		let key = this.parseValue()
		--this._implicitKey

		this.eatNBS()

		if (this.data[this.offset] === ":") {
			++this.offset
			return this.blockMapping(column, key)
		} else {
			if (this.nextLine(column)) {
				if (this.data[this.offset] === ":") {
					++this.offset
					return this.blockMapping(column, key)
				}
			}
		}

		this.unexpected(":")
	}

	protected blockMapping(column: number, mappingKey: any): any {
		console.log("Mapping", column)
		let mapping = this.storeAnchor(this.getBlockCollection(column, BlockCollection.MAPPING))
		this.nextLine()
		this.doc.onMappingKey(mapping, mappingKey, this.parseValue())

		if (this.nextLine(column)) {
			this.parseValue()
		}

		return this.doc.onMappingEnd(mapping)
	}

	protected comment(minColumn: number) {
		if (this.data[this.offset] === "#") {
			++this.offset
			this.eatNBS()
			this.doc.onComment(this._read(RX_NB_CHARS))
			this.eatNBS()
		}
	}

	protected number(float?: string, base: number = 10): any {
		if (!float) {
			if (this.data[this.offset] === "0" && base === 10) {
				switch (this.data[this.offset + 1]) {
					case "x":
						this.offset += 2
						return this.number(null, 16)

					case "o":
						this.offset += 2
						return this.number(null, 8)

					case ".":
						++this.offset
						return this.number("0", base)

					default:
						++this.offset
						return 0

				}
			} else if (this.data[this.offset] === ".") {
				return this.number("0", base)
			}

			let int = base === 10 ? this._read(RX_INT_DEC)
				: base === 8 ? this._read(RX_INT_OCT)
					: base === 16 ? this._read(RX_INT_HEX)
						: this.error("Unknown integer param: base=" + base)

			if (typeof int === "string" && int.length) {
				let c = this.data[this.offset]
				if (c === "." || c === "e" || c === "E") {
					return this.number(int)
				} else if (c === "-") {
					return this.timestamp(int)
				} else {
					return parseInt(int, base)
				}
			}
		} else {
			let part = this._read(RX_FLOAT_SECOND_PART)
			if (part.length) {
				if (part === "nan" || part === "Nan" || part === "NAN") {
					return NaN
				} else if (part === "inf" || part === "Inf" || part === "INF") {
					return Infinity
				} else {
					return parseFloat(`${float}${part}`)
				}
			}
		}
		return null
	}

	// TODO: fáj a szívem érte, de leht át kéne alakítani úgy, hogy a schema értelmezze
	protected timestamp(year: string): Date | string {
		let start = this.offset - 4,
			month, day, hour, minute, second, ms
		++this.offset

		if (!(month = this._read(RX_TIMESTAMP_PART)) || this.data[this.offset++] !== "-") {
			this.offset = start; return this.plainString()
		}

		if (!(day = this._read(RX_TIMESTAMP_PART))) {
			this.offset = start; return this.plainString()
		}

		if (this.data[this.offset] === "t" || this.data[this.offset] === "T") {
			++this.offset
			if (!(hour = this._read(RX_TIMESTAMP_PART)) || this.data[this.offset++] !== ":") {
				this.offset = start; return this.plainString()
			}
		} else {
			this.eatNBS()
			if (!(hour = this._read(RX_TIMESTAMP_PART))) {
				let ch = this.data[this.offset]
				if (ch === "," || ch === "]" || ch === "}" || ch === "\r" || ch === "\n" || ch === "#" || !ch) {
					return new Date(`${year}-${month}-${day}`)
				} else {
					this.offset = start; return this.plainString()
				}
			} else if (this.data[this.offset++] !== ":") {
				this.offset = start; return this.plainString()
			}
		}

		if (!(minute = this._read(RX_TIMESTAMP_PART)) || this.data[this.offset++] !== ":") {
			this.offset = start; return this.plainString()
		}

		if (!(second = this._read(RX_TIMESTAMP_PART))) {
			this.offset = start; return this.plainString()
		}

		if (this.data[this.offset] === ".") {
			++this.offset
			if (ms = this._read(RX_TIMESTAMP_MS)) {
				ms = parseInt(ms, 10)
			} else {
				this.offset = start; return this.plainString()
			}
		} else {
			ms = 0
		}

		if (this.data[this.offset] === "z" || this.data[this.offset] === "Z") {
			++this.offset
			return new Date(Date.UTC(
				parseInt(year, 10),
				parseInt(month, 10) - 1,
				parseInt(day, 10),
				parseInt(hour, 10),
				parseInt(minute, 10),
				parseInt(second, 10),
				ms
			))
		} else {
			this.eatNBS()

			if (this.data[this.offset] === "+" || this.data[this.offset] === "-") {
				let tzs = this.offset, tz
				++this.offset
				tz = this._read(RX_TIMESTAMP_TZ)

				if (tz) {
					if (tz.length === 4) {
						tz = `${tz.slice(0,2)}:${tz.slice(2)}`
					}

					let h = parseInt(tz.split(/:/)[0], 10),
						m = parseInt(tz.split(/:/)[1] || "0", 10)
					tz = `${this.data[tzs]}${h < 10 ? `0${h}` : h}${m < 10 ? `0${m}` : m}`

					return new Date(this.data.slice(start, tzs).trim() + tz)
				} else {
					this.offset = start; return this.plainString()
				}
			} else {
				let ch = this.data[this.offset]
				if (ch === "," || ch === "]" || ch === "}" || ch === "\r" || ch === "\n" || ch === "#" || !ch) {
					return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`)
				} else {
					this.offset = start; return this.plainString()
				}
			}
		}
	}

	protected tag() {
		let handle = this._read(TAG_DIRECTIVE_HANDLE),
		    name = this._read(TAG_NAME)

		if (!name) {
			this.error(`The ${handle} handle has no suffix.`)
		}

		let factory = this.doc.onTagStart(handle, name)
		if (!factory) {
			this.error(`The ${handle}${name} tag is unknown.`)
		}

		this.nextLine()
		return this.doc.onTagEnd(factory(this.doc, this.parseValue()))
	}

	protected anchor() {
		++this.offset
		this._anchor = this._read(RX_ANCHOR)
		if (!this._anchor) {
			this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
		}
		this.nextLine()
		let result = this.parseValue()
		return this.storeAnchor(result)
	}

	protected storeAnchor(value: any): any {
		if (this._anchor) {
			let id = this._anchor
			this._anchor = null
			this.doc.onAnchor(id, value)
		}
		return value
	}

	protected alias(): any {
		++this.offset
		let id = this._read(RX_ANCHOR)
		if (!id) {
			this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
		}
		return this.doc.onAlias(id)
	}

	public unexpected(expected?: string | string[]) {
		if (typeof expected === "string") {
			this.error(`Unexpected character: '${this.data[this.offset]}'${expected ? ` expected: '${expected}'` : ""}`)
		} else {
			this.error(`Unexpected character: '${this.data[this.offset]}'${expected ? ` expected: '${expected.join("', '")}'` : ""}`)
		}
	}

	public error(message: string, offset: number = null): void {
		throw new YamlError(message, this.getLocation(offset))
	}

	protected _read(rx: RegExp) {
		rx.lastIndex = this.offset
		let m = rx.exec(this.data)
		if (m && m.index === this.offset) {
			this.offset += m[0].length
			return m[0]
		}
		return null
	}

	/**
	 * Skip all non breaking space like tab or space
	 */
	protected eatNBS() {
		while (true) {
			let c = this.data.charCodeAt(this.offset)
			if (c !== CharCode.SPACE && c !== CharCode.TAB) {
				break
			} else {
				++this.offset
			}
		}
	}

	/**
	 * A következő sorba mozgatja az aktuális pozíciót.
	 *
	 * Olyan módon csinálja ezt, hogy ha az aktuális sorban csak comment vagy whitespace
	 * karakter van akkor megy a következő sor elejére. Ha az aktuális sor
	 * szóközökkel kezdődik akkor a pozíciót tovább löki a legelső nem szóköz karakterre.
	 *
	 * @returns Az összes következő feltétel teljesülése után tér vissza igazzal:
	 *
	 *  - Sikerült új sorba mozgatni a pzíciót
	 *  - Ha megvolt adva a __minColumn__ paraméter akkor
	 *    legalább ennyi szóköznek kell szerpelnie a következő sor elején
	 *
	 *  Ha nem teljesül akkor *false* értékkel tér vissza és
	 *  a pozíciót is visszaállítja az utolsó whitespace utáni karakter
	 * 	pozíciójára a kiinduális pozíciótól nézve.
	 */
	protected nextLine(minColumn: number = null): boolean {
		let data = this.data,
			start = this.offset,
			pos = start,
			linePosition = null

		while (true) {
			switch (data.charCodeAt(pos++)) {
				case CharCode.SPACE:
					// ebben az esetben legalább egy sortörés volt
					// if (linePosition !== null) {
					// 	++column
					// }
				break

				case CharCode.CR:
					if (data.charCodeAt(pos) === CharCode.LF) {
						++pos
					}
					// szándékosan nincs break
				case CharCode.LF:
					linePosition = pos
				break

				case CharCode.HASH:
					// TODO: maybe merge comments
					let start = pos
					while (IS_NBS[data.charCodeAt(pos)]) ++pos // eat all chars expect linebreaks
					this.doc.onComment(data.slice(start, pos))
				break

				case CharCode.TAB:
					if (linePosition !== null) {
						this.error("Document cannot contains tab character as indention character")
					}
				break

				case undefined:
					return

				default:
					let lp = this.linePosition
					if (linePosition !== null) {
						this.linePosition = linePosition
					}

					if (minColumn !== null && minColumn > this.column) {
						this.linePosition = lp
						this.offset = start
						return false
					} else {
						this.offset = pos - 1
					}

					return linePosition !== null
			}
		}

		/*
		this.eatNBS()
		this.comment(minColumn)

		let pos = this.position,
			ch

		while (true) {
			ch = this.data[this.position]
			if (ch === "\r" || ch === "\n") {
				++this.position
			} else {
				break
			}
		}

		if (pos !== this.position) {
			this.linePosition = this.position

			while (true) {
				ch = this.data[this.position]
				if (ch === " ") {
					++this.position
				} else if (ch === "\t") { // a tab karakter lehet engedélyezett
					this.error("Document cannot contains tab character as indention character")
				} else {
					break
				}
			}

			if (minColumn !== null && minColumn > this.column) {
				this.position = pos
				return false
			}

			// this.parseStartOfLine()
			return true
		}

		return false
		*/
	}


	protected readPlainString(): string {
		let ch,
			start = this.offset,
			inFlow = this._inFlow,
			nlStartAt = NaN

		while(true) {
			ch = this.data[this.offset]

			if (ch === "\r") {
				nlStartAt = this.offset
				if (this.data[this.offset + 1] === "\n") {
					++this.offset
				}
			} else if (ch === "\n") {
				nlStartAt = this.offset
			} else if (ch === ":") {
				ch = this.data[this.offset + 1]
				if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === ",") {
					// ha ez egy lehetséges mapping key és volt már sortörés akkor visszalép
					// az előző sortörésre és visszaadja az addig értelmezett értéket
					if (!isNaN(nlStartAt)) {
						this._lastPlainStringType = PlainStringType.STRING
						this.offset = nlStartAt
						return this._plainString(this.data.slice(start, nlStartAt))
					}

					++this.offset
					this._lastPlainStringType = PlainStringType.MAPPING_KEY
					return this._plainString(this.data.slice(start, this.offset - 1))
				} // else parse as normal string
			} else if (ch === "-") {
				ch = this.data[this.offset + 1]
				if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === ",") {
					if (!isNaN(nlStartAt)) {
						this._lastPlainStringType = PlainStringType.STRING
						this.offset = nlStartAt
						return this._plainString(this.data.slice(start, nlStartAt))
					}
				}
			} else if (ch === undefined || (inFlow && FLOW_INDICATOR.indexOf(ch) !== -1)) {
				this._lastPlainStringType = PlainStringType.STRING
				return this._plainString(this.data.slice(start, this.offset))
			} else if (ch === "#") {
				ch = this.data[this.offset - 1]
				if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
					this._lastPlainStringType = PlainStringType.STRING
					--this.offset
					return this._plainString(this.data.slice(start, this.offset))
				}
			}

			++this.offset
		}
	}

	protected readQuotedString(terminal: string) {
		let ch = this.data[++this.offset], result = "";

		while (ch) {
			if (ch === "\\") {
				ch = this.readEscapedChar()
			} else if (ch === terminal) {
				++this.offset
				break
			} else if (ch === "\r" || ch === "\n") { // a következő üres sorokat "megeszi"
				if (ch === "\r" && this.data[this.offset + 1] === "\n") {
					++this.offset
				}

				// let hasSpace = false, hasDoubleNl = false

				while (true) {
					ch = this.data[++this.offset]

					if (ch === "\r") {
						if (this.data[this.offset + 1] === "\n") {
							++this.offset
						}
						result += "\n"
						// hasDoubleNl = true
					} else if (ch === "\n") {
						result += "\n"
						// hasDoubleNl = true
					} else if (ch !== " " && ch !== "\t") {
						break
					}
				}

				continue
			} else if (ch === " " || ch === "\t") { // ha egynél több space van akkor azt mind "megeszi"
				do {
					ch = this.data[++this.offset]
				} while(ch === " " || ch === "\t")

				if (result[result.length - 1] !== " ") {
					result += " "
				}

				continue
			}

			result += ch
			ch = this.data[++this.offset]
		}

		return result
	}

	protected readEscapedChar(): string {
		let ch = this.data[++this.offset]

		switch (ch) {
			case "\r":
			case "\n":
			case "\t":
			case " ":
				this._read(RX_WS)
				return this.data[this.offset]

			case "0": return "\x00"
			case "a": return "\x07"
			case "b": return "\x08"
			case "t": return "\x09"
			case "n": return "\x0A"
			case "N": return "\x85"
			case "v": return "\x0B"
			case "f": return "\x0C"
			case "r": return "\x0D"
			case "e": return "\x1B"
			case "_": return "\xA0"
			case "L": return "\u2028"
			case "P": return "\u2029"

			case "\"":
			case "'":
			case "/":
			case "\\":
				return ch

			// TODO:
			// Escaped 8-bit Unicode character.
			case "x":
				break

			// Escaped 16-bit Unicode character.
			case "u":
				break

			// Escaped 32-bit Unicode character.
			case "U":
				break
		}

		this.error("Unexpected escape sequence")
	}

	private _plainString(s: string) {
		s = s.trim()
			.replace(/[ \t]*\r?\n[ \t]*/g, "\n") // a sortörések normalizálása
			.replace(/([^\n])\n(?!\n)/g, "$1 ") // egy sortörés space-re cserélése
			.replace(/\n(\n+)/g, "$1") // az egynél több sortörések cseréje n-1 sortörésre, ahol n a sortörés száma
		return s && s.length ? s : null
	}

	protected getBlockCollection(column: number, kind: BlockCollection.MAPPING): Mapping;
	protected getBlockCollection(column: number, kind: BlockCollection.SEQUENCE): Sequence;

	protected getBlockCollection(column: number, kind: BlockCollection): any {
		console.log("getBlockCollection", column, kind)
		let current = this._blockCollectionStack.current
		if (current) {
			if (current.column === column) {
				if (current.kind === kind) {
					return current.item
				} else {
					this.error("Unexpected collection at this level")
				}
			} else if (current.column < column) {
				return this._blockCollectionStack.add(kind, this.newBlockCollection(kind), column)
			} else {
				this._blockCollectionStack.removeUntil(column)
				console.log("AAAAAAAAA", column, this._blockCollectionStack)
				return this.getBlockCollection(column, <any> kind)
			}
		}
		return this._blockCollectionStack.add(kind, this.newBlockCollection(kind), column)
	}

	protected newBlockCollection(kind: BlockCollection) {
		switch (kind) {
			case BlockCollection.MAPPING: return this.doc.onMappingStart()
			case BlockCollection.SEQUENCE: return this.doc.onSequenceStart()
		}
	}
}