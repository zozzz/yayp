import { inspect } from "util"
import { YamlDocument } from "./document"
import { Loader } from "./loader"
import { ITypeFactory } from "./handler"
import {
	CharCode,
	EscapeSequenceSpecial,

	isNBS,
	isWS,
	isEOL,
	isPeekEOL,
	isScalarDisallowedFirstChar,
	isIndicator,
	isFlowIndicator,
	isDigit,

	ESCAPE_SEQUENCE,

	RX_NS_CHARS,
	RX_NB_CHARS,
	YAML_DIRECTIVE_VALUE,
	TAG_DIRECTIVE_HANDLE,
	TAG_DIRECTIVE_NS,
	TAG_NAME,
	RX_ANCHOR
} from "./lexer"


export type Cursor = {
	line: number
	col: number
}


const enum Chomping {
	CLIP,
	STRIP,
	KEEP
}


const enum PeekResult {
	SAME_LINE,
	SAME_INDENT,
	DECREASE_INDENT,
	INCREASE_INDENT
}


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


export class Parser {
	public fileName: string

	protected offset: number
	protected data: string
	protected documents: YamlDocument[]
	protected doc: YamlDocument
	protected linePosition: number
	// protected column: number

	private _inFlowSequence: number = 0
	private _inFlowMapping: number = 0
	private _anchor: string
	private _explicitKey: number = 0
	private _implicitKey: number = 0
	private _documentState: DocumentState = DocumentState.NEW_STARTED
	private _disallowBlockMapping: number = 0

	public constructor(protected loader: Loader) {
	}

	public parse(data: string, fileName: string): YamlDocument[] {
		this._documentState = DocumentState.NEW_STARTED
		this.linePosition = 0
		this.offset = 0
		this.data = (data.charCodeAt(0) === CharCode.BOM ? data.slice(1) : data)
		this.fileName = fileName
		this.documents = []
		this.parseFile()

		if (this.documents.length === 0) {
			this.documents.push(this.loader.onDocumentEnd(this.loader.onDocumentStart()))
		}

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

	protected parseFile(): any {
		this.peek(1)

		if (this.data.length <= this.offset) {
			return null
		}

		switch (this.data[this.offset]) {
			case "%": return this.directive()
			case "-":
				if (this.data[this.offset + 1] === "-" && this.data[this.offset + 2] === "-") {
					this.offset += 3
					this.peek(1)
					return this.parseDocument()
				}
		}

		if (this._documentState !== DocumentState.PARSING) {
			this.parseDocument()
		} else {
			this.error("New document start or a directive expected near")
		}
	}

	protected parseDocument() {
		this.doc = this.loader.onDocumentStart()
		// this.handlerStack = [this.doc]
		this._documentState = DocumentState.PARSING;

		(this.doc as any).content = this.parseValue(this.doc, 1)

		this.documents.push(this.loader.onDocumentEnd(this.doc))

		this.peek(1)

		if (this.isDocumentSeparator(this.offset)) {
			if ((this._documentState as any) === DocumentState.CLOSED) {
				this._documentState = DocumentState.NEW_STARTED
			}
		}

		this.parseFile()
	}

	protected parseValue(handler: ITypeFactory, minColumn?: number): any {
		switch (this.data.charCodeAt(this.offset)) {
			case CharCode.QUOTE_SINGLE: return this.quotedString(handler, "'")
			case CharCode.QUOTE_DOUBLE: return this.quotedString(handler, "\"")
			case CharCode.LBRACKET: return this.flowSequence(handler)
			case CharCode.LBRACE: return this.flowMapping(handler)
			case CharCode.PIPE: return this.blockScalar(handler, minColumn, false)
			case CharCode.RANGLE: return this.blockScalar(handler, minColumn, true)
			case CharCode.EXCLAMATION: return this.tag(handler)
			case CharCode.AMPERSAND: return this.anchor(handler)
			case CharCode.ASTERIX: return this.alias()
			case CharCode.QUESTION: return this.explicitKey(handler, false)
			case CharCode.DASH:
				if (isWS(this.data.charCodeAt(this.offset + 1))) {
					return this.blockSequence(handler)
				} else {
					if (this.isDocumentSeparator(this.offset)) {
						return handler.onScalar(null)
					}
					return this.scalar(handler)
				}
			case CharCode.DOT:
				if (this.isDocumentSeparator(this.offset)) {
					return handler.onScalar(null)
				}
				return this.scalar(handler)
			case CharCode.AT: return this.error("reserved character '@'")
			case CharCode.BACKTICK: return this.error("reserved character '`'")
			case undefined: return handler.onScalar(null) // EOF
			default: return this.scalar(handler)
		}
	}

	protected isDocumentSeparator(offset: number): boolean {
		let ch = this.data.charCodeAt(offset)

		if ((ch === CharCode.DOT || ch === CharCode.DASH)
			&& this.data.charCodeAt(offset + 1) === ch
			&& this.data.charCodeAt(offset + 2) === ch
			&& isWS(this.data.charCodeAt(offset + 3))) {
			this.offset = offset + 3
			this._documentState = ch === CharCode.DOT ? DocumentState.CLOSED : DocumentState.NEW_STARTED
			return true
		}
		return false
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
					namespace: this.eatNBS() || decodeURIComponent(this._read(TAG_DIRECTIVE_NS))
				})
				break

