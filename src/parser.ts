import { YamlDocument } from "./document"
import {Mapping, Sequence, Scalar} from "./node"
import { TypeFactory } from "./schema"
import { Loader } from "./loader"
import {ITypeFactory} from "./handler"
import {
	CharCode,
	IS_NBS,
	IS_EOL,
	IS_WS,
	IS_INDICATOR,
	IS_SCALAR_FIRST_CHAR_DECISION,
	IS_FLOW_INDICATOR,
	IS_DIGIT,

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


// const enum BlockCollection {
// 	MAPPING,
// 	SEQUENCE,
// 	OTHER
// }


const enum PlainStringType {
	STRING,
	MAPPING_KEY
}


const enum Chomping {
	CLIP,
	STRIP,
	KEEP
}


// type CollectionItem = {
// 	kind: BlockCollection
// 	item: any
// 	column: number
// }


// type PlainString = string & {type: PlainStringType}


// class CollectionStack extends Array<CollectionItem> {
// 	public get current(): CollectionItem {
// 		return this[this.length - 1]
// 	}

// 	public add(kind: BlockCollection, item: any, column: number): any {
// 		this.push({ kind, item, column })
// 		return item
// 	}

// 	public removeUntil(column: number) {
// 		let i = this.length
// 		if (i) {
// 			while (i-- && this[i].column > column);
// 			this.splice(++i, this.length - i)
// 		}
// 	}
// }


export type Location = {
	file: string,
	column: number,
	line: number,
	offset: number
};


export class YamlError extends Error {
	public constructor(message: string, public location: Location, content?: string) {
		super(`${message} at ${location.file ? location.file + ":" : ""}${location.line},${location.column}`)
	}
}


const enum DocumentState {
	// még nem érte el a végét
	PARSING = 0,
	// új kezdődőtt, de arégi nem lett lezárva
	NEW_STARTED = 1,
	// a jelenlegi a ... -al le lett zárva
	CLOSED = 2
}

// class DocumentStartHandler {
// 	public constructor(public doc: ITypeFactory, public replace: () => void) {
// 	}

// 	public onMappingStart() {
// 		this.replace()
// 		return (this.doc as any).content = this.doc.onMappingStart()
// 	}

// 	public onSequenceStart() {
// 		this.replace()
// 		return (this.doc as any).content = this.doc.onSequenceStart()
// 	}

// 	public onScalar(value) {
// 		this.replace()
// 		return (this.doc as any).content = this.doc.onScalar(value)
// 	}

// 	public onQuotedString(value, quote) {
// 		this.replace()
// 		return (this.doc as any).content = this.doc.onQuotedString(value, quote)
// 	}

// 	public onBlockString(value, isFolded) {
// 		this.replace()
// 		return (this.doc as any).content = this.doc.onBlockString(value, isFolded)
// 	}

// 	public onTagStart(handle: string, name: string) {
// 		return new DocumentStartHandler(this.doc.onTagStart(handle, name), this.replace)
// 	}

// 	// just proxy...
// 	public onMappingEnd(mapping) { return this.doc.onMappingEnd(mapping) }
// 	public onMappingKey(mapping, key, value) { return this.doc.onMappingKey(mapping, key, value) }
// 	public onSequenceEnd(seq) { return this.doc.onSequenceEnd(seq) }
// 	public onSequenceEntry(seq, value) { return this.doc.onSequenceEntry(seq, value) }
// 	public onTagEnd(value) { return this.doc.onTagEnd(value) }
// }


class DocumentEnd extends Error {

}


export class Parser {
	public fileName: string

	protected offset: number
	protected data: string
	protected documents: YamlDocument[]
	protected doc: YamlDocument
	protected handlerStack: ITypeFactory[]
	protected linePosition: number

	// protected _currentString: string // maybe collection?
	protected _inFlow: number = 0
	protected _lastScalarIsMappingKey: boolean
	protected _anchor: string
	protected _explicitKey: number = 0
	protected _documentState: DocumentState = DocumentState.NEW_STARTED
	protected _lastKeyColumn: number | null = null

	public constructor(protected loader: Loader) {
	}

	public parse(data: string, fileName: string): YamlDocument[] {
		this.linePosition = 0
		this.offset = 0
		this.data = (data.charCodeAt(0) === CharCode.BOM ? data.slice(1) : data).replace(/\s+$/m, "")
		this.fileName = fileName
		this.documents = []
		this.handlerStack = []
		this.parseFile()
		return this.documents
	}

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

	protected get column(): number {
		return this.offset - this.linePosition + 1
	}

	protected popHandler(): ITypeFactory {
		if (this.handlerStack.length === 1) {
			return this.handlerStack[0]
		} else {
			return this.handlerStack.pop()
		}
	}

	protected parseFile(): any {
		this.nextLine()

		if (this.data.length <= this.offset + 1) {
			return null
		}

		switch (this.data[this.offset]) {
			case "%": return this.directive()
			case "-":
				if (this.data[this.offset + 1] === "-" && this.data[this.offset + 2] === "-") {
					this.offset += 3
					this.nextLine()
					return this.parseDocument()
				}
		}

		if (this._documentState === DocumentState.NEW_STARTED) {
			this.parseDocument()
		} else {
			this.error("New document start or a directive expected near")
		}
	}

	protected parseDocument() {
		this.documents.push(this.doc = this.loader.onDocumentStart())
		this.handlerStack = [this.doc]
		this._documentState = DocumentState.PARSING;

		(this.doc as any).content = this.parseValue()

		this.parseFile()
	}

	protected parseValue(minColumn?: number): any {

		switch (this.data[this.offset]) {
			case "'": return this.quotedString("'")
			case "\"": return this.quotedString("\"")
			case "[": return this.inlineSequence()
			case "{": return this.inlineMapping()
			case "|": return this.readBlockScalar(minColumn, false)
			case ">": return this.readBlockScalar(minColumn, true)
			case "!":
				// if (this._tagFactory) {
				// 	this.error("Tag constructors not supporting from tag values")
				// }
				return this.tag()
			case "&": return this.anchor()
			case "*":
				// if (this._tagFactory) {
				// 	this.error("Tag constructors not supporting from alias")
				// }
				return this.alias()
			case "?":
				let column = this.column
				let key = this.explicitKey()
				return this.blockMapping(column, key)
			case "-":
				switch (this.data.charCodeAt(this.offset + 1)) {
					case CharCode.DASH:
						if (this.data.charCodeAt(this.offset + 2)) {
							this.offset += 3
							this._documentState = DocumentState.NEW_STARTED
							return
						}
					case CharCode.SPACE:
					case CharCode.TAB:
					case CharCode.CR:
					case CharCode.LF:
						return this.blockSequence()
				}
				return this.scalar()
			case ".":
				if (this.data.charCodeAt(this.offset + 1) === CharCode.DOT && this.data.charCodeAt(this.offset + 2) === CharCode.DOT) {
					this.offset += 3
					this._documentState = DocumentState.CLOSED
					return
				}
				return this.scalar()
			case "@": return this.error("reserved character '@'")
			case "`": return this.error("reserved character '`'")
			case undefined: return // EOF
			default: return this.scalar()
		}
	}

	protected isDocumentSeparator(offset: number) {
		let ch = this.data.charCodeAt(offset)
		if ((ch === CharCode.DOT || ch === CharCode.DASH)
			&& this.data.charCodeAt(offset + 1) === ch
			&& this.data.charCodeAt(offset + 2) === ch
			&& IS_WS[this.data.charCodeAt(offset + 3)]) {
			this.offset = offset + 3
			this._documentState = ch === CharCode.DOT ? DocumentState.CLOSED : DocumentState.NEW_STARTED
			return true
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
				this.loader.onDirective(name, this._read(YAML_DIRECTIVE_VALUE))
				break

			case "TAG":
				this.loader.onDirective(name, {
					handle: this._read(TAG_DIRECTIVE_HANDLE),
					namespace: this.eatNBS() || this._read(TAG_DIRECTIVE_NS)
				})
				break

			default:
				this.loader.onDirective(name, this._read(RX_NB_CHARS))
				break
		}

		this.parseFile()
	}

	protected blockSequence(): any {
		let col = this.column,
			handler = this.popHandler(),
			seq = this.storeAnchor(handler.onSequenceStart())

		++this.offset

		endless: while (true) {
			// ha sikerült a következő sorba léptetni valami csoda folytán (elvuleg nem kéne)
			// akkor ha kijjebb kezdődik a következő sor, mint az ahol elkezdődött a lista
			// egyértelműen meg kell szakítani.

			let currentCol = this.nextLine()
			if (currentCol && currentCol < col) {
				break endless;
			}

			let value = this.parseValue(col)
			if (this._documentState !== DocumentState.PARSING) {
				break endless
			} else {
				handler.onSequenceEntry(seq, value)
			}

			switch (this.nextLine(col)) {
				case col:
					if (this.data.charCodeAt(this.offset) === CharCode.DASH) {
						if (this.isDocumentSeparator(this.offset)) {
							break endless
						}
						this._lastKeyColumn = this.column
						++this.offset
					} else {
						break endless
					}
				break

				case 0:
					break endless

				default:
					this.unexpected("SOMETHING WRONG IN BLOCK SEQUENCE")
			}
		}

		return handler.onSequenceEnd(seq)
	}

	protected inlineSequence() {
		let handler = this.popHandler(),
			seq = this.storeAnchor(handler.onSequenceStart())

		if (this.data[++this.offset] === "]") { // empty array
			return handler.onSequenceEnd(seq)
		}

		++this._inFlow
		this.nextLine()

		loop: while (true) {
			handler.onSequenceEntry(seq, this.parseValue())
			this.nextLine()

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.nextLine()

					if (this.data[this.offset] === "]") {
						++this.offset
						break loop
					}
				break

				case "]":
					++this.offset
					break loop

				default:
					--this._inFlow
					this.unexpected([",", "]"])
					return null
			}
		}

		--this._inFlow
		return handler.onSequenceEnd(seq)
	}

	protected inlineMapping() {
		let handler = this.popHandler(),
			mapping = this.storeAnchor(handler.onMappingStart()),
			key

		if (this.data[++this.offset] === "}") { // empty mapping
			return handler.onMappingEnd(mapping)
		}

		++this._inFlow
		this.nextLine()

		while (true) {
			key = this.mappingKey()

			if (this.data[this.offset] === ":") {
				++this.offset
				this.nextLine()
				handler.onMappingKey(mapping, key, this.parseValue())
				this.nextLine()
			} else {
				handler.onMappingKey(mapping, key, null)
			}

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.nextLine()

					if (this.data[this.offset] === "}") {
						--this._inFlow
						++this.offset
						return handler.onMappingEnd(mapping)
					}
				break

				case "}":
					--this._inFlow
					++this.offset
					return handler.onMappingEnd(mapping)

				default:
					--this._inFlow
					this.unexpected([",", "}"])
					return null
			}
		}
	}

	protected quotedString(quote: string) {
		let column = this.column,
			handler = this.popHandler(),
			str = this.readQuotedString(quote)

		this.eatNBS()

		// mapping key
		if (!this._explicitKey && this.data[this.offset] === ":") {
			++this.offset
			return this.blockMapping(column, str)
		}

		return handler.onQuotedString(str, quote)
	}

	protected scalar(): any {
		let column = this.column,
			str = this.readScalar()

		if (this._lastScalarIsMappingKey) {
			return this.blockMapping(column, str)
		} else {
			if (str === "") {
				return null
			} else {
				return this.popHandler().onScalar(str)
			}
		}
	}

	protected blockMapping(column: number, mappingKey: any): any {
		let handler = this.popHandler(),
			mapping = this.storeAnchor(handler.onMappingStart())

		while (true) {
			if (this.data.charCodeAt(this.offset) === CharCode.COLON) {
				++this.offset
			} else if (mappingKey === "" || mappingKey === null) {
				break
			}

			let currentCol = this.nextLine()

			if (currentCol && currentCol < column) {
				handler.onMappingKey(mapping, mappingKey, null)
				return handler.onMappingEnd(mapping)
			}

			handler.onMappingKey(mapping, mappingKey, this.parseValue(column))
			if (this.nextLine(column) === column) {
				// http://yaml.org/type/merge.html
				mappingKey = this.mappingKey()

				if (this._documentState !== DocumentState.PARSING) {
					break
				}
			} else {
				break
			}
		}

		return handler.onMappingEnd(mapping)
	}

	protected mappingKey(): string {
		let key

		switch (this.data.charCodeAt(this.offset)) {
			case CharCode.QUOTE_DOUBLE:
				key = this.readQuotedString("\"")
				this.eatNBS()
				return key

			case CharCode.QUOTE_SINGLE:
				key = this.readQuotedString("'")
				this.eatNBS()
				return key

			case CharCode.QUESTION: return this.explicitKey()
			case CharCode.COLON: return null
			case CharCode.DASH:
			case CharCode.DOT:
				if (this.isDocumentSeparator(this.offset)) {
					return
				}
				return this.readScalar()
			default: return this.readScalar()
		}
	}

	protected explicitKey(): any {
		let column = this.column

		++this.offset
		this.nextLine()

		++this._explicitKey
		let key = this.parseValue()
		--this._explicitKey

		this.nextLine()

		return key
	}

	protected tag() {
		let handle = this._read(TAG_DIRECTIVE_HANDLE),
		    name = this._read(TAG_NAME)

		if (!name) {
			this.error(`The ${handle} handle has no suffix.`)
		}

		let handler = this.popHandler(),
		 	tagHandler = handler.onTagStart(handle, name)
		if (!tagHandler) {
			this.error(`The ${handle}${name} tag is unknown.`)
		}

		(tagHandler as any).document = this.doc // ugly, but working
		this.handlerStack.push(tagHandler)

		this.nextLine()
		let value = this.parseValue();
		(tagHandler as any).document = null // ugly, but working
		return handler.onTagEnd(value)
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

	protected unexpected(expected?: string | string[]) {
		if (typeof expected === "string") {
			this.error(`Unexpected character: '${this.data[this.offset]}'${expected ? ` expected: '${expected}'` : ""}`)
		} else {
			this.error(`Unexpected character: '${this.data[this.offset]}'${expected ? ` expected: '${expected.join("', '")}'` : ""}`)
		}
	}

	protected error(message: string, offset: number = null): void {
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
			if (c === CharCode.SPACE || c === CharCode.TAB) {
				++this.offset
			} else {
				return
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
	 * @returns Az összes következő feltétel teljesülése után vissza tér az aktuális sor
	 * 			első nem szóköz karakterének a pozíciójával a soron belül:
	 *
	 *  - Sikerült új sorba mozgatni a pzíciót
	 *  - Ha megvolt adva a __minColumn__ paraméter akkor
	 *    legalább ennyi szóköznek kell szerpelnie a következő sor elején
	 *
	 *  Ha nem teljesül akkor *false* értékkel tér vissza és
	 *  a pozíciót is visszaállítja az utolsó whitespace utáni karakter
	 * 	pozíciójára a kiinduális pozíciótól nézve.
	 */
	protected nextLine(minColumn: number = null): number {
		let data = this.data,
			start = this.offset,
			pos = start,
			linePosition = null

		while (true) {
			switch (data.charCodeAt(pos++)) {
				case CharCode.SPACE:
					continue

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
					let commentStart = pos,
						ch
					// eat all chars expect linebreaks
					do {
						ch = data.charCodeAt(pos++)
					} while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
					--pos // backtrack to CR or LF char
					this.loader.onComment(data.slice(commentStart, pos))
				break

				case CharCode.TAB:
					if (linePosition !== null) {
						this.error("Document cannot contains tab character as indention character")
					}
				break

				case undefined:
					return 0

				default:
					if (linePosition !== null) {
						let column = pos - linePosition

						if (minColumn !== null && minColumn > column) {
							return 0
						} else {
							this.linePosition = linePosition
							this.offset = pos - 1
						}
						return column
					} else {
						this.offset = pos - 1
						return 0
					}
			}
		}
	}

	protected readScalar() {
		let startAt = this.offset,
			position = this.offset - 1,
			data = this.data,
			ch,
			endAt = null,
			lastNl = null,
			firstCharRule = true

		endless: do {
			switch (ch = data.charCodeAt(++position)) {
				case CharCode.SPACE:
				case CharCode.TAB:
					continue endless

				case CharCode.CR:
					if (data.charCodeAt(position + 1) === CharCode.LF) {
						++position
					}
				case CharCode.LF:
					firstCharRule = true
					lastNl = position
					continue endless

				case CharCode.HASH:
					if (IS_WS[data.charCodeAt(position - 1)]) {
						endAt = position - 1
						let commentStart = ++position

						do {
							ch = data.charCodeAt(++position)
						} while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
						this.loader.onComment(data.slice(commentStart, position).trim())
						break endless
					} else {
						continue endless
					}

				case CharCode.COLON:
					ch = data.charCodeAt(position + 1)
					if (IS_WS[ch] || (this._inFlow && IS_FLOW_INDICATOR[ch])) {
						if (lastNl === null) {
							this._lastScalarIsMappingKey = true
							this.offset = position
							if (startAt) {
								return data.slice(startAt, position).trim()
							} else {
								return null
							}
						} else {
							break endless
						}
					} else {
						continue endless
					}

				default:
					if (firstCharRule) {
						firstCharRule = false

						if (IS_SCALAR_FIRST_CHAR_DECISION[ch]) {
							ch = data.charCodeAt(position + 1)
							if (IS_INDICATOR[ch] || IS_WS[ch]) {
								break endless
							}
						} else if (this.isDocumentSeparator(position)) {
							break endless
						}
					}

					if (startAt === null) {
						startAt = position
					}

					if (this._inFlow && IS_FLOW_INDICATOR[ch]) {
						break endless
					}
			}
		} while(ch)

		this._lastScalarIsMappingKey = false

		if (lastNl === null) {
			this.offset = position
		} else {
			this.offset = position = lastNl
		}

		return data.slice(startAt, (endAt === null ? position : endAt)).trim()
			.replace(/[ \t]*\r?\n[ \t]*/g, "\n") // a sortörések normalizálása
			.replace(/([^\n])\n(?!\n)/g, "$1 ") // egy sortörés space-re cserélése
			.replace(/\n(\n+)/g, "$1") // az egynél több sortörések cseréje n-1 sortörésre, ahol n a sortörés száma
	}

	protected readBlockScalar(minColumn: number, isFolded: boolean) {
		if (this._inFlow) {
			this.unexpected([",", "}"])
		}

		++this.offset
		let indentStartAtColumn = null,
			data = this.data,
			ch = data.charCodeAt(this.offset),
			chomping: Chomping = Chomping.CLIP

		// TODO: more digit??? pls...
		if (IS_DIGIT[ch]) {
			indentStartAtColumn = parseInt(data[this.offset], 10)
			if (indentStartAtColumn <= 0) {
				this.error("Bad explicit indentation width of a block scalar; it cannot be less than 1")
			}
			indentStartAtColumn += minColumn
			ch = data.charCodeAt(++this.offset)
		}

		if (ch === CharCode.PLUS) {
			chomping = Chomping.KEEP
			++this.offset
		} else if (ch === CharCode.DASH) {
			chomping = Chomping.STRIP
			++this.offset
		}

		this.eatNBS()

		ch = data.charCodeAt(this.offset)

		if (ch === CharCode.HASH) {
			let commentStart = this.offset
			do {
				ch = data.charCodeAt(++this.offset)
			} while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
			this.loader.onComment(data.slice(commentStart + 1, this.offset).trim())
			--this.offset
		}

		// Innen újra kell gondolni :)

		let currentColumn = this.nextLine(minColumn),
			position = this.offset,
			startAt,
			result = ""

		if (currentColumn === 0) {
			this.unexpected("LINEBREAK")
		} else if (currentColumn <= minColumn) {
			return ""
		}

		if (indentStartAtColumn === null) {
			indentStartAtColumn = currentColumn
		}

		while (currentColumn >= indentStartAtColumn) {
			startAt = position - (currentColumn - indentStartAtColumn)
			do {
				ch = data.charCodeAt(++position)
			} while (ch && ch !== CharCode.CR && ch !== CharCode.LF);

			console.log(data.slice(startAt, position))

			this.offset = position
			currentColumn = this.nextLine()
			position = this.offset
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
		return s
	}
}