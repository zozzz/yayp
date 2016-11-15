import { inspect } from "util"
import { YamlDocument } from "./document"
import { Loader } from "./loader"
import { ITypeFactory } from "./handler"
import {
	CharCode,
	EscapeSequenceSpecial,

	isNBS,
	isWS,
	isWSorEOF,
	isEOL,
	isPeekEOL,
	// isScalarDisallowedFirstChar,
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
}


const enum DocumentState {
	// még nem érte el a végét
	PARSING = 0,
	// új kezdődőtt, de arégi nem lett lezárva
	NEW_STARTED = 1,
	// a jelenlegi a ... -al le lett zárva
	CLOSED = 2
}


export const enum State {
	ONLY_COMPACT_MAPPING = 1 << 0,
	IN_EXPLICIT_KEY = 1 << 1,
	IN_IMPLICIT_KEY = 1 << 2,
	IN_FLOW_SEQ = 1 << 3,
	IN_FLOW_MAP = 1 << 4,
	IN_BLOCK_MAP = 1 << 5,
	IN_BLOCK_SEQ = 1 << 6,

	IN_NODE = State.IN_EXPLICIT_KEY | State.IN_IMPLICIT_KEY | State.IN_FLOW_SEQ | State.IN_FLOW_MAP | State.IN_BLOCK_MAP | State.IN_BLOCK_SEQ,
	IN_FLOW = State.IN_FLOW_SEQ | State.IN_FLOW_MAP,
	NO_BLOCK_MAPPING = State.IN_IMPLICIT_KEY | State.IN_FLOW_MAP,
	MAPPING_KEY = State.IN_IMPLICIT_KEY | State.IN_EXPLICIT_KEY,
	ALLOW_NL_IN_KEY = State.IN_EXPLICIT_KEY | State.IN_FLOW_MAP
}


export class Parser {
	public fileName: string

	protected offset: number
	protected data: string
	protected documents: YamlDocument[]
	protected doc: YamlDocument
	protected linePosition: number
	// protected column: number

	// private _inFlowSequence: number = 0
	// private _inFlowMapping: number = 0
	private _anchor: { anchor: string, offset: number }
	// private _explicitKey: number = 0
	// private _implicitKey: number = 0
	private _documentState: DocumentState = DocumentState.NEW_STARTED
	// private _onlyCompactBlockMapping: number = 0

	public constructor(protected loader: Loader) {
	}