			default:
				this.loader.onDirective(name, this._read(RX_NB_CHARS))
				break
		}

		this.parseFile()
	}

	protected blockSequence(handler: ITypeFactory): any {
		if (this._inFlowMapping || this._inFlowSequence) {
			this.error("Block sequence is not allowed")
		}

		let col = this.column,
			seq = this.storeAnchor(handler.onSequenceStart()),
			value

		++this.offset

		endless: while (true) {
			// ha sikerült a következő sorba léptetni valami csoda folytán (elvuleg nem kéne)
			// akkor ha kijjebb kezdődik a következő sor, mint az ahol elkezdődött a lista
			// egyértelműen meg kell szakítani.

			switch (this.peek(col)) {
				case PeekResult.DECREASE_INDENT:
					break endless

				case PeekResult.SAME_INDENT:
					if (this.data.charCodeAt(this.offset) === CharCode.DASH) {
						++this.offset
						handler.onSequenceEntry(seq, null)
						continue endless
					}
			}

			value = this.parseValue(this.doc, col)
			if (this._documentState !== DocumentState.PARSING) {
				break endless
			} else {
				handler.onSequenceEntry(seq, value)
			}

			switch (this.peek(col)) {
				case PeekResult.SAME_INDENT:
					if (this.data.charCodeAt(this.offset) === CharCode.DASH) {
						if (this.isDocumentSeparator(this.offset)) {
							break endless
						}
						++this.offset
					} else {
						this.offset -= col // go to last eol
						break endless
					}
					break

				default:
					break endless
			}
		}

		return handler.onSequenceEnd(seq)
	}

	protected flowSequence(handler: ITypeFactory): any {
		let seq = this.storeAnchor(handler.onSequenceStart())

		if (this.data[++this.offset] === "]") { // empty array
			return handler.onSequenceEnd(seq)
		}

		++this._inFlowSequence
		this.peek(1)

		loop: while (true) {
			handler.onSequenceEntry(seq, this.parseValue(this.doc))
			this.peek(1)

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.peek(1)

					if (this.data[this.offset] === "]") {
						++this.offset
						break loop
					}
					break

				case "]":
					++this.offset
					break loop

				default:
					--this._inFlowSequence
					this.unexpected([",", "]"])
					return null
			}
		}

		--this._inFlowSequence
		return handler.onSequenceEnd(seq)
	}

	protected flowMapping(handler: ITypeFactory) {
		let column = this.column,
			mapping = this.storeAnchor(handler.onMappingStart()),
			key

		if (this.data[++this.offset] === "}") { // empty mapping
			return handler.onMappingEnd(mapping)
		}

		++this._inFlowMapping
		this.peek(1)

		while (true) {
			key = this.mappingKey()

			if (this.data[this.offset] === ":") {
				++this.offset
				this.peek(1)
				handler.onMappingKey(mapping, key, this.parseValue(this.doc))
				this.peek(1)
			} else {
				handler.onMappingKey(mapping, key, null)
			}

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.peek(1)

					if (this.data[this.offset] === "}") {
						--this._inFlowMapping
						++this.offset
						return this.isBlockMappingKey()
							? this.blockMapping(handler, column, handler.onMappingEnd(mapping))
							: handler.onMappingEnd(mapping)
					}
					break

				case "}":
					--this._inFlowMapping
					++this.offset
					return this.isBlockMappingKey()
						? this.blockMapping(handler, column, handler.onMappingEnd(mapping))
						: handler.onMappingEnd(mapping)

				default:
					--this._inFlowMapping
					this.unexpected([",", "}"])
					return null
			}
		}
	}

	protected scalar(handler: ITypeFactory) {
		let column = this.column,
			scalar = this.readScalar()

		return this.isBlockMappingKey()
			? this.blockMapping(handler, column, scalar)
			: this.storeAnchor(handler.onScalar(scalar))
	}

	protected quotedString(handler: ITypeFactory, quote: string) {
		let column = this.column,
			str = this.readQuotedString(quote)

		return this.isBlockMappingKey()
			? this.blockMapping(handler, column, str)
			: handler.onQuotedString(str, quote)
	}

	protected isBlockMappingKey() {
		if (this._implicitKey || this._disallowBlockMapping) {
			return false
		}

		while (isNBS(this.data.charCodeAt(this.offset++))); --this.offset;

		if (!this._explicitKey && this.data.charCodeAt(this.offset) === CharCode.COLON) {
			return true
		} else {
			return false
		}
	}

	protected blockMapping(handler: ITypeFactory, column: number, mappingKey: any): any {
		if (this._inFlowMapping) {
			this.error("Block mapping not allowed")
		}

		let mapping = this.storeAnchor(handler.onMappingStart()),
			hasColon

		endless: while (true) {
			if (hasColon = (this.data.charCodeAt(this.offset) === CharCode.COLON)) {
				++this.offset
			} else if (mappingKey === "" || mappingKey === null) {
				break
			}

			switch (this.peek(column)) {
				case PeekResult.SAME_INDENT:
					if (hasColon &&
						this.data.charCodeAt(this.offset) === CharCode.DASH &&
						isWS(this.data.charCodeAt(this.offset + 1))) {

						handler.onMappingKey(mapping, mappingKey, this.parseValue(handler, column))

						if (this.peek(column) !== PeekResult.SAME_INDENT) {
							break endless
						}
					} else {
						handler.onMappingKey(mapping, mappingKey, null)
					}

					if (this._inFlowSequence && !isFlowIndicator(this.data.charCodeAt(this.offset))) {
						this.error("Missed comma between flow collection entries")
					}

					mappingKey = this.mappingKey()

					if (this._documentState !== DocumentState.PARSING) {
						break endless
					}
					continue endless

				case PeekResult.DECREASE_INDENT:
					handler.onMappingKey(mapping, mappingKey, null)
					break

				case PeekResult.INCREASE_INDENT:
				case PeekResult.SAME_LINE:
					handler.onMappingKey(mapping, mappingKey, this.parseValue(this.doc, column + 1))

					if (this.peek(column) === PeekResult.SAME_INDENT) {
						if (this._inFlowSequence && !isFlowIndicator(this.data.charCodeAt(this.offset))) {
							this.error("Missed comma between flow collection entries")
						}

						// http://yaml.org/type/merge.html
						mappingKey = this.mappingKey()
						if (this._documentState !== DocumentState.PARSING) {
							break endless
						}
					} else {
						break endless
					}
					break
			}
		}

		return handler.onMappingEnd(mapping)
	}

	protected mappingKey(): any {
		let key
		switch (this.data.charCodeAt(this.offset)) {
			case CharCode.QUESTION: return this.explicitKey(this.doc, true)
			case CharCode.COLON: return null
			case CharCode.QUOTE_DOUBLE:
				key = this.readQuotedString("\"")
				break

			case CharCode.QUOTE_SINGLE:
				key = this.readQuotedString("\'")
				break

			default:
				++this._implicitKey
				key = this.parseValue(this.doc)
				--this._implicitKey
		}

		while (isNBS(this.data.charCodeAt(this.offset++))); --this.offset;
		return key
	}

	protected explicitKey(handler: ITypeFactory, inMapping: boolean): any {
		let column = this.column

		++this.offset
		this.peek(1)

		++this._explicitKey
		let key = this.parseValue(this.doc)
		--this._explicitKey

		let offset = this.offset

		this.peek(1)

		if (this.data.charCodeAt(this.offset) !== CharCode.COLON) {
			this.offset = offset
		}

		if (inMapping) {
			return key
		} else {
			return this.blockMapping(handler, column, key)
		}
	}

	protected tag(handler: ITypeFactory) {
		let column = this.column,
			handle = this._read(TAG_DIRECTIVE_HANDLE),
			tagHandler, qname

		if (this.data.charCodeAt(this.offset) === CharCode.LANGLE) {
			if (handle !== "!") {
				this.unexpected("URI")
			}
			++this.offset
			qname = decodeURIComponent(this._read(TAG_DIRECTIVE_NS))
			if (this.data.charCodeAt(this.offset) === CharCode.RANGLE) {
				++this.offset
			} else {
				this.unexpected(">")
			}
		} else {
			let name = this._read(TAG_NAME)

			if (!name) {
				// http://www.yaml.org/spec/1.2/spec.html#id2785512
				if (handle === "!") {
					handle = "!!"
					name = "str"
				} else {
					this.error(`Missing tag name`)
				}
			} else {
				name = decodeURIComponent(name)
			}

			qname = `${this.doc.getNamespace(handle)}${name}`
		}

		tagHandler = handler.onTagStart(qname)
		if (!tagHandler) {
			this.error(`The ${handle}${name} tag is unknown.`)
		}

		tagHandler.document = this.doc
		// this.handlerStack.push(tagHandler)

		// mi lenne ha valahogy azt jelezném, hogy a kulcsra kell meghívni a hendlert
		// nem pedig a block mappingra

		let value
		switch (this.peek(1)) {
			case PeekResult.SAME_LINE:
				++this._disallowBlockMapping
				value = handler.onTagEnd(this.parseValue(tagHandler))
				--this._disallowBlockMapping

				return this.isBlockMappingKey()
					? this.blockMapping(this.doc, column, value)
					: value

			default:
				return handler.onTagEnd(this.parseValue(tagHandler))
		}
	}

	protected anchor(handler: ITypeFactory) {
		++this.offset
		this._anchor = this._read(RX_ANCHOR)
		if (!this._anchor) {
			this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
		}
		this.peek(1)
		let result = this.parseValue(handler)
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
		let ch = inspect(this.data[this.offset])
		if (typeof expected === "string") {
			this.error(`Unexpected character: ${ch}${expected ? ` expected: '${expected}'` : ""}`)
		} else {
			this.error(`Unexpected character: ${ch}${expected ? ` expected: '${expected.join("', '")}'` : ""}`)
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
		// while (IS_NBS[data.charCodeAt(this.offset++)]); --this.offset;
		while (true) {
			let c = this.data.charCodeAt(this.offset)
			if (c === CharCode.SPACE || c === CharCode.TAB) {
				++this.offset
			} else {
				return
			}
		}
	}

	private peek(minColumn: number): PeekResult {
		let data = this.data,
			position = this.offset - 1,
			linePosition = null,
			column,
			ch

		while (isNBS(ch = data.charCodeAt(++position)));

		if (CharCode.CR === ch || CharCode.LF === ch || CharCode.HASH === ch) {
			while (true) {
				switch (ch) {
					case CharCode.CR:
						if (data.charCodeAt(position + 1) === CharCode.LF) {
							++position
						}
					case CharCode.LF:
						linePosition = position + 1
						break

					case CharCode.HASH:
						let commentStart = position + 1
						// eat all chars expect linebreaks
						while ((ch = data[++position]) && ch !== "\r" && ch !== "\n");
						ch = data.charCodeAt(position) // backtrack to CR or LF char
						this.loader.onComment(data.slice(commentStart, position).trim())
						continue

					default:
						column = position + 1 - linePosition

						if (minColumn === column) {
							this.linePosition = linePosition
							this.offset = position
							return PeekResult.SAME_INDENT
						} else if (minColumn < column) {
							this.linePosition = linePosition
							this.offset = position
							return PeekResult.INCREASE_INDENT
						} else {
							this.offset = linePosition - 1 // last newline char
							return PeekResult.DECREASE_INDENT
						}
				}

				while (isNBS(ch = data.charCodeAt(++position)));
			}
		} else {
			this.offset = position
			return PeekResult.SAME_LINE
		}
	}

	private __peek(minColumn: number): PeekResult {
		let data = this.data,
			pos = this.offset,
			linePosition = null,
			column

		// 8.43

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
					let commentStart = pos, ch
					// eat all chars expect linebreaks
					while ((ch = data[pos++]) && ch !== "\r" && ch !== "\n");
					--pos // backtrack to CR or LF char
					this.loader.onComment(data.slice(commentStart, pos))
					break

				case CharCode.TAB:
					if (linePosition !== null && !this._inFlowSequence && !this._inFlowMapping) {
						this.error("Document cannot contains tab character as indention character")
					}
					break

				default:
					if (linePosition === null) {
						this.offset = pos - 1
						return PeekResult.SAME_LINE
					} else {
						column = pos - linePosition

						if (minColumn === column) {
							this.linePosition = linePosition
							this.offset = pos - 1
							return PeekResult.SAME_INDENT
						} else if (minColumn < column) {
							this.linePosition = linePosition
							this.offset = pos - 1
							return PeekResult.INCREASE_INDENT
						} else {
							return PeekResult.DECREASE_INDENT
						}
					}
			}
		}
	}

	// protected ___readScalar() {
	// 	let position = this.offset,
	// 		startAt = position,
	// 		data = this.data,
	// 		ch = data.charCodeAt(position)

	// 	endless: while (true) {
	// 		switch (ch) {
	// 			case CharCode.CR:
	// 				if (data.charCodeAt(position + 1) === CharCode.LF) {
	// 					++position
	// 				}
	// 			case CharCode.LF:
	// 				lastNl = position
	// 				continue endless

	// 			case CharCode.HASH:
	// 				if (isWS(data.charCodeAt(position - 1))) {
	// 					endAt = position - 1
	// 					let commentStart = ++position

	// 					do {
	// 						ch = data.charCodeAt(++position)
	// 					} while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
	// 					this.loader.onComment(data.slice(commentStart, position).trim())
	// 					break endless
	// 				} else {
	// 					continue endless
	// 				}

	// 			case CharCode.COLON:
	// 				ch = data.charCodeAt(position + 1)
	// 				// block mapping key
	// 				if (isWS(ch) || ((this._inFlowMapping || this._inFlowSequence) && isFlowIndicator(ch))) {
	// 					// a kulcs közbeni sortörések figyelmen kívül hagyása
	// 					if ((this._explicitKey && !firstCharRule) || this._inFlowMapping) {
	// 						lastNl = null
	// 					}
	// 					break endless
	// 				} else {
	// 					continue endless
	// 				}
	// 		}

	// 		while (isWS(ch = data.charCodeAt(++position)));

	// 		// csak akkor kell ha van sortörés, minden egyéb esetet már a parseValue lekezelt
	// 		// XXX-1
	// 		if (isScalarDisallowedFirstChar(ch)) {
	// 			ch = data.charCodeAt(position + 1)
	// 			if (isIndicator(ch) || isWS(ch)) {
	// 				if (lastNl === null) {
	// 					this.offset = position
	// 					return null
	// 				}
	// 				break endless
	// 			}
	// 		} else if (this.isDocumentSeparator(position)) {
	// 			break endless
	// 		}
	// 		// XXX-1



	// 	}
	// }

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
					if (isWS(data.charCodeAt(position - 1))) {
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
					// block mapping key
					if (isWS(ch) || ((this._inFlowMapping || this._inFlowSequence) && isFlowIndicator(ch))) {
						// a kulcs közbeni sortörések figyelmen kívül hagyása
						if ((this._explicitKey && !firstCharRule) || this._inFlowMapping) {
							lastNl = null
						}
						break endless
					} else {
						continue endless
					}

				default:
					if (firstCharRule) {
						firstCharRule = false

						if (isScalarDisallowedFirstChar(ch)) {
							ch = data.charCodeAt(position + 1)
							if (isIndicator(ch) || isWS(ch)) {
								if (lastNl === null) {
									this.offset = position
									return null
								}
								break endless
							}
						} else if (this.isDocumentSeparator(position)) {
							break endless
						}
					}

					if (startAt === null) {
						startAt = position
					}

					if ((this._inFlowMapping || this._inFlowSequence) && isFlowIndicator(ch)) {
						lastNl = null
						break endless
					}
			}
		} while (ch)

		if (lastNl === null) {
			this.offset = position
		} else {
			this.offset = position = lastNl
		}

		// TODO: remove replace
		data = data.slice(startAt, (endAt === null ? position : endAt)).trim()
			.replace(/[ \t]*\r?\n[ \t]*/g, "\n") // a sortörések normalizálása
			.replace(/([^\n])\n(?!\n)/g, "$1 ") // egy sortörés space-re cserélése
			.replace(/\n(\n+)/g, "$1") // az egynél több sortörések cseréje n-1 sortörésre, ahol n a sortörés száma

		return data === "" ? null : data
	}

	protected blockScalar(handler: ITypeFactory, minColumn: number, isFolded: boolean) {
		if (this._inFlowMapping || this._inFlowSequence) {
			this.error("Block scalar not allowed")
		}

		++this.offset
		let indentStartAtColumn = Infinity,
			data = this.data,
			ch = data.charCodeAt(this.offset),
			chomping: Chomping = Chomping.CLIP

		// TODO: more digit??? pls...
		if (isDigit(ch)) {
			indentStartAtColumn = parseInt(data[this.offset], 10) + 1
			if (indentStartAtColumn <= 0) {
				this.error("Bad explicit indentation width of a block scalar; it cannot be less than 1")
			}
			indentStartAtColumn = Math.max(minColumn, indentStartAtColumn)
			ch = data.charCodeAt(++this.offset)
		}

		if (ch === CharCode.PLUS) {
			chomping = Chomping.KEEP
			++this.offset
		} else if (ch === CharCode.DASH) {
			chomping = Chomping.STRIP
			++this.offset
		}

		while (isNBS(data.charCodeAt(this.offset++))); --this.offset;

		if (data.charCodeAt(this.offset) === CharCode.HASH) {
			let commentStart = this.offset
			do {
				ch = data.charCodeAt(++this.offset)
			} while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
			this.loader.onComment(data.slice(commentStart + 1, this.offset).trim())
		} else {
			// Eat non linebreaks
			while (isNBS(data.charCodeAt(this.offset++))); --this.offset;
		}

		let position = this.offset - 1,
			startAt = position + 1,
			currentColumn = 1,
			lastEolPosition,
			eolSymbols = "",
			result = "",
			lineData,
			inFoldedMoreIndentedBlock

		reader: while (true) {
			peek: while (true) {
				switch (data.charCodeAt(++position)) {
					case CharCode.SPACE:
						if (++currentColumn >= indentStartAtColumn) {
							if (currentColumn === indentStartAtColumn) {
								startAt = position + 1
							}

							if ((chomping === Chomping.STRIP ? isWS : isNBS)(data.charCodeAt(position + 1))) {
								continue peek
							} else {
								break peek
							}
						} else {
							continue peek
						}

					case CharCode.CR:
						if (data.charCodeAt(position + 1) === CharCode.LF) {
							++position
						}

					case CharCode.LF:
						lastEolPosition = position
						startAt = position + 1
						eolSymbols += "\n"
						currentColumn = 1
						break

					case CharCode.DASH:
					case CharCode.DOT:
						if (this.isDocumentSeparator(position)) {
							break reader
						}

					default:
						if (currentColumn < minColumn && result === "") {
							if (lastEolPosition) {
								this.offset = lastEolPosition
								return ""
							} else {
								this.offset = position
								this.unexpected("LINEBREAK")
							}
						}

						if (indentStartAtColumn === Infinity) {
							indentStartAtColumn = currentColumn
							startAt = position
						} else if (currentColumn < indentStartAtColumn) {
							if (data.charCodeAt(position) === CharCode.TAB) {
								this.error("NO TABS")
							}
							break reader
						}

						break peek
				}
			}

			do {
				if (isNaN(ch = data.charCodeAt(++position))) { // EOF
					if (startAt === position || position > this.data.length) {
						break reader
					} else {
						break
					}
				}
			} while (ch !== CharCode.CR && ch !== CharCode.LF)

			lastEolPosition = position
			lineData = data.slice(startAt, position)

			if (result === "") {
				if (eolSymbols.length > 1) {
					result += eolSymbols.slice(1)
				}
			} else if (isFolded) {
				if (inFoldedMoreIndentedBlock) {
					if (!isNBS(lineData.charCodeAt(0))) {
						inFoldedMoreIndentedBlock = false
					}
					result += eolSymbols
				} else if (isNBS(lineData.charCodeAt(0))) {
					inFoldedMoreIndentedBlock = true
					result += eolSymbols
				} else if (eolSymbols.length > 1) {
					result += eolSymbols.slice(1)
				} else {
					result += " "
				}
			} else {
				result += eolSymbols
			}

			result += lineData
			eolSymbols = ""		// reset eol
			--position 			// current position is linebreak or EOF, so decrease it
		}

		if (lastEolPosition !== null) {
			this.offset = lastEolPosition
		} else {
			this.error("Something unexpected")
		}

		switch (chomping) {
			case Chomping.CLIP:
				return handler.onBlockString(eolSymbols !== "" ? `${result}\n` : result)

			case Chomping.STRIP:
				return handler.onBlockString(result)

			case Chomping.KEEP:
				return handler.onBlockString(`${result}${eolSymbols}`)
		}
	}

	protected readQuotedString(terminal: string) {
		let data = this.data,
			offset = this.offset,
			result = "",
			eolCount = 0,
			ch,
			escaped = {}

		endless: while (true) {
			switch (ch = data[++offset]) {
				case "\r":
					if (data[offset + 1] === "\n") {
						++offset
					}
				case "\n":
					if (++eolCount > 1) {
						result += "\n"
					}
					break

				case " ":
				case "\t":
					let spaceStart = offset
					while (isNBS(data.charCodeAt(++offset)));

					if (isEOL(data.charCodeAt(spaceStart - 1))) {	// beginning of a line
						if (isEOL(data.charCodeAt(offset))) {		// empty line
							--offset
							continue endless
						}

						if (!isWS(result.charCodeAt(result.length - 1)) || escaped[result.length - 1]) {
							result += " "
						}
						--offset
						continue endless
					} else { 									// spaces in line
						if (isEOL(data.charCodeAt(offset))) {	// spaces at end of line
							--offset
							continue endless
						} else {
							offset = spaceStart
							result += ch
						}
					}
					break

				case "\\":
					if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
						result += " "
					}
					eolCount = 0

					if (terminal === "\"") {
						let esc = ESCAPE_SEQUENCE[data.charCodeAt(++offset)]
						escaped[result.length] = true
						switch (esc) {
							case EscapeSequenceSpecial.HEX_2:
								result += String.fromCodePoint(
									parseInt(this.data.slice(++offset, (offset += 1) + 1), 16)
								)
								break

							case EscapeSequenceSpecial.HEX_4:
								result += String.fromCodePoint(
									parseInt(this.data.slice(++offset, (offset += 3) + 1), 16)
								)
								break

							case EscapeSequenceSpecial.HEX_8:
								result += String.fromCodePoint(
									parseInt(this.data.slice(++offset, (offset += 7) + 1), 16)
								)
								break

							case EscapeSequenceSpecial.CR:
								if (data.charCodeAt(offset + 1) === CharCode.LF) {
									++offset
								}

							case EscapeSequenceSpecial.LF:
								result += ""
								while (isNBS(data.charCodeAt(++offset))); --offset;

								// Example 7.5. Double Quoted Line Breaks
								if (data.charCodeAt(offset + 1) === CharCode.BACKSLASH
									&& ESCAPE_SEQUENCE[data.charCodeAt(offset + 2)] === EscapeSequenceSpecial.EMPTY) {
									result += data[offset += 2]
								}
								break

							case EscapeSequenceSpecial.EMPTY:
								result += ""
								// while (IS_NBS[data.charCodeAt(++offset)]); --offset;
								break

							case undefined:
								this.error("Unknown escape sequence")

							default:
								result += String.fromCharCode(esc)
						}
					} else {
						result += "\\"
					}
					break

				case terminal:
					if (terminal === "'") {
						if (data[offset + 1] === "'") {
							++offset
							result += "'"
							continue endless
						}
					}

					if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
						result += " "
					}

					++offset
					break endless

				case undefined:
					this.error("Unexpected end of file")
					return null

				default:
					if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
						result += " "
					}
					eolCount = 0
					result += ch
			}
		}

		this.offset = offset
		return result
	}
}