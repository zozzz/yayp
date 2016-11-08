import { inspect } from "util"
import { YamlDocument } from "./document"
import { Loader } from "./loader"
import { ITypeFactory } from "./handler"
import {
    CharCode,
    EscapeSequenceSpecial,
    IS_NBS,
    IS_EOL,
    IS_WS,
    IS_INDICATOR,
    IS_SCALAR_FIRST_CHAR_DECISION,
    IS_FLOW_INDICATOR,
    IS_DIGIT,
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
    protected handlerStack: ITypeFactory[]
    protected linePosition: number

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
        this.linePosition = 0
        this.offset = 0
        this.data = (data.charCodeAt(0) === CharCode.BOM ? data.slice(1) : data)
        this.fileName = fileName
        this.documents = []
        this.handlerStack = []
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

    protected popHandler(): ITypeFactory {
        if (this.handlerStack.length === 1) {
            return this.handlerStack[0]
        } else {
            return this.handlerStack.pop()
        }
    }

    protected parseFile(): any {
        this.peek(1)

        if (this.data.length <= this.offset) {
            return null
        }

        console.log("FFF", inspect(this.data.slice(this.offset)))

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
        this.handlerStack = [this.doc]
        this._documentState = DocumentState.PARSING;

        (this.doc as any).content = this.parseValue(1)

        this.documents.push(this.loader.onDocumentEnd(this.doc))

        this.peek(1)

        if (this.isDocumentSeparator(this.offset)) {
            console.log("DOC SEPARATOR", this._documentState, inspect(this.data.slice(this.offset)))
            if ((this._documentState as any) === DocumentState.CLOSED) {
                this._documentState = DocumentState.NEW_STARTED
            }
        }

        this.parseFile()
    }

    protected parseValue(minColumn?: number): any {
        switch (this.data[this.offset]) {
            case "'": return this.quotedString("'")
            case "\"": return this.quotedString("\"")
            case "[": return this.flowSequence()
            case "{": return this.flowMapping()
            case "|": return this.blockScalar(minColumn, false)
            case ">": return this.blockScalar(minColumn, true)
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
            case "?": return this.explicitKey(false)
            case "-":
                if (IS_WS[this.data.charCodeAt(this.offset + 1)]) {
                    return this.blockSequence()
                } else {
                    if (this.isDocumentSeparator(this.offset)) {
                        return this.popHandler().onScalar(null)
                    }
                    return this.scalar()
                }
            case ".":
                if (this.isDocumentSeparator(this.offset)) {
                    return this.popHandler().onScalar(null)
                }
                return this.scalar()
            case "@": return this.error("reserved character '@'")
            case "`": return this.error("reserved character '`'")
            case undefined: return this.popHandler().onScalar(null) // EOF
            default: return this.scalar()
        }
    }

    protected isDocumentSeparator(offset: number): boolean {
        let ch = this.data.charCodeAt(offset)

        if ((ch === CharCode.DOT || ch === CharCode.DASH)
            && this.data.charCodeAt(offset + 1) === ch
            && this.data.charCodeAt(offset + 2) === ch
            && IS_WS[this.data.charCodeAt(offset + 3)]) {
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

    protected blockSequence(): any {
        if (this._inFlowMapping || this._inFlowSequence) {
            this.error("Block sequence is not allowed")
        }

        let col = this.column,
            handler = this.popHandler(),
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

            value = this.parseValue(col)
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

    protected flowSequence(): any {
        let handler = this.popHandler(),
            seq = this.storeAnchor(handler.onSequenceStart())

        if (this.data[++this.offset] === "]") { // empty array
            return handler.onSequenceEnd(seq)
        }

        ++this._inFlowSequence
        this.peek(1)

        loop: while (true) {
            handler.onSequenceEntry(seq, this.parseValue())
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

    protected flowMapping() {
        let column = this.column,
            handler = this.popHandler(),
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
                handler.onMappingKey(mapping, key, this.parseValue())
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
                            ? this.blockMapping(this.popHandler(), column, handler.onMappingEnd(mapping))
                            : handler.onMappingEnd(mapping)
                    }
                    break

                case "}":
                    --this._inFlowMapping
                    ++this.offset
                    return this.isBlockMappingKey()
                        ? this.blockMapping(this.popHandler(), column, handler.onMappingEnd(mapping))
                        : handler.onMappingEnd(mapping)

                default:
                    --this._inFlowMapping
                    this.unexpected([",", "}"])
                    return null
            }
        }
    }

    protected scalar() {
        let column = this.column,
            handler = this.popHandler(),
            scalar = this.readScalar()

        return this.isBlockMappingKey()
            ? this.blockMapping(handler, column, scalar)
            : this.storeAnchor(handler.onScalar(scalar))
    }

    protected quotedString(quote: string) {
        let column = this.column,
            handler = this.popHandler(),
            str = this.readQuotedString(quote)

        return this.isBlockMappingKey()
            ? this.blockMapping(handler, column, str)
            : handler.onQuotedString(str, quote)
    }

    protected isBlockMappingKey() {
        if (this._implicitKey || this._disallowBlockMapping) {
            return false
        }

        while (IS_NBS[this.data.charCodeAt(this.offset++)]); --this.offset;

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
                        IS_WS[this.data.charCodeAt(this.offset + 1)]) {

                        handler.onMappingKey(mapping, mappingKey, this.parseValue(column))

                        if (this.peek(column) !== PeekResult.SAME_INDENT) {
                            break endless
                        }
                    } else {
                        handler.onMappingKey(mapping, mappingKey, null)
                    }

                    if (this._inFlowSequence && !IS_FLOW_INDICATOR[this.data.charCodeAt(this.offset)]) {
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
                    handler.onMappingKey(mapping, mappingKey, this.parseValue(column + 1))

                    if (this.peek(column) === PeekResult.SAME_INDENT) {
                        if (this._inFlowSequence && !IS_FLOW_INDICATOR[this.data.charCodeAt(this.offset)]) {
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
            case CharCode.QUESTION: return this.explicitKey(true)
            case CharCode.COLON: return null
            case CharCode.QUOTE_DOUBLE:
                key = this.readQuotedString("\"")
                break

            case CharCode.QUOTE_SINGLE:
                key = this.readQuotedString("\'")
                break

            default:
                ++this._implicitKey
                key = this.parseValue()
                --this._implicitKey
        }

        while (IS_NBS[this.data.charCodeAt(this.offset++)]); --this.offset;
        return key
    }

    protected explicitKey(inMapping: boolean): any {
        let column = this.column,
            backupHandler

        if (this.handlerStack.length > 1) {
            backupHandler = this.handlerStack
            this.handlerStack = [this.doc]
        }

        ++this.offset
        this.peek(1)

        ++this._explicitKey
        let key = this.parseValue()
        --this._explicitKey

        if (backupHandler) {
            this.handlerStack = backupHandler
        }

        let offset = this.offset

        this.peek(1)

        if (this.data.charCodeAt(this.offset) !== CharCode.COLON) {
            this.offset = offset
        }

        if (inMapping) {
            return key
        } else {
            return this.blockMapping(this.popHandler(), column, key)
        }
    }

    protected tag() {
        let column = this.column,
            handle = this._read(TAG_DIRECTIVE_HANDLE),
            handler, tagHandler, qname

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

            handler = this.popHandler()
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

        handler = this.popHandler()
        tagHandler = handler.onTagStart(qname)
        if (!tagHandler) {
            this.error(`The ${handle}${name} tag is unknown.`)
        }

        tagHandler.document = this.doc
        this.handlerStack.push(tagHandler)

        // mi lenne ha valahogy azt jelezném, hogy a kulcsra kell meghívni a hendlert
        // nem pedig a block mappingra

        let value
        switch (this.peek(1)) {
            case PeekResult.SAME_LINE:
                ++this._disallowBlockMapping
                value = handler.onTagEnd(this.parseValue())
                --this._disallowBlockMapping

                tagHandler.document = null

                return this.isBlockMappingKey()
                    ? this.blockMapping(this.popHandler(), column, value)
                    : value

            default:
                tagHandler.document = null
                return handler.onTagEnd(this.parseValue())
        }
    }

    protected anchor() {
        ++this.offset
        this._anchor = this._read(RX_ANCHOR)
        if (!this._anchor) {
            this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'")
        }
        this.peek(1)
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



    // át kell alakítani, hogy a PeekResult értékekkel térjen vissza
    private peek(minColumn: number): PeekResult {
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
                    if (linePosition !== null && !this._inFlowSequence && !this._inFlowMapping) {
                        this.error("Document cannot contains tab character as indention character")
                    }
                    break

                case undefined:
                    return PeekResult.DECREASE_INDENT

                default:
                    if (linePosition !== null) {
                        let column = pos - linePosition

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
                    } else {
                        this.offset = pos - 1
                        return PeekResult.SAME_LINE
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
                    // block mapping key
                    if (IS_WS[ch] || ((this._inFlowMapping || this._inFlowSequence) && IS_FLOW_INDICATOR[ch])) {
                        // a kulcs közbeni sortörések figyelmen kívül hagyása
                        if (this._explicitKey && !firstCharRule) {
                            lastNl = null
                        }
                        break endless
                    } else {
                        continue endless
                    }

                default:
                    if (firstCharRule) {
                        firstCharRule = false

                        if (IS_SCALAR_FIRST_CHAR_DECISION[ch]) {
                            ch = data.charCodeAt(position + 1)
                            if (IS_INDICATOR[ch] || IS_WS[ch]) {
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

                    if ((this._inFlowMapping || this._inFlowSequence) && IS_FLOW_INDICATOR[ch]) {
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

        data = data.slice(startAt, (endAt === null ? position : endAt)).trim()
            .replace(/[ \t]*\r?\n[ \t]*/g, "\n") // a sortörések normalizálása
            .replace(/([^\n])\n(?!\n)/g, "$1 ") // egy sortörés space-re cserélése
            .replace(/\n(\n+)/g, "$1") // az egynél több sortörések cseréje n-1 sortörésre, ahol n a sortörés száma

        return data === "" ? null : data
    }

    protected blockScalar(minColumn: number, isFolded: boolean) {
        if (this._inFlowMapping || this._inFlowSequence) {
            this.error("Block scalar not allowed")
        }

        ++this.offset
        let indentStartAtColumn = Infinity,
            data = this.data,
            ch = data.charCodeAt(this.offset),
            chomping: Chomping = Chomping.CLIP

        // TODO: more digit??? pls...
        if (IS_DIGIT[ch]) {
            indentStartAtColumn = parseInt(data[this.offset], 10)
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

        while (IS_NBS[data.charCodeAt(this.offset++)]); --this.offset;

        if (data.charCodeAt(this.offset) === CharCode.HASH) {
            let commentStart = this.offset
            do {
                ch = data.charCodeAt(++this.offset)
            } while (ch && ch !== CharCode.CR && ch !== CharCode.LF)
            this.loader.onComment(data.slice(commentStart + 1, this.offset).trim())
        } else {
            // Eat non linebreaks
            while (IS_NBS[data.charCodeAt(this.offset++)]); --this.offset;
        }

        let position = this.offset - 1,
            startAt = position + 1,
            currentColumn = 0,
            lastEolPosition,
            eolSymbols = "",
            result = "",
            lineData,
            inFoldedMoreIndentedBlock

        console.log("KKK", inspect(this.data.slice(this.offset)))

        reader: while (true) {
            peek: while (true) {
                switch (data.charCodeAt(++position)) {
                    case CharCode.SPACE:
                        if (++currentColumn >= indentStartAtColumn) {
                            if (currentColumn === indentStartAtColumn) {
                                startAt = position + 1
                            }

                            if ((chomping === Chomping.STRIP ? IS_WS : IS_NBS)[data.charCodeAt(position + 1)]) {
                                continue peek
                            } else {
                                break peek
                            }
                        } else {
                            continue peek
                        }

                    case CharCode.CR:
                        lastEolPosition = position
                        eolSymbols += "\n"
                        currentColumn = 0
                        if (data.charCodeAt(position + 1) === CharCode.LF) {
                            ++position
                        }
                        break

                    case CharCode.LF:
                        lastEolPosition = position
                        eolSymbols += "\n"
                        currentColumn = 0
                        break

                    case CharCode.TAB:
                        if (indentStartAtColumn === Infinity && currentColumn >= minColumn) {
                            indentStartAtColumn = currentColumn
                            startAt = position
                            break peek
                        } else if (currentColumn < indentStartAtColumn) {
                            // tab indent character is not allowed.
                            // TODO: proper error msg
                            this.error("NO TABS")
                        }
                        break

                    default:
                        console.log({ indentStartAtColumn, currentColumn, minColumn }, inspect(this.data.slice(position)))

                        if (currentColumn === 0 && result === "") {
                            if (lastEolPosition) {
                                if (minColumn === 1) {
                                    indentStartAtColumn = currentColumn
                                    startAt = position
                                    break peek
                                } else {
                                    this.offset = lastEolPosition
                                    return ""
                                }
                            } else {
                                this.unexpected("LINEBREAK")
                            }
                        }

                        if (indentStartAtColumn === Infinity) {
                            indentStartAtColumn = currentColumn
                            startAt = position
                        } else if (currentColumn < indentStartAtColumn) {
                            break reader
                        }

                        break peek
                }
            }

            do { ch = data.charCodeAt(++position) } while (ch && ch !== CharCode.CR && ch !== CharCode.LF);

            lastEolPosition = position
            lineData = data.slice(startAt, position)

            if (result === "") {
                if (eolSymbols.length > 1) {
                    result += eolSymbols.slice(1)
                }
            } else if (isFolded) {
                if (inFoldedMoreIndentedBlock) {
                    if (!IS_NBS[lineData.charCodeAt(0)]) {
                        inFoldedMoreIndentedBlock = false
                    }
                    result += eolSymbols
                } else if (IS_NBS[lineData.charCodeAt(0)]) {
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

            if (isNaN(ch)) {
                break
            }

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
                return this.popHandler().onBlockString(eolSymbols !== "" ? `${result}\n` : result)

            case Chomping.STRIP:
                return this.popHandler().onBlockString(result)

            case Chomping.KEEP:
                return this.popHandler().onBlockString(`${result}${eolSymbols}`)
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
                    while (IS_NBS[data.charCodeAt(++offset)]);

                    if (IS_EOL[data.charCodeAt(spaceStart - 1)]) {	// beginning of a line
                        if (IS_EOL[data.charCodeAt(offset)]) {		// empty line
                            --offset
                            continue endless
                        }

                        if (!IS_WS[result.charCodeAt(result.length - 1)] || escaped[result.length - 1]) {
                            result += " "
                        }
                        --offset
                        continue endless
                    } else { 									// spaces in line
                        if (IS_EOL[data.charCodeAt(offset)]) {	// spaces at end of line
                            --offset
                            continue endless
                        } else {
                            offset = spaceStart
                            result += ch
                        }
                    }
                    break

                case "\\":
                    if (eolCount === 1 && !IS_WS[result.charCodeAt(result.length - 1)]) {
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
                                while (IS_NBS[data.charCodeAt(++offset)]); --offset;

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

                    if (eolCount === 1 && !IS_WS[result.charCodeAt(result.length - 1)]) {
                        result += " "
                    }

                    ++offset
                    break endless

                case undefined:
                    this.error("Unexpected end of file")
                    return null

                default:
                    if (eolCount === 1 && !IS_WS[result.charCodeAt(result.length - 1)]) {
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