	public parse(data: string, fileName: string): YamlDocument[] {
		this._documentState = DocumentState.NEW_STARTED
		this.linePosition = 0
		this.offset = 0
		this.data = (data.charCodeAt(0) === CharCode.BOM ? data.slice(1) : data)
		this.fileName = fileName
		this.documents = []

		this.peek(1)
		// empty file
		if (this.data.length <= this.offset) {
			this.documents.push(this.loader.onDocumentEnd(this.loader.onDocumentStart()))
		} else {
			while (this.parseFile());
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
		this.directive()

		if (this.data.charCodeAt(this.offset) === CharCode.DASH && this.isDocumentStart(this.offset)) {
			this.peek(1)
		}

		return this.parseDocument()
	}

	protected parseDocument() {
		this.doc = this.loader.onDocumentStart()
		this._documentState = DocumentState.PARSING;

		(this.doc as any).content = this.parseValue(this.doc, 0, 1)

		this.peek(1)

		if (this.data.length <= this.offset) {
			this.documents.push(this.loader.onDocumentEnd(this.doc))
		} else if (this._documentState !== DocumentState.PARSING) {
			this.documents.push(this.loader.onDocumentEnd(this.doc))
			return true
		} else if (this.isDocumentSeparator(this.offset)) {
			this.peek(1)

			if ((this._documentState as any) === DocumentState.CLOSED) {
				this.documents.push(this.loader.onDocumentEnd(this.doc))
				return true
			} else if (this._documentState !== DocumentState.PARSING) {
				this.documents.push(this.loader.onDocumentEnd(this.doc))
				return true
			} else {
				this.error("New document start or a directive expected near")
			}
		}

		return false
	}

	protected parseValue(handler: ITypeFactory, state: State, minColumn?: number): any {
		switch (this.data.charCodeAt(this.offset)) {
			case CharCode.QUOTE_SINGLE: return this.quotedString(handler, state, "'")
			case CharCode.QUOTE_DOUBLE: return this.quotedString(handler, state, "\"")
			case CharCode.LBRACKET: return this.flowSequence(handler, state)
			case CharCode.LBRACE: return this.flowMapping(handler, state)
			case CharCode.PIPE: return this.blockScalar(handler, state, minColumn, false)
			case CharCode.RANGLE: return this.blockScalar(handler, state, minColumn, true)
			case CharCode.EXCLAMATION: return this.tag(handler, state)
			case CharCode.AMPERSAND: return this.anchor(handler, state)
			case CharCode.ASTERIX: return this.alias()
			case CharCode.QUESTION: return this.explicitKey(handler, state)
			case CharCode.DASH:
				if (isWS(this.data.charCodeAt(this.offset + 1))) {
					return this.blockSequence(handler, state)
				} else {
					if (this.isDocumentStart(this.offset)) {
						return handler.onScalar(this.offset, null)
					}
					return this.scalar(handler, state)
				}
			case CharCode.DOT:
				if (this.isDocumentEnd(this.offset)) {
					return handler.onScalar(this.offset, null)
				}
				return this.scalar(handler, state)
			// case CharCode.AT: return this.error("reserved character '@'")
			// case CharCode.BACKTICK: return this.error("reserved character '`'")
			// case undefined: return handler.onScalar(null) // EOF
			default: return this.scalar(handler, state)
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
		} else if (ch === CharCode.PERCENT) {
			this._documentState = DocumentState.NEW_STARTED
			return true
		}
		return false
	}

	protected isDocumentStart(offset: number) {
		if (this.data.charCodeAt(offset + 1) === CharCode.DASH
			&& this.data.charCodeAt(offset + 2) === CharCode.DASH
			&& isWS(this.data.charCodeAt(offset + 3))) {
			this.offset = offset + 3
			this._documentState = DocumentState.NEW_STARTED
			return true
		}
		return false
	}

	protected isDocumentEnd(offset: number) {
		if (this.data.charCodeAt(offset + 1) === CharCode.DOT
			&& this.data.charCodeAt(offset + 2) === CharCode.DOT
			&& isWS(this.data.charCodeAt(offset + 3))) {
			this.offset = offset + 3
			this._documentState = DocumentState.CLOSED
			return true
		}
		return false
	}

	protected directive() {
		for (; ;) {
			if (this.data.charCodeAt(this.offset) === CharCode.PERCENT) {
				++this.offset

				let name = this._read(RX_NS_CHARS)
				if (!name) {
					return this.unexpected()
				}

				if (this.peek(1) !== PeekResult.SAME_LINE) {
					this.error("Missing directive value")
				}

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

				if (this.peek(1) === PeekResult.SAME_INDENT) {
					continue
				} else {
					break
				}
			} else {
				break
			}
		}
	}

	protected blockSequence(handler: ITypeFactory, state: State): any {
		if (state & State.IN_FLOW) {
			this.error("Block sequence is not allowed")
		}

		let col = this.column,
			seq = this.storeAnchor(handler.onSequenceStart(this.offset)),
			substate = state | State.IN_BLOCK_SEQ,
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
						handler.onSequenceEntry(this.offset - 1, seq, null)
						continue endless
					}
			}

			handler.onSequenceEntry(this.offset, seq, this.parseValue(this.doc, substate, col))
			// console.log("SEQ", value, require("util").inspect(this.data.substr(this.offset, 10)))
			if (this._documentState !== DocumentState.PARSING) {
				break endless
			}

			switch (this.peek(col)) {
				case PeekResult.SAME_INDENT:
					if (this.data.charCodeAt(this.offset) === CharCode.DASH) {
						if (this.isDocumentStart(this.offset)) {
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

	protected flowSequence(handler: ITypeFactory, state: State): any {
		let seq = this.storeAnchor(handler.onSequenceStart(this.offset)),
			substate = (state | State.IN_FLOW_SEQ | State.ONLY_COMPACT_MAPPING) & ~State.IN_IMPLICIT_KEY

		if (this.data.charCodeAt(++this.offset) === CharCode.RBRACKET) { // empty array
			++this.offset
			return handler.onSequenceEnd(seq)
		}

		this.peek(1)

		loop: while (true) {
			handler.onSequenceEntry(this.offset, seq, this.parseValue(this.doc, substate))
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
					this.unexpected([",", "]"])
					return null
			}
		}

		return handler.onSequenceEnd(seq)
	}

	protected flowMapping(handler: ITypeFactory, state: State) {
		let column = this.column,
			offset,
			mapping = this.storeAnchor(handler.onMappingStart(this.offset)),
			key,
			substate = (state | State.IN_FLOW_MAP) & ~State.IN_IMPLICIT_KEY

		if (this.data.charCodeAt(++this.offset) === CharCode.RBRACE) { // empty mapping
			++this.offset
			return handler.onMappingEnd(mapping)
		}

		this.peek(1)

		while (true) {
			offset = this.offset
			key = this.mappingKey(substate)

			if (this.data[this.offset] === ":") {
				++this.offset
				this.peek(1)
				handler.onMappingKey(offset, mapping, key, this.parseValue(this.doc, substate))
				this.peek(1)
			} else {
				handler.onMappingKey(offset, mapping, key, null)
			}

			switch (this.data[this.offset]) {
				case ",":
					++this.offset
					this.peek(1)

					if (this.data[this.offset] === "}") {
						++this.offset
						return handler.onMappingEnd(mapping)
					}
					break

				case "}":
					++this.offset

					if (state & State.NO_BLOCK_MAPPING) {
						return handler.onMappingEnd(mapping)
					} else {
						return this.isBlockMappingKey(state)
							? this.blockMapping(this.offset, handler, state, column, handler.onMappingEnd(mapping))
							: handler.onMappingEnd(mapping)
					}
				default:
					this.unexpected([",", "}"])
					return null
			}
		}
	}

	protected scalar(handler: ITypeFactory, state: State) {
		if (state & State.NO_BLOCK_MAPPING) {
			// TODO: utánajárni lehet-e anchor egy implicit mapping key-en
			return this.storeAnchor(handler.onScalar(this.offset, this.readScalar(state)))
		} else {
			let column = this.column,
				offset = this.offset,
				scalar = this.readScalar(state)

			return this.isBlockMappingKey(state)
				? this.blockMapping(offset, handler, state, column, scalar)
				: this.storeAnchor(handler.onScalar(offset, scalar))
		}

	}

	protected quotedString(handler: ITypeFactory, state: State, quote: string) {
		if (state & State.NO_BLOCK_MAPPING) {
			return this.storeAnchor(handler.onQuotedString(this.offset, this.readQuotedString(quote), quote))
		} else {
			let column = this.column,
				offset = this.offset,
				str = this.readQuotedString(quote)

			return this.isBlockMappingKey(state)
				? this.blockMapping(offset, handler, state, column, str)
				: handler.onQuotedString(offset, str, quote)
		}

	}

	protected isBlockMappingKey(state: State) {
		while (isNBS(this.data.charCodeAt(this.offset++))); --this.offset;
		if (this.data.charCodeAt(this.offset) === CharCode.COLON) {
			if (state & State.ONLY_COMPACT_MAPPING) {
				let bt = this.offset
				while (isNBS(this.data.charCodeAt(++this.offset)));
				if (isEOL(this.data.charCodeAt(this.offset))) {
					this.offset = bt
					return false
				} else {
					this.offset = bt
					return true
				}
			} else {
				return true
			}
		}
	}

	protected blockMapping(offset: number, handler: ITypeFactory, state: State, column: number, mappingKey: any): any {
		let mapping = this.storeAnchor(handler.onMappingStart(this.offset)),
			substate = state | State.IN_BLOCK_MAP,
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

						handler.onMappingKey(offset, mapping, mappingKey, this.parseValue(handler, substate, column))

						if (this.peek(column) !== PeekResult.SAME_INDENT) {
							break endless
						}
					} else {
						handler.onMappingKey(offset, mapping, mappingKey, null)
					}

					if (state & State.ONLY_COMPACT_MAPPING) {
						break endless
					}

					offset = this.offset
					mappingKey = this.mappingKey(state)

					if (this._documentState !== DocumentState.PARSING) {
						break endless
					}
					continue endless

				case PeekResult.DECREASE_INDENT:
					if (state & State.ONLY_COMPACT_MAPPING) {
						--this.offset
						break endless
					}
					handler.onMappingKey(offset, mapping, mappingKey, null)
					break

				case PeekResult.INCREASE_INDENT:
				case PeekResult.SAME_LINE:
					handler.onMappingKey(offset, mapping, mappingKey, this.parseValue(this.doc, substate, column + 1))

					if ((state & State.ONLY_COMPACT_MAPPING) || this._documentState !== DocumentState.PARSING) {
						break endless
					}

					if (this.peek(column) === PeekResult.SAME_INDENT) {
						// http://yaml.org/type/merge.html
						offset = this.offset
						mappingKey = this.mappingKey(state)
					} else {
						break endless
					}
					break
			}
		}

		return handler.onMappingEnd(mapping)
	}

	protected mappingKey(state: State): any {
		if (this.data.charCodeAt(this.offset) === CharCode.COLON) {
			return null
		} else {
			let key = this.parseValue(this.doc, state | State.IN_IMPLICIT_KEY)
			while (isNBS(this.data.charCodeAt(this.offset++))); --this.offset;
			return key
		}
	}

	protected explicitKey(handler: ITypeFactory, state: State): any {
		let keyOffset = this.offset,
			column = this.column

		++this.offset
		this.peek(1)

		let key = this.parseValue(this.doc, state | State.ONLY_COMPACT_MAPPING | State.IN_EXPLICIT_KEY)
		let offset = this.offset

		this.peek(1)

		if (this.data.charCodeAt(this.offset) !== CharCode.COLON) {
			this.offset = offset
		}

		if (state & State.NO_BLOCK_MAPPING) {
			return key
		} else {
			return this.blockMapping(keyOffset, handler, state, column, key)
		}
	}

	protected tag(handler: ITypeFactory, state: State) {
		let column = this.column,
			offset = this.offset,
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

		tagHandler = handler.onTagStart(offset, qname)
		if (!tagHandler) {
			this.error(`The !<${qname}> tag is unknown.`)
		}

		tagHandler.document = this.doc
		// this.handlerStack.push(tagHandler)

		// mi lenne ha valahogy azt jelezném, hogy a kulcsra kell meghívni a hendlert
		// nem pedig a block mappingra

		let value
		switch (this.peek(1)) {
			case PeekResult.SAME_LINE:
				offset = this.offset
				value = handler.onTagEnd(this.parseValue(tagHandler,
					state & State.IN_NODE
						? state | State.ONLY_COMPACT_MAPPING
						: state | State.ONLY_COMPACT_MAPPING | State.IN_IMPLICIT_KEY))

				if ((state & State.NO_BLOCK_MAPPING) || !this.isBlockMappingKey(state)) {
					return value
				} else {
					return this.blockMapping(offset, this.doc, state, column, value)
				}
			default:
				return handler.onTagEnd(this.parseValue(tagHandler, state & ~State.ONLY_COMPACT_MAPPING))
		}
	}

	// csak 1 anchor lehet, ha van még1 anchor mielőtt fel lenne használva az előző az hiba
	// TODO: refactor úgy hogy egy NachorHandler használjon, amit csak akkor példányosítson, amikor először szükséges
	protected anchor(handler: ITypeFactory, state: State) {
		++this.offset
		let anchor = this._read(RX_ANCHOR)
		if (!anchor) {
			this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
		}
		this._anchor = { anchor, offset: this.offset - 1 }
		this.peek(1)
		let result = this.parseValue(handler, state)
		return this.storeAnchor(result)
	}

	protected storeAnchor(value: any): any {
		if (this._anchor) {
			let id = this._anchor.anchor,
				offset = this._anchor.offset
			this._anchor = null
			this.doc.onAnchor(offset, id, value)
		}
		return value
	}

	protected alias(): any {
		let offset = this.offset++,
			id = this._read(RX_ANCHOR)
		if (!id) {
			this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
		}
		return this.doc.onAlias(offset, id)
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
		this.loader.onError(message, this.getLocation(offset))
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

	// TODO: kipróbálni, hogy ha ahol nincs szükség a visszatérési értékre
	// ott a minColumn 0 és abban az esetben nem számolja ki
	// hogy mi történt az identálással, az segíti-e a sebességet
	private peek(minColumn: number): PeekResult {
		let data = this.data,
			position = this.offset - 1,
			linePosition

		while (true) {
			switch (data.charCodeAt(++position)) {
				case CharCode.SPACE:
				case CharCode.TAB:
					continue

				case CharCode.CR:
				case CharCode.LF:
				case CharCode.HASH:
					--position
					while (true) {
						switch (data.charCodeAt(++position)) {
							case CharCode.SPACE:
							case CharCode.TAB:
								continue

							case CharCode.CR:
								if (data.charCodeAt(position + 1) === CharCode.LF) {
									++position
								}
							case CharCode.LF:
								linePosition = position + 1
								continue

							case CharCode.HASH:
								let commentStart = position + 1, ch
								// eat all chars expect linebreaks
								while ((ch = data.charCodeAt(++position)) && !isEOL(ch));
								--position
								this.loader.onComment(data.slice(commentStart, position).trim())
								continue

							default:
								let column = position + 1 - linePosition

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
					}

				default:
					this.offset = position
					return PeekResult.SAME_LINE
			}
		}
	}


	protected readScalar(state: State) {
		let data = this.data,
			position = this.offset - 1,
			startAt = this.offset,
			// endAt = startAt,
			eol = "",
			pendingEol,
			result = "",
			backtrack,
			end = false

		// console.log("RS", require("util").inspect(data.substr(this.offset, 10)))

		for (; ;) {
			peek: for (; ;) {
				switch (data.charCodeAt(++position) || undefined) {
					case CharCode.SPACE:
					case CharCode.TAB:
						continue peek

					case CharCode.CR:
						if (data.charCodeAt(position + 1) === CharCode.LF) {
							++position
						}
					case CharCode.LF:
						backtrack = position
						eol += "\n"
						break peek

					case CharCode.COLON:
						let ch
						if (isWSorEOF(ch = data.charCodeAt(position + 1))
							|| ((state & State.IN_FLOW) && isFlowIndicator(ch))) {

							if (!pendingEol || (state & State.ALLOW_NL_IN_KEY)) {
								backtrack = position
							} else {
								this.offset = backtrack
								return result === "" ? null : result
							}

							end = true
							break peek
						}
						continue peek

					case CharCode.COMMA:
					case CharCode.RBRACE:
					case CharCode.RBRACKET:
						if (state & State.IN_FLOW) {
							backtrack = position
							end = true
							break peek
						}

					case CharCode.HASH:
						if (isWS(data.charCodeAt(position - 1))) {
							backtrack = position
							end = true
							break peek
						} else {
							continue peek
						}

					case undefined:
						backtrack = position
						break peek
				}
			}

			if (pendingEol) {
				result += pendingEol
				pendingEol = null
			}

			while (isWS(data.charCodeAt(--position))); // right trim line

			// console.log({ startAt, position, end, backtrack })
			// console.log("LD", require("util").inspect(data.slice(startAt, position + 1)))

			result += data.slice(startAt, position + 1)

			if (end) {
				this.offset = backtrack
				// console.log({ result })
				// console.log("BT", require("util").inspect(data.substr(backtrack, 10)))
				return result === "" ? null : result
			} else {
				position = backtrack

				// console.log("BW", require("util").inspect(data.substr(position, 10)))

				ws: for (; ;) {
					switch (data.charCodeAt(++position) || undefined) {
						case CharCode.SPACE:
						case CharCode.TAB:
							continue ws

						case CharCode.CR:
							if (data.charCodeAt(position + 1) === CharCode.LF) {
								++position
							}
						case CharCode.LF:
							eol += "\n"
							continue ws

						case undefined: // EOF
							this.offset = position
							return result === "" ? null : result

						default:
							// console.log("DDD", data.charCodeAt(position))
							startAt = position
							break ws
					}
				}

				// console.log("AW", require("util").inspect(data.substr(position, 10)))

				let ch
				switch (ch = data.charCodeAt(position)) {
					case CharCode.DASH:
					case CharCode.QUESTION:
					case CharCode.COLON:
						if (isWSorEOF(data.charCodeAt(position + 1)) || isIndicator(ch)) {
							// console.log("CCCCCCC", require("util").inspect(this.data.substr(backtrack, 10)))
							this.offset = backtrack
							return result === "" ? null : result
						}
						break

					case CharCode.DOT:
						if (eol !== "" && this.isDocumentEnd(position)) {
							return result === "" ? null : result
						}
						break

					case CharCode.HASH:
						if (isWS(data.charCodeAt(position - 1))) {
							this.offset = backtrack
							return result === "" ? null : result
						}
						break

					case CharCode.COMMA:
					case CharCode.RBRACE:
					case CharCode.RBRACKET:
						if (state & State.IN_FLOW) {
							this.offset = position
							return result === "" ? null : result
						}
						break
				}

				if (eol !== "") {
					pendingEol = (eol === "\n" ? " " : eol.slice(1))
					eol = ""
				}
			}
		}
	}


	protected blockScalar(handler: ITypeFactory, state: State, minColumn: number, isFolded: boolean) {
		if (state & State.IN_FLOW) {
			this.error("Block scalar not allowed")
		}

		let offset = this.offset++,
			indentStartAtColumn = Infinity,
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
				return handler.onBlockString(offset, eolSymbols !== "" ? `${result}\n` : result)

			case Chomping.STRIP:
				return handler.onBlockString(offset, result)

			case Chomping.KEEP:
				return handler.onBlockString(offset, `${result}${eolSymbols}`)
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