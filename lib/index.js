'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.loadFile = exports.load = exports.SCHEMA_V12 = exports.SCHEMA_V11 = exports.SCHEMA_JSON = exports.SCHEMA_COMMON = exports.SCHEMA_FAILSAFE = exports.SchemaCollection = exports.ScalarResolverSet = exports.ScalarResolverAsType = exports.ScalarRegexMatch = exports.ScalarValueMap = exports.ScalarResolver = exports.TypeFactory = exports.Schema = exports.YamlDocument = exports.YamlError = exports.Loader = exports.Parser = undefined;

var _util = require('util');

var _fs = require('fs');

const RX_NS_CHARS = new RegExp(`[^\uFEFF\r\n\t ]+`, "g");
const RX_NB_CHARS = new RegExp(`[^\r\n]+`, "g");
const YAML_DIRECTIVE_VALUE = new RegExp(`\\d+\\.\\d+`, "g");
const TAG_DIRECTIVE_HANDLE = /!([0-9A-Za-z]*!)?/g;
const TAG_DIRECTIVE_NS = /(?:[0-9A-Za-z\-\#\;\/\?\:\@\&\=\+\$\,\_\.\!\~\*\'\(\)\[\]]|(?:\%[a-fA-F0-9]{2}))+/g;
const TAG_NAME = /(?:[0-9A-Za-z\-\#\;\/\?\:\@\&\=\+\$\_\.\~\*\'\(\)]|(?:\%[a-fA-F0-9]{2}))+/g;
const RX_ANCHOR = /[^ \t\r\n\[\]\{\}\,]+/g;
function isNBS(ch) {
    return 32 /* SPACE */ === ch || 9 /* TAB */ === ch || 160 /* UNICODE_SPACE */ === ch;
}
function isEOL(ch) {
    return 13 /* CR */ === ch || 10 /* LF */ === ch;
}

function isWS(ch) {
    return 32 /* SPACE */ === ch || 9 /* TAB */ === ch || 13 /* CR */ === ch || 10 /* LF */ === ch || 160 /* UNICODE_SPACE */ === ch;
}
function isWSorEOF(ch) {
    return 32 /* SPACE */ === ch || 9 /* TAB */ === ch || 13 /* CR */ === ch || 10 /* LF */ === ch || 160 /* UNICODE_SPACE */ === ch || !ch;
}
// export function isScalarDisallowedFirstChar(ch: number): boolean {
// 	return CharCode.DASH === ch
// 		|| CharCode.QUESTION === ch
// 		|| CharCode.COMMA === ch
// }
function isIndicator(ch) {
    return 45 /* DASH */ === ch || 63 /* QUESTION */ === ch || 58 /* COLON */ === ch || 44 /* COMMA */ === ch || 91 /* LBRACKET */ === ch || 93 /* RBRACKET */ === ch || 123 /* LBRACE */ === ch || 125 /* RBRACE */ === ch || 35 /* HASH */ === ch || 38 /* AMPERSAND */ === ch || 42 /* ASTERIX */ === ch || 33 /* EXCLAMATION */ === ch || 124 /* PIPE */ === ch || 62 /* RANGLE */ === ch || 60 /* LANGLE */ === ch || 39 /* QUOTE_SINGLE */ === ch || 34 /* QUOTE_DOUBLE */ === ch || 37 /* PERCENT */ === ch || 64 /* AT */ === ch || 96 /* BACKTICK */ === ch;
}
function isFlowIndicator(ch) {
    return 44 /* COMMA */ === ch || 91 /* LBRACKET */ === ch || 93 /* RBRACKET */ === ch || 123 /* LBRACE */ === ch || 125 /* RBRACE */ === ch;
}
function isDigit(ch) {
    return ch > 0x2F && ch < 0x3A;
}
const ESCAPE_SEQUENCE = {
    [0x30]: 0,
    [0x61]: 0x07,
    [0x62]: 0x08,
    [0x74]: 0x09,
    [0x6E]: 0x0A,
    [0x4E]: 0x85,
    [0x76]: 0x0B,
    [0x66]: 0x0C,
    [0x72]: 0x0D,
    [0x65]: 0x1B,
    [0x5F]: 0xA0,
    [0x4C]: 0x2028,
    [0x50]: 0x2029,
    [0x78]: -4 /* HEX_2 */
    , [0x75]: -5 /* HEX_4 */
    , [0x55]: -6 /* HEX_8 */
    , [13 /* CR */]: -1 /* CR */
    , [10 /* LF */]: -2 /* LF */
    , [9 /* TAB */]: -3 /* EMPTY */
    , [32 /* SPACE */]: -3 /* EMPTY */
    , [160 /* UNICODE_SPACE */]: 32 /* SPACE */
    , [34 /* QUOTE_DOUBLE */]: 34 /* QUOTE_DOUBLE */
    , [39 /* QUOTE_SINGLE */]: 39 /* QUOTE_SINGLE */
    , [47 /* SLASH */]: 47 /* SLASH */
    , [92 /* BACKSLASH */]: 92 /* BACKSLASH */
    , [34 /* QUOTE_DOUBLE */]: 34 /* QUOTE_DOUBLE */
};
// export function isPrintable(charcode: number): boolean {
// 	return charcode === CharCode.TAB
// 		|| charcode === CharCode.LF
// 		|| charcode === CharCode.CR
// 		|| (charcode != 0x7F && charcode >= 0x20 && charcode <= 0xD7FF) // DEL is not printable
// 		|| (charcode >= 0xE000 && charcode <= 0xFFFD)
// 		|| (charcode >= 0x010000 && charcode <= 0x10FFFF)
// }

class Parser {
    constructor(loader) {
        this.loader = loader;
        this._documentState = 1 /* NEW_STARTED */;
    }
    parse(data, fileName) {
        this._documentState = 1 /* NEW_STARTED */;
        this.linePosition = 0;
        this.offset = 0;
        this.data = data.charCodeAt(0) === 65279 /* BOM */ ? data.slice(1) : data;
        this.fileName = fileName;
        this.documents = [];
        this.peek(1);
        // empty file
        if (this.data.length <= this.offset) {
            this.documents.push(this.loader.onDocumentEnd(this.loader.onDocumentStart()));
        } else {
            while (this.parseFile());
        }
        return this.documents;
    }
    getLocation(offset = null) {
        if (offset === null) {
            offset = this.offset;
        }
        let data = this.data.substr(0, offset);
        let lines = data.split(/\r?\n/);
        return {
            file: this.fileName,
            column: lines.length ? lines[lines.length - 1].length + 1 : 0,
            line: lines.length,
            offset: offset
        };
    }
    get column() {
        return this.offset - this.linePosition + 1;
    }
    parseFile() {
        this.directive();
        if (this.data.charCodeAt(this.offset) === 45 /* DASH */ && this.isDocumentStart(this.offset)) {
            this.peek(1);
        }
        return this.parseDocument();
    }
    parseDocument() {
        this.doc = this.loader.onDocumentStart();
        this._documentState = 0 /* PARSING */;
        this.doc.content = this.parseValue(this.doc, 0, 1);
        this.peek(1);
        if (this.data.length <= this.offset) {
            this.documents.push(this.loader.onDocumentEnd(this.doc));
        } else if (this._documentState !== 0 /* PARSING */) {
                this.documents.push(this.loader.onDocumentEnd(this.doc));
                return true;
            } else if (this.isDocumentSeparator(this.offset)) {
            this.peek(1);
            if (this._documentState === 2 /* CLOSED */) {
                    this.documents.push(this.loader.onDocumentEnd(this.doc));
                    return true;
                } else if (this._documentState !== 0 /* PARSING */) {
                    this.documents.push(this.loader.onDocumentEnd(this.doc));
                    return true;
                } else {
                this.error("New document start or a directive expected near");
            }
        }
        return false;
    }
    parseValue(handler, state, minColumn) {
        switch (this.data.charCodeAt(this.offset)) {
            case 39 /* QUOTE_SINGLE */:
                return this.quotedString(handler, state, "'");
            case 34 /* QUOTE_DOUBLE */:
                return this.quotedString(handler, state, "\"");
            case 91 /* LBRACKET */:
                return this.flowSequence(handler, state);
            case 123 /* LBRACE */:
                return this.flowMapping(handler, state);
            case 124 /* PIPE */:
                return this.blockScalar(handler, state, minColumn, false);
            case 62 /* RANGLE */:
                return this.blockScalar(handler, state, minColumn, true);
            case 33 /* EXCLAMATION */:
                return this.tag(handler, state);
            case 38 /* AMPERSAND */:
                return this.anchor(handler, state);
            case 42 /* ASTERIX */:
                return this.alias();
            case 63 /* QUESTION */:
                return this.explicitKey(handler, state);
            case 45 /* DASH */:
                if (isWS(this.data.charCodeAt(this.offset + 1))) {
                    return this.blockSequence(handler, state);
                } else {
                    if (this.isDocumentStart(this.offset)) {
                        return handler.onScalar(this.offset, null);
                    }
                    return this.scalar(handler, state);
                }
            case 46 /* DOT */:
                if (this.isDocumentEnd(this.offset)) {
                    return handler.onScalar(this.offset, null);
                }
                return this.scalar(handler, state);
            // case CharCode.AT: return this.error("reserved character '@'")
            // case CharCode.BACKTICK: return this.error("reserved character '`'")
            // case undefined: return handler.onScalar(null) // EOF
            default:
                return this.scalar(handler, state);
        }
    }
    isDocumentSeparator(offset) {
        let ch = this.data.charCodeAt(offset);
        if ((ch === 46 /* DOT */ || ch === 45 /* DASH */) && this.data.charCodeAt(offset + 1) === ch && this.data.charCodeAt(offset + 2) === ch && isWS(this.data.charCodeAt(offset + 3))) {
            this.offset = offset + 3;
            this._documentState = ch === 46 /* DOT */ ? 2 /* CLOSED */ : 1 /* NEW_STARTED */;
            return true;
        } else if (ch === 37 /* PERCENT */) {
                this._documentState = 1 /* NEW_STARTED */;
                return true;
            }
        return false;
    }
    isDocumentStart(offset) {
        if (this.data.charCodeAt(offset + 1) === 45 /* DASH */
        && this.data.charCodeAt(offset + 2) === 45 /* DASH */
        && isWS(this.data.charCodeAt(offset + 3))) {
            this.offset = offset + 3;
            this._documentState = 1 /* NEW_STARTED */;
            return true;
        }
        return false;
    }
    isDocumentEnd(offset) {
        if (this.data.charCodeAt(offset + 1) === 46 /* DOT */
        && this.data.charCodeAt(offset + 2) === 46 /* DOT */
        && isWS(this.data.charCodeAt(offset + 3))) {
            this.offset = offset + 3;
            this._documentState = 2 /* CLOSED */;
            return true;
        }
        return false;
    }
    directive() {
        for (;;) {
            if (this.data.charCodeAt(this.offset) === 37 /* PERCENT */) {
                    let offset = this.offset++;
                    let name = this.read(RX_NS_CHARS);
                    if (!name) {
                        return this.error("Missing directive name");
                    }
                    offset = this.offset;
                    if (this.peek(1) !== 0 /* SAME_LINE */) {
                            this.offset = offset;
                            this.error("Missing directive value");
                        }
                    offset = this.offset;
                    switch (name) {
                        case "YAML":
                            this.loader.onDirective(name, this.read(YAML_DIRECTIVE_VALUE));
                            if (offset === this.offset) {
                                this.error("Missing or invalid YAML version");
                            }
                            break;
                        case "TAG":
                            let handle = this.read(TAG_DIRECTIVE_HANDLE);
                            if (handle === null) {
                                this.error("Missing or invalid tag handle");
                            }
                            this.eatNBS();
                            let ns = this.read(TAG_DIRECTIVE_NS);
                            if (ns === null) {
                                this.error("Missing or invalid tag uri");
                            }
                            this.loader.onDirective(name, {
                                handle: handle,
                                namespace: decodeURIComponent(ns)
                            });
                            break;
                        default:
                            this.loader.onDirective(name, this.read(RX_NB_CHARS));
                            break;
                    }
                    if (this.peek(1) === 1 /* SAME_INDENT */) {
                            continue;
                        } else {
                        break;
                    }
                } else {
                break;
            }
        }
    }
    blockSequence(handler, state) {
        if (state & 24 /* IN_FLOW */) {
                this.error("Block sequence is not allowed");
            }
        let col = this.column,
            seq = handler.onSequenceStart(this.offset),
            substate = state | 64 /* IN_BLOCK_SEQ */,
            value;
        ++this.offset;
        endless: while (true) {
            // ha sikerült a következő sorba léptetni valami csoda folytán (elvuleg nem kéne)
            // akkor ha kijjebb kezdődik a következő sor, mint az ahol elkezdődött a lista
            // egyértelműen meg kell szakítani.
            if (this.peek(col) === 1 /* SAME_INDENT */) {
                    if (this.data.charCodeAt(this.offset) === 45 /* DASH */) {
                            ++this.offset;
                            handler.onSequenceEntry(this.offset - 1, seq, null);
                            continue endless;
                        }
                }
            handler.onSequenceEntry(this.offset, seq, this.parseValue(this.doc, substate, col));
            // console.log("SEQ", value, require("util").inspect(this.data.substr(this.offset, 10)))
            if (this._documentState !== 0 /* PARSING */) {
                    break endless;
                }
            switch (this.peek(col)) {
                case 1 /* SAME_INDENT */:
                    if (this.data.charCodeAt(this.offset) === 45 /* DASH */) {
                            if (this.isDocumentStart(this.offset)) {
                                break endless;
                            }
                            ++this.offset;
                        } else {
                        this.offset -= col; // go to last eol
                        break endless;
                    }
                    break;
                default:
                    break endless;
            }
        }
        return handler.onSequenceEnd(seq);
    }
    flowSequence(handler, state) {
        let seq = handler.onSequenceStart(this.offset),
            substate = (state | 8 /* IN_FLOW_SEQ */ | 1 /* ONLY_COMPACT_MAPPING */) & ~4;
        if (this.data.charCodeAt(++this.offset) === 93 /* RBRACKET */) {
                ++this.offset;
                return handler.onSequenceEnd(seq);
            }
        this.peek(1);
        loop: while (true) {
            handler.onSequenceEntry(this.offset, seq, this.parseValue(this.doc, substate));
            this.peek(1);
            switch (this.data[this.offset]) {
                case ",":
                    ++this.offset;
                    this.peek(1);
                    if (this.data[this.offset] === "]") {
                        ++this.offset;
                        break loop;
                    }
                    break;
                case "]":
                    ++this.offset;
                    break loop;
                default:
                    if (!this.data[this.offset]) {
                        this.error("Unterminated flow sequence", this.offset - 1);
                    } else {
                        this.unexpected([",", "]"]);
                    }
                    return null;
            }
        }
        return handler.onSequenceEnd(seq);
    }
    flowMapping(handler, state) {
        let column = this.column,
            offset,
            mapping = handler.onMappingStart(this.offset),
            key,
            substate = (state | 16 /* IN_FLOW_MAP */) & ~4;
        if (this.data.charCodeAt(++this.offset) === 125 /* RBRACE */) {
                ++this.offset;
                return handler.onMappingEnd(mapping);
            }
        this.peek(1);
        while (true) {
            offset = this.offset;
            key = this.mappingKey(substate);
            if (this.data[this.offset] === ":") {
                ++this.offset;
                this.peek(1);
                handler.onMappingKey(offset, mapping, key, this.parseValue(this.doc, substate));
                this.peek(1);
            } else {
                handler.onMappingKey(offset, mapping, key, null);
            }
            switch (this.data[this.offset]) {
                case ",":
                    ++this.offset;
                    this.peek(1);
                    if (this.data[this.offset] === "}") {
                        ++this.offset;
                        return handler.onMappingEnd(mapping);
                    }
                    break;
                case "}":
                    ++this.offset;
                    if (state & 20 /* NO_BLOCK_MAPPING */) {
                            return handler.onMappingEnd(mapping);
                        } else {
                        return this.isBlockMappingKey(state) ? this.blockMapping(this.offset, handler, state, column, handler.onMappingEnd(mapping)) : handler.onMappingEnd(mapping);
                    }
                default:
                    if (!this.data[this.offset]) {
                        this.error("Unterminated flow mapping", this.offset - 1);
                    } else {
                        this.unexpected([",", "}"]);
                    }
                    return null;
            }
        }
    }
    scalar(handler, state) {
        if (state & 20 /* NO_BLOCK_MAPPING */) {
                return handler.onScalar(this.offset, this.readScalar(state));
            } else {
            let column = this.column,
                offset = this.offset,
                scalar = this.readScalar(state);
            return this.isBlockMappingKey(state) ? this.blockMapping(offset, handler, state, column, scalar) : handler.onScalar(offset, scalar);
        }
    }
    quotedString(handler, state, quote) {
        if (state & 20 /* NO_BLOCK_MAPPING */) {
                return handler.onQuotedString(this.offset, this.readQuotedString(quote), quote);
            } else {
            let column = this.column,
                offset = this.offset,
                str = this.readQuotedString(quote);
            return this.isBlockMappingKey(state) ? this.blockMapping(offset, handler, state, column, str) : handler.onQuotedString(offset, str, quote);
        }
    }
    isBlockMappingKey(state) {
        while (isNBS(this.data.charCodeAt(this.offset++)));
        --this.offset;
        return this.data.charCodeAt(this.offset) === 58 /* COLON */;
    }
    blockMapping(offset, handler, state, column, mappingKey) {
        let mapping = handler.onMappingStart(this.offset),
            substate = state | 32 /* IN_BLOCK_MAP */,
            hasColon;
        endless: while (true) {
            if (hasColon = this.data.charCodeAt(this.offset) === 58 /* COLON */) {
                ++this.offset;
            } else if (mappingKey === "" || mappingKey === null) {
                break;
            }
            switch (this.peek(column)) {
                case 1 /* SAME_INDENT */:
                    if (hasColon && this.data.charCodeAt(this.offset) === 45 /* DASH */ && isWS(this.data.charCodeAt(this.offset + 1))) {
                        handler.onMappingKey(offset, mapping, mappingKey, this.parseValue(handler, substate, column));
                        if (this.peek(column) !== 1 /* SAME_INDENT */) {
                                break endless;
                            }
                    } else {
                        handler.onMappingKey(offset, mapping, mappingKey, null);
                    }
                    if (state & 1 /* ONLY_COMPACT_MAPPING */) {
                            break endless;
                        }
                    offset = this.offset;
                    mappingKey = this.mappingKey(state);
                    if (this._documentState !== 0 /* PARSING */) {
                            break endless;
                        }
                    continue endless;
                case 2 /* DECREASE_INDENT */:
                    if (state & 1 /* ONLY_COMPACT_MAPPING */) {
                            --this.offset;
                            break endless;
                        }
                    handler.onMappingKey(offset, mapping, mappingKey, null);
                    break;
                case 3 /* INCREASE_INDENT */:
                case 0 /* SAME_LINE */:
                    handler.onMappingKey(offset, mapping, mappingKey, this.parseValue(this.doc, substate, column + 1));
                    if (state & 1 /* ONLY_COMPACT_MAPPING */ || this._documentState !== 0 /* PARSING */) {
                            break endless;
                        }
                    if (this.peek(column) === 1 /* SAME_INDENT */) {
                            if (this.isDocumentSeparator(this.offset)) {
                                break endless;
                            }
                            // http://yaml.org/type/merge.html
                            offset = this.offset;
                            mappingKey = this.mappingKey(state);
                        } else {
                        break endless;
                    }
                    break;
            }
        }
        return handler.onMappingEnd(mapping);
    }
    mappingKey(state) {
        if (this.data.charCodeAt(this.offset) === 58 /* COLON */) {
                return null;
            } else {
            let key = this.parseValue(this.doc, state | 4 /* IN_IMPLICIT_KEY */);
            while (isNBS(this.data.charCodeAt(this.offset++)));
            --this.offset;
            return key;
        }
    }
    explicitKey(handler, state) {
        let keyOffset = this.offset,
            column = this.column;
        ++this.offset;
        this.peek(1);
        let key = this.parseValue(this.doc, state | 1 /* ONLY_COMPACT_MAPPING */ | 2 /* IN_EXPLICIT_KEY */);
        let offset = this.offset;
        let isBlockMapping;
        this.peek(1);
        switch (this.data.charCodeAt(this.offset)) {
            case 63 /* QUESTION */:
                this.offset = offset;
            case 58 /* COLON */:
                isBlockMapping = true;
                break;
            case 44 /* COMMA */:
            case 125 /* RBRACE */:
            case 93 /* RBRACKET */:
                if (key === null && !(state & 16 /* IN_FLOW_MAP */)) {
                    let mapping = handler.onMappingStart(this.offset);
                    handler.onMappingKey(offset, mapping, key, null);
                    return handler.onMappingEnd(mapping);
                } else {
                    isBlockMapping;
                }
                break;
            default:
                this.offset = offset;
                isBlockMapping = false;
        }
        if (state & 20 /* NO_BLOCK_MAPPING */) {
                return key;
            } else {
            return isBlockMapping ? this.blockMapping(keyOffset, handler, state, column, key) : key;
        }
    }
    tag(handler, state) {
        let column = this.column,
            offset = this.offset,
            handle = this.read(TAG_DIRECTIVE_HANDLE),
            tagHandler,
            qname;
        if (this.data.charCodeAt(this.offset) === 60 /* LANGLE */) {
                if (handle !== "!") {
                    this.unexpected("URI");
                }
                ++this.offset;
                qname = decodeURIComponent(this.read(TAG_DIRECTIVE_NS));
                if (this.data.charCodeAt(this.offset) === 62 /* RANGLE */) {
                        ++this.offset;
                    } else {
                    this.unexpected(">");
                }
            } else {
            let name = this.read(TAG_NAME);
            if (!name) {
                // http://www.yaml.org/spec/1.2/spec.html#id2785512
                if (handle === "!") {
                    handle = "!!";
                    name = "str";
                } else {
                    this.error(`Missing tag name`);
                }
            } else {
                name = decodeURIComponent(name);
            }
            qname = `${ this.doc.getNamespace(handle) }${ name }`;
        }
        tagHandler = handler.onTagStart(offset, qname);
        if (!tagHandler) {
            this.error(`The !<${ qname }> tag is unknown.`);
        }
        tagHandler.document = this.doc;
        // this.handlerStack.push(tagHandler)
        // mi lenne ha valahogy azt jelezném, hogy a kulcsra kell meghívni a hendlert
        // nem pedig a block mappingra
        let value;
        switch (this.peek(1)) {
            case 0 /* SAME_LINE */:
                offset = this.offset;
                value = handler.onTagEnd(this.parseValue(tagHandler, state & 126 /* IN_NODE */
                ? state | 1 /* ONLY_COMPACT_MAPPING */
                : state | 1 /* ONLY_COMPACT_MAPPING */ | 4 /* IN_IMPLICIT_KEY */));
                if (state & 20 /* NO_BLOCK_MAPPING */ || !this.isBlockMappingKey(state)) {
                    return value;
                } else {
                    return this.blockMapping(offset, this.doc, state, column, value);
                }
            default:
                return handler.onTagEnd(this.parseValue(tagHandler, state & ~1 /* ONLY_COMPACT_MAPPING */));
        }
    }
    // csak 1 anchor lehet, ha van még1 anchor mielőtt fel lenne használva az előző az hiba
    // TODO: refactor úgy hogy egy NachorHandler használjon, amit csak akkor példányosítson, amikor először szükséges
    anchor(handler, state) {
        if (!this._anchor) {
            this._anchor = new Anchor();
        }
        ++this.offset;
        if (!(this._anchor.name = this.read(RX_ANCHOR))) {
            this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'");
        }
        this.peek(1);
        this._anchor.reset(this.offset, this.doc, handler);
        return this.parseValue(this._anchor, state);
    }
    // protected storeAnchor(value: any): any {
    // 	if (this._anchor) {
    // 		let id = this._anchor.anchor,
    // 			offset = this._anchor.offset
    // 		this._anchor = null
    // 		this.doc.onAnchor(offset, id, value)
    // 	}
    // 	return value
    // }
    alias() {
        let offset = this.offset++,
            id = this.read(RX_ANCHOR);
        if (!id) {
            this.unexpected("Any char expect : ',', '[' ']', '{' '}', ' ', '\\r', '\\n', '\\t'");
        }
        return this.doc.onAlias(offset, id);
    }
    unexpected(expected) {
        let ch = (0, _util.inspect)(this.data[this.offset]);
        if (typeof expected === "string") {
            this.error(`Unexpected character: ${ ch }${ expected ? ` expected: '${ expected }'` : "" }`);
        } else {
            this.error(`Unexpected character: ${ ch }${ expected ? ` expected: '${ expected.join("', '") }'` : "" }`);
        }
    }
    error(message, offset = null) {
        this.loader.onError(message, this.getLocation(offset));
    }
    read(rx) {
        rx.lastIndex = this.offset;
        let m = rx.exec(this.data);
        if (m && m.index === this.offset) {
            this.offset += m[0].length;
            return m[0];
        }
        return null;
    }
    /**
     * Skip all non breaking space like tab or space
     */
    eatNBS() {
        // while (IS_NBS[data.charCodeAt(this.offset++)]); --this.offset;
        while (true) {
            let c = this.data.charCodeAt(this.offset);
            if (c === 32 /* SPACE */ || c === 9 /* TAB */) {
                    ++this.offset;
                } else {
                return;
            }
        }
    }
    // TODO: kipróbálni, hogy ha ahol nincs szükség a visszatérési értékre
    // ott a minColumn 0 és abban az esetben nem számolja ki
    // hogy mi történt az identálással, az segíti-e a sebességet
    peek(minColumn) {
        let data = this.data,
            position = this.offset - 1,
            linePosition;
        while (true) {
            switch (data.charCodeAt(++position)) {
                case 32 /* SPACE */:
                case 9 /* TAB */:
                    continue;
                case 13 /* CR */:
                case 10 /* LF */:
                case 35 /* HASH */:
                    --position;
                    while (true) {
                        switch (data.charCodeAt(++position)) {
                            case 32 /* SPACE */:
                            case 9 /* TAB */:
                                continue;
                            case 13 /* CR */:
                                if (data.charCodeAt(position + 1) === 10 /* LF */) {
                                        ++position;
                                    }
                            case 10 /* LF */:
                                linePosition = position + 1;
                                continue;
                            case 35 /* HASH */:
                                let commentStart = position + 1,
                                    ch;
                                // eat all chars expect linebreaks
                                while ((ch = data.charCodeAt(++position)) && !isEOL(ch));
                                --position;
                                this.loader.onComment(data.slice(commentStart, position).trim());
                                continue;
                            default:
                                let column = position + 1 - linePosition;
                                if (minColumn === column) {
                                    this.linePosition = linePosition;
                                    this.offset = position;
                                    return 1 /* SAME_INDENT */;
                                } else if (minColumn < column) {
                                    this.linePosition = linePosition;
                                    this.offset = position;
                                    return 3 /* INCREASE_INDENT */;
                                } else {
                                    this.offset = linePosition - 1; // last newline char
                                    return 2 /* DECREASE_INDENT */;
                                }
                        }
                    }
                default:
                    this.offset = position;
                    return 0 /* SAME_LINE */;
            }
        }
    }
    readScalar(state) {
        let data = this.data,
            position = this.offset - 1,
            startAt = this.offset,

        // endAt = startAt,
        eol = "",
            pendingEol,
            result = "",
            backtrack,
            end = false;
        // console.log("RS", require("util").inspect(data.substr(this.offset, 10)))
        for (;;) {
            peek: for (;;) {
                switch (data.charCodeAt(++position) || undefined) {
                    case 32 /* SPACE */:
                    case 9 /* TAB */:
                        continue peek;
                    case 13 /* CR */:
                        if (data.charCodeAt(position + 1) === 10 /* LF */) {
                                ++position;
                            }
                    case 10 /* LF */:
                        backtrack = position;
                        eol += "\n";
                        break peek;
                    case 58 /* COLON */:
                        let ch;
                        if (isWSorEOF(ch = data.charCodeAt(position + 1)) || state & 24 /* IN_FLOW */ && isFlowIndicator(ch)) {
                            if (!pendingEol || state & 18 /* ALLOW_NL_IN_KEY */) {
                                backtrack = position;
                            } else {
                                this.offset = backtrack;
                                return result === "" ? null : result;
                            }
                            end = true;
                            break peek;
                        }
                        continue peek;
                    case 44 /* COMMA */:
                    case 125 /* RBRACE */:
                    case 93 /* RBRACKET */:
                        if (state & 24 /* IN_FLOW */) {
                                backtrack = position;
                                end = true;
                                break peek;
                            }
                    case 35 /* HASH */:
                        if (isWS(data.charCodeAt(position - 1))) {
                            backtrack = position;
                            end = true;
                            break peek;
                        } else {
                            continue peek;
                        }
                    case undefined:
                        backtrack = position;
                        break peek;
                }
            }
            if (pendingEol) {
                result += pendingEol;
                pendingEol = null;
            }
            while (isWS(data.charCodeAt(--position))); // right trim line
            // console.log({ startAt, position, end, backtrack })
            // console.log("LD", require("util").inspect(data.slice(startAt, position + 1)))
            result += data.slice(startAt, position + 1);
            if (end) {
                this.offset = backtrack;
                // console.log({ result })
                // console.log("BT", require("util").inspect(data.substr(backtrack, 10)))
                return result === "" ? null : result;
            } else {
                position = backtrack;
                // console.log("BW", require("util").inspect(data.substr(position, 10)))
                ws: for (;;) {
                    switch (data.charCodeAt(++position) || undefined) {
                        case 32 /* SPACE */:
                        case 9 /* TAB */:
                            continue ws;
                        case 13 /* CR */:
                            if (data.charCodeAt(position + 1) === 10 /* LF */) {
                                    ++position;
                                }
                        case 10 /* LF */:
                            eol += "\n";
                            continue ws;
                        case undefined:
                            this.offset = position;
                            return result === "" ? null : result;
                        default:
                            // console.log("DDD", data.charCodeAt(position))
                            startAt = position;
                            break ws;
                    }
                }
                // console.log("AW", require("util").inspect(data.substr(position, 10)))
                let ch;
                switch (ch = data.charCodeAt(position)) {
                    case 45 /* DASH */:
                    case 63 /* QUESTION */:
                    case 58 /* COLON */:
                        if (isWSorEOF(data.charCodeAt(position + 1)) || isIndicator(ch)) {
                            // console.log("CCCCCCC", require("util").inspect(this.data.substr(backtrack, 10)))
                            this.offset = backtrack;
                            return result === "" ? null : result;
                        }
                        break;
                    case 46 /* DOT */:
                        if (eol !== "" && this.isDocumentEnd(position)) {
                            return result === "" ? null : result;
                        }
                        break;
                    case 35 /* HASH */:
                        if (isWS(data.charCodeAt(position - 1))) {
                            this.offset = backtrack;
                            return result === "" ? null : result;
                        }
                        break;
                    case 44 /* COMMA */:
                    case 125 /* RBRACE */:
                    case 93 /* RBRACKET */:
                        if (state & 24 /* IN_FLOW */) {
                                this.offset = position;
                                return result === "" ? null : result;
                            }
                        break;
                }
                if (eol !== "") {
                    pendingEol = eol === "\n" ? " " : eol.slice(1);
                    eol = "";
                }
            }
        }
    }
    blockScalar(handler, state, minColumn, isFolded) {
        if (state & 24 /* IN_FLOW */) {
                this.error("Block scalar not allowed");
            }
        let offset = this.offset++,
            indentStartAtColumn = Infinity,
            data = this.data,
            ch = data.charCodeAt(this.offset),
            chomping = 0;
        // TODO: more digit??? pls...
        if (isDigit(ch)) {
            indentStartAtColumn = parseInt(data[this.offset], 10) + 1;
            if (indentStartAtColumn <= 0) {
                this.error("Bad explicit indentation width of a block scalar; it cannot be less than 1");
            }
            indentStartAtColumn = Math.max(minColumn, indentStartAtColumn);
            ch = data.charCodeAt(++this.offset);
        }
        if (ch === 43 /* PLUS */) {
                chomping = 2 /* KEEP */;
                ++this.offset;
            } else if (ch === 45 /* DASH */) {
                chomping = 1 /* STRIP */;
                ++this.offset;
            }
        while (isNBS(data.charCodeAt(this.offset++)));
        --this.offset;
        if (data.charCodeAt(this.offset) === 35 /* HASH */) {
                let commentStart = this.offset;
                do {
                    ch = data.charCodeAt(++this.offset);
                } while (ch && ch !== 13 /* CR */ && ch !== 10 /* LF */);
                this.loader.onComment(data.slice(commentStart + 1, this.offset).trim());
            } else {
            // Eat non linebreaks
            while (isNBS(data.charCodeAt(this.offset++)));
            --this.offset;
        }
        let position = this.offset - 1,
            startAt = position + 1,
            currentColumn = 1,
            lastEolPosition,
            eolSymbols = "",
            result = "",
            lineData,
            inFoldedMoreIndentedBlock;
        reader: while (true) {
            peek: while (true) {
                switch (data.charCodeAt(++position)) {
                    case 32 /* SPACE */:
                        if (++currentColumn >= indentStartAtColumn) {
                            if (currentColumn === indentStartAtColumn) {
                                startAt = position + 1;
                            }
                            if ((chomping === 1 /* STRIP */ ? isWS : isNBS)(data.charCodeAt(position + 1))) {
                                continue peek;
                            } else {
                                break peek;
                            }
                        } else {
                            continue peek;
                        }
                    case 13 /* CR */:
                        if (data.charCodeAt(position + 1) === 10 /* LF */) {
                                ++position;
                            }
                    case 10 /* LF */:
                        lastEolPosition = position;
                        startAt = position + 1;
                        eolSymbols += "\n";
                        currentColumn = 1;
                        break;
                    case 45 /* DASH */:
                    case 46 /* DOT */:
                        if (this.isDocumentSeparator(position)) {
                            break reader;
                        }
                    default:
                        if (currentColumn < minColumn && result === "") {
                            if (lastEolPosition) {
                                this.offset = lastEolPosition;
                                return "";
                            } else {
                                this.offset = position;
                                this.unexpected("LINEBREAK");
                            }
                        }
                        if (indentStartAtColumn === Infinity) {
                            indentStartAtColumn = currentColumn;
                            startAt = position;
                        } else if (currentColumn < indentStartAtColumn) {
                            if (data.charCodeAt(position) === 9 /* TAB */) {
                                    this.error("NO TABS");
                                }
                            break reader;
                        }
                        break peek;
                }
            }
            do {
                if (isNaN(ch = data.charCodeAt(++position))) {
                    if (startAt === position || position > this.data.length) {
                        break reader;
                    } else {
                        break;
                    }
                }
            } while (ch !== 13 /* CR */ && ch !== 10 /* LF */);
            lastEolPosition = position;
            lineData = data.slice(startAt, position);
            if (result === "") {
                if (eolSymbols.length > 1) {
                    result += eolSymbols.slice(1);
                }
            } else if (isFolded) {
                if (inFoldedMoreIndentedBlock) {
                    if (!isNBS(lineData.charCodeAt(0))) {
                        inFoldedMoreIndentedBlock = false;
                    }
                    result += eolSymbols;
                } else if (isNBS(lineData.charCodeAt(0))) {
                    inFoldedMoreIndentedBlock = true;
                    result += eolSymbols;
                } else if (eolSymbols.length > 1) {
                    result += eolSymbols.slice(1);
                } else {
                    result += " ";
                }
            } else {
                result += eolSymbols;
            }
            result += lineData;
            eolSymbols = ""; // reset eol
            --position; // current position is linebreak or EOF, so decrease it
        }
        if (lastEolPosition !== null) {
            this.offset = lastEolPosition;
        } else {
            this.error("Something unexpected");
        }
        switch (chomping) {
            case 0 /* CLIP */:
                return handler.onBlockString(offset, eolSymbols !== "" ? `${ result }\n` : result);
            case 1 /* STRIP */:
                return handler.onBlockString(offset, result);
            case 2 /* KEEP */:
                return handler.onBlockString(offset, `${ result }${ eolSymbols }`);
        }
    }
    readQuotedString(terminal) {
        let data = this.data,
            offset = this.offset,
            result = "",
            eolCount = 0,
            ch,
            escaped = {};
        endless: while (true) {
            switch (ch = data[++offset]) {
                case "\r":
                    if (data[offset + 1] === "\n") {
                        ++offset;
                    }
                case "\n":
                    if (++eolCount > 1) {
                        result += "\n";
                    }
                    break;
                case " ":
                case "\t":
                    let spaceStart = offset;
                    while (isNBS(data.charCodeAt(++offset)));
                    if (isEOL(data.charCodeAt(spaceStart - 1))) {
                        if (isEOL(data.charCodeAt(offset))) {
                            --offset;
                            continue endless;
                        }
                        if (!isWS(result.charCodeAt(result.length - 1)) || escaped[result.length - 1]) {
                            result += " ";
                        }
                        --offset;
                        continue endless;
                    } else {
                        if (isEOL(data.charCodeAt(offset))) {
                            --offset;
                            continue endless;
                        } else {
                            offset = spaceStart;
                            result += ch;
                        }
                    }
                    break;
                case "\\":
                    if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
                        result += " ";
                    }
                    eolCount = 0;
                    if (terminal === "\"") {
                        let esc = ESCAPE_SEQUENCE[data.charCodeAt(++offset)];
                        escaped[result.length] = true;
                        switch (esc) {
                            case -4 /* HEX_2 */:
                                result += String.fromCodePoint(parseInt(this.data.slice(++offset, (offset += 1) + 1), 16));
                                break;
                            case -5 /* HEX_4 */:
                                result += String.fromCodePoint(parseInt(this.data.slice(++offset, (offset += 3) + 1), 16));
                                break;
                            case -6 /* HEX_8 */:
                                result += String.fromCodePoint(parseInt(this.data.slice(++offset, (offset += 7) + 1), 16));
                                break;
                            case -1 /* CR */:
                                if (data.charCodeAt(offset + 1) === 10 /* LF */) {
                                        ++offset;
                                    }
                            case -2 /* LF */:
                                result += "";
                                while (isNBS(data.charCodeAt(++offset)));
                                --offset;
                                // Example 7.5. Double Quoted Line Breaks
                                if (data.charCodeAt(offset + 1) === 92 /* BACKSLASH */
                                && ESCAPE_SEQUENCE[data.charCodeAt(offset + 2)] === -3 /* EMPTY */) {
                                        result += data[offset += 2];
                                    }
                                break;
                            case -3 /* EMPTY */:
                                result += "";
                                // while (IS_NBS[data.charCodeAt(++offset)]); --offset;
                                break;
                            case undefined:
                                this.error("Unknown escape sequence");
                            default:
                                result += String.fromCharCode(esc);
                        }
                    } else {
                        result += "\\";
                    }
                    break;
                case terminal:
                    if (terminal === "'") {
                        if (data[offset + 1] === "'") {
                            ++offset;
                            result += "'";
                            continue endless;
                        }
                    }
                    if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
                        result += " ";
                    }
                    ++offset;
                    break endless;
                case undefined:
                    this.error("Unexpected end of file");
                    return null;
                default:
                    if (eolCount === 1 && !isWS(result.charCodeAt(result.length - 1))) {
                        result += " ";
                    }
                    eolCount = 0;
                    result += ch;
            }
        }
        this.offset = offset;
        return result;
    }
}
class Anchor {
    constructor() {
        this.storeAnchor = this._storeAnchor;
    }
    reset(offset, document, handler) {
        this.storeAnchor = this._storeAnchor;
        this.offset = offset;
        this.document = document;
        this.handler = handler;
    }
    onMappingStart(offset) {
        return this.storeAnchor(this.handler.onMappingStart(offset));
    }
    onSequenceStart(offset) {
        return this.storeAnchor(this.handler.onSequenceStart(offset));
    }
    onScalar(offset, value) {
        return this.storeAnchor(this.handler.onScalar(offset, value));
    }
    onQuotedString(offset, value, quote) {
        return this.storeAnchor(this.handler.onQuotedString(offset, value, quote));
    }
    onBlockString(offset, value) {
        return this.storeAnchor(this.handler.onBlockString(offset, value));
    }
    onTagStart(offset, qname) {
        this.handler = this.handler.onTagStart(offset, qname);
        return this;
    }
    onMappingEnd(mapping) {
        return this.handler.onMappingEnd(mapping);
    }
    onMappingKey(offset, mapping, key, value) {
        return this.handler.onMappingKey(offset, mapping, key, value);
    }
    onSequenceEnd(sequence) {
        return this.handler.onSequenceEnd(sequence);
    }
    onSequenceEntry(offset, sequence, entry) {
        return this.handler.onSequenceEntry(offset, sequence, entry);
    }
    onTagEnd(value) {
        return this.handler.onTagEnd(value);
    }
    _storeAnchor(any) {
        this.document.onAnchor(this.offset, this.name, any);
        this.storeAnchor = value => value;
        return any;
    }
}

class TypeFactory {
    onMappingStart(offset) {
        this.document.error("Unexpected value (mapping)", offset);
    }
    onMappingEnd(mapping) {
        return mapping;
    }
    onMappingKey(offset, mapping, key, value) {
        mapping[key] = value;
    }
    onSequenceStart(offset) {
        this.document.error("Unexpected value (sequence)", offset);
    }
    onSequenceEnd(sequence) {
        return sequence;
    }
    onSequenceEntry(offset, sequence, entry) {
        sequence.push(entry);
    }
    onScalar(offset, value) {
        this.document.error("Unexpected value (scalar)", offset);
    }
    onQuotedString(offset, value, quote) {
        this.document.error("Unexpected value (string)", offset);
    }
    onBlockString(offset, value) {
        this.document.error("Unexpected value (string)", offset);
    }
    onTagStart(offset, qname) {
        this.document.error("Unexpected value (tag)", offset);
        return null;
    }
    onTagEnd(value) {
        return value;
    }
}

class ScalarResolver {
    constructor(decision) {
        this.decision = [];
        for (let ch of decision) {
            let c = ch.charCodeAt(0);
            if (this.decision.indexOf(c) === -1) {
                this.decision.push(c);
            }
        }
    }
}
/**
 * usage:
 * ScalarToNull = new ScalarValueMap({"null": null, "Null": null})
 */
class ScalarValueMap extends ScalarResolver {
    constructor(valueMapping) {
        super(_makeDecision(valueMapping));
        this.valueMapping = valueMapping;
    }
    resolve(document, value) {
        let v;
        return (v = this.valueMapping[value]) !== undefined ? v : undefined;
    }
}
/**
 * usage:
 * ScalarToInt = new ScalarRegexMatch("+-0123456789", /^[+-]?[1-9][0-9]+$/, (m) => parseInt(m[0]))
 */
class ScalarRegexMatch extends ScalarResolver {
    constructor(decision, rx, converter) {
        super(decision);
        this.converter = converter;
        this.rx = rx instanceof RegExp ? rx : _makeRx(rx);
    }
    resolve(document, value) {
        let m;
        if (m = value.match(this.rx)) {
            return this.converter(m, document);
        }
        return undefined;
    }
}
/**
 * usage:
 * Int = new ScalarResolverAsType(ScalarToInt)
 */
class ScalarResolverAsType extends TypeFactory {
    constructor(sr) {
        super();
        this.sr = sr;
    }
    onScalar(offset, value) {
        return this.sr.resolve(this.document, value);
    }
    onQuotedString(offset, value, quote) {
        return this.sr.resolve(this.document, value);
    }
}
/**
 * usage:
 * JsonScalars = new ScalarResolverSet([ScalarToNull, ScalarToInt])
 */
class ScalarResolverSet {
    constructor(resolvers = []) {
        this.resolvers = resolvers;
        this.map = [];
        this._updateDecisionMap();
    }
    resolve(document, value) {
        if (value) {
            let resolvers;
            if ((resolvers = this.map[value.charCodeAt(0)]) === undefined) {
                return undefined;
            } else {
                let resolved;
                for (let resolver of resolvers) {
                    if ((resolved = resolver.resolve(document, value)) !== undefined) {
                        return resolved;
                    }
                }
            }
        }
        return undefined;
    }
    merge(other) {
        if (!Array.isArray(other)) {
            other = [other];
        }
        let resolvers = this.resolvers.slice(0);
        for (let obj of other) {
            if (obj instanceof ScalarResolverSet) {
                for (let r of obj.resolvers) {
                    if (resolvers.indexOf(r) === -1) {
                        resolvers.unshift(r);
                    }
                }
            } else if (resolvers.indexOf(obj) === -1) {
                resolvers.unshift(obj);
            }
        }
        return new ScalarResolverSet(resolvers);
    }
    _updateDecisionMap() {
        let map = this.map;
        map.length = 0;
        for (let resolver of this.resolvers) {
            for (let ch of resolver.decision) {
                if (!map[ch]) {
                    map[ch] = [resolver];
                } else {
                    map[ch].push(resolver);
                }
            }
        }
    }
}
function _makeDecision(mapping) {
    let result = "";
    for (let k in mapping) {
        if (result.indexOf(k[0]) === -1) {
            result += k[0];
        }
    }
    return result;
}
function _makeRx(rx) {
    return new RegExp(rx.replace(/[ \t]*[\r\n]+[ \t]*/g, ""));
}

class Schema {
    constructor(tags = {}, scalars = new ScalarResolverSet()) {
        this.tags = tags;
        this.scalars = scalars;
    }
    resolveTag(qname) {
        return null;
    }
}

class SchemaCollection {
    constructor(schemas) {
        this.schemas = schemas;
        this.tags = {};
        this.scalars = new ScalarResolverSet();
        for (let schema of schemas) {
            Object.assign(this.tags, schema.tags);
            this.scalars = this.scalars.merge(schema.scalars);
        }
    }
    resolveTag(qname) {
        let result;
        for (let schema of this.schemas) {
            if (result = schema.resolveTag(qname)) {
                return result;
            }
        }
        return null;
    }
}

class YamlMap extends TypeFactory {
    onMappingStart() {
        return {};
    }
}
class YamlOMap extends TypeFactory {
    onMappingStart() {
        return [];
    }
    onMappingKey(offset, omap, key, value) {
        omap.push({ [key]: value });
    }
    onSequenceStart() {
        return [];
    }
    onSequenceEntry(offset, sequence, entry) {
        if (`${ entry }` === "[object Object]") {
            switch (Object.keys(entry).length) {
                case 1:
                    sequence.push(entry);
                    break;
                case 0:
                    this.document.error("Empty key value pair not supported", offset);
                    break;
                default:
                    this.document.error("Too many key value pair in ordered map", offset);
                    break;
            }
        }
    }
}
class YamlSeq extends TypeFactory {
    onSequenceStart() {
        return [];
    }
}
class YamlStr extends TypeFactory {
    onScalar(offset, value) {
        return value ? value : "";
    }
    onQuotedString(offset, value, quote) {
        return value;
    }
    onBlockString(offset, value) {
        return value;
    }
}
class YamlSet extends TypeFactory {
    onMappingStart(offset) {
        return new Set();
    }
    onMappingKey(offset, set, entry, value) {
        if (value !== null) {
            this.document.error("Set is not a mapping, and not allow to specify value for keys", offset);
        } else {
            set.add(entry);
        }
    }
    onSequenceStart(offset) {
        return new Set();
    }
    onSequenceEntry(offset, sequence, entry) {
        sequence.add(entry);
    }
}
class YamlBinary extends TypeFactory {
    onScalar(offset, value) {
        return this.createFromBase64(value);
    }
    onQuotedString(offset, value) {
        return this.createFromBase64(value);
    }
    onBlockString(offset, value) {
        return this.createFromBase64(value);
    }
    createFromBase64(data) {
        return Buffer.from(data.replace(/\s+/, ""), "base64");
    }
}
const SCHEMA_FAILSAFE = new Schema({
    "tag:yaml.org,2002:map": new YamlMap(),
    "tag:yaml.org,2002:seq": new YamlSeq(),
    "tag:yaml.org,2002:str": new YamlStr()
});
const CommonTypes = new Schema({
    "tag:yaml.org,2002:set": new YamlSet(),
    "tag:yaml.org,2002:omap": new YamlOMap(),
    "tag:yaml.org,2002:pairs": new YamlSeq(),
    "tag:yaml.org,2002:binary": new YamlBinary()
});

const SCHEMA_COMMON = new SchemaCollection([SCHEMA_FAILSAFE, CommonTypes]);

const ScalarToNull = new ScalarValueMap({ "null": null });
const ScalarToBool = new ScalarValueMap({ "true": true, "false": false });
const ScalarToInt = new ScalarRegexMatch("+-0123456789", /^[-+]?(?:0|[1-9][0-9]*)$/, match => {
    return parseInt(match[0], 10);
});
const ScalarToFloat = new ScalarRegexMatch("+-0123456789.", /^[-+]?(0|[1-9][0-9]*)(\.[0-9]*)?([eE][-+]?[0-9]+)?$/, match => {
    return parseFloat(match[0]);
});
const JsonScalars = new ScalarResolverSet([ScalarToNull, ScalarToBool, ScalarToInt, ScalarToFloat]);

const TAGS = {
    "tag:yaml.org,2002:null": new ScalarResolverAsType(ScalarToNull),
    "tag:yaml.org,2002:int": new ScalarResolverAsType(ScalarToInt),
    "tag:yaml.org,2002:float": new ScalarResolverAsType(ScalarToFloat),
    "tag:yaml.org,2002:bool": new ScalarResolverAsType(ScalarToBool)
};
const JsonSchema = new Schema(TAGS, JsonScalars);

const SCHEMA_JSON = new SchemaCollection([SCHEMA_FAILSAFE, JsonSchema]);

const SCHEMA_V11 = SCHEMA_COMMON;

const ScalarToNull$1 = new ScalarValueMap({ "null": null, "Null": null, "NULL": null, "~": null, "": null });
const ScalarToBool$1 = new ScalarValueMap({
    "true": true, "True": true, "TRUE": true,
    "false": false, "False": false, "FALSE": false
});
const ScalarToInt$1 = new ScalarRegexMatch("+-0123456789", `^(?:
		([+-]?)
		(?:
			((?:[1-9][0-9]*)|0)
			|
			(0x[0-9a-fA-F]+)
			|
			(0o[0-7]+)
		)
	)$`, match => {
    let res;
    if (match[2]) {
        res = parseInt(match[2], 10);
    } else if (match[3]) {
        res = parseInt(match[3].slice(2), 16);
    } else if (match[4]) {
        res = parseInt(match[4].slice(2), 8);
    }
    return match[1] === "-" ? -res : res;
});
const ScalarToFloat$1 = new ScalarRegexMatch("+-.0123456789", `^(?:
		([+-]?)
		(?:
			([-+]?(?:[0-9][0-9_]*)?\\.?(?:[0-9][0-9_]*(?:[eE][-+]?[0-9][0-9_]*)?)?)
			|
			([0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*)
			|
			(\\.(?:inf|Inf|INF))
		)
		|
		(\\.(?:nan|NaN|NAN))
	)$`, match => {
    if (match[2]) {
        let res = parseFloat(match[2].replace("_", ""));
        return match[1] === "-" ? -res : res;
    } else if (match[3]) {
        let base = 1,
            result = 0.0,
            numbers = [];
        for (let part of match[3].replace("_", "").split(":")) {
            numbers.unshift(parseFloat(part));
        }
        for (let number of numbers) {
            result += number * base;
            base *= 60;
        }
        return match[1] === "-" ? -result : result;
    } else if (match[4]) {
        return match[1] === "-" ? -Infinity : Infinity;
    } else if (match[5]) {
        return NaN;
    }
});
const ScalarToDate = new ScalarRegexMatch("0123", // if this program survives year 3000+ i'am very happy :)
`^(?:
		([0-9]{4}-[0-9]{2}-[0-9]{2})
		|
		(?:
			([0-9]{4}-[0-9]{1,2}-[0-9]{1,2})
			(?:[Tt]|[ \\t]+)
			([0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\\.\\d+)?)
			(?:[ \\t]*(?:(Z)|([-+][0-9]{1,2}(?::?[0-9]{1,2})?)))?
		)
	)$`, (match, doc) => {
    let ds;
    if (match[1 /* YMD */]) {
        ds = `${ match[1 /* YMD */] }T00:00:00Z`;
    } else {
        ds = `${ match[2 /* FULL_YMD */] }T${ match[3 /* FULL_TIME */] }`;
        if (match[5 /* TZ_OFFSET */]) {
            let offset = match[5 /* TZ_OFFSET */];
            let sign = offset[0];
            let parts = offset.slice(1).split(/:/);
            if (parts[0].length === 4) {
                parts[1] = parts[0].slice(2);
                parts[0] = parts[0].slice(0, 2);
            }
            if (parts[0].length === 1) {
                ds += `${ sign }0${ parts[0] }00`;
            } else {
                ds += `${ sign }${ parts[0] }`;
                if (!parts[1]) {
                    ds += "00";
                } else {
                    ds += parts[1].length === 1 ? `0${ parts[1] }` : parts[1];
                }
            }
        } else {
            ds += "Z";
        }
    }
    return new Date(ds);
});
const V12Scalars = new ScalarResolverSet([ScalarToNull$1, ScalarToBool$1, ScalarToInt$1, ScalarToFloat$1, ScalarToDate]);

const TAGS$1 = {
    "tag:yaml.org,2002:null": new ScalarResolverAsType(ScalarToNull$1),
    "tag:yaml.org,2002:int": new ScalarResolverAsType(ScalarToInt$1),
    "tag:yaml.org,2002:float": new ScalarResolverAsType(ScalarToFloat$1),
    "tag:yaml.org,2002:bool": new ScalarResolverAsType(ScalarToBool$1),
    "tag:yaml.org,2002:timestamp": new ScalarResolverAsType(ScalarToDate)
};
const V12Schema = new Schema(TAGS$1, V12Scalars);

const SCHEMA_V12 = new SchemaCollection([SCHEMA_COMMON, V12Schema]);

class YamlError extends Error {
    constructor(message, location, content) {
        super(`${ message } at ${ location.file }:${ location.line },${ location.column }`);
        this.location = location;
    }
}
class Loader {
    constructor(documentClass, options = {}) {
        this.documentClass = documentClass;
        this.options = options;
        this.parser = new Parser(this);
        this.namespaces = {};
        this.version = null;
    }
    load(data, fileName = "<string>") {
        return this.parser.parse(data, fileName);
    }
    loadFile(fileName, encoding = "UTF-8") {
        fileName = (0, _fs.realpathSync)(fileName);
        return this.load((0, _fs.readFileSync)(fileName, encoding), fileName);
    }
    /**
     * Called when the directive found, not test if the directive is available
     * in the YAML spec.
     */
    onDirective(name, value) {
        if (name === "TAG") {
            this.namespaces[value.handle] = value.namespace;
        } else if (name === "YAML") {
            this.version = parseFloat(value);
        }
    }
    /**
     * Called when starts a new document
     */
    onDocumentStart() {
        let version = this.options.forcedVersion ? this.options.forcedVersion : this.version ? this.version : this.options.defaultVersion || 1.2;
        let schema = this.options.schema ? this.options.schema : this.options.extraSchema ? new SchemaCollection([version === 1.2 ? SCHEMA_V12 : SCHEMA_V11, this.options.extraSchema]) // todo: cache
        : version === 1.2 ? SCHEMA_V12 : SCHEMA_V11;
        let doc = new this.documentClass(this, schema);
        doc.version = version;
        for (let k in this.namespaces) {
            doc.addNamespace(k, this.namespaces[k]);
        }
        return doc;
    }
    /**
     * Called when the documents end (EOF / ...)
     */
    onDocumentEnd(document) {
        return document;
    }
    /**
     * Called when a comment found
     */
    onComment(comment) {}
    /**
     * Called when error occured
     */
    onError(message, location) {
        throw new YamlError(message, location);
        // throw new Error(`${message} at ${location.file ? location.file + ":" : ""}${location.line},${location.column}`)
    }
}

class YamlDocument {
    constructor(loader, schema) {
        this.loader = loader;
        this.schema = schema;
        this.version = 1.2;
        this.content = null;
        this.namespaces = {
            "!!": "tag:yaml.org,2002:"
        };
        this.references = {};
    }
    addNamespace(handle, namespace) {
        this.namespaces[handle] = namespace;
    }
    getNamespace(handle) {
        if (!this.namespaces[handle]) {
            if (handle === "!") {
                return "!";
            } else {
                this.error(`Undeclared tag handle '${ handle }'`);
            }
        }
        return this.namespaces[handle];
    }
    /**
     * Called when the mapping start (inline / block) and must return
     * something that store key / value pairs
     */
    onMappingStart(offset) {
        return {};
    }
    /**
     * Called when the mapping parsed and return value used as final
     * mapping object
     */
    onMappingEnd(mapping) {
        // TODO: ha minden érték null, esetleg visszatérhet Set-tel is
        return mapping;
    }
    /**
     * Called when a mapping key found
     */
    onMappingKey(offset, mapping, key, value) {
        mapping[key] = value;
    }
    /**
     * Called when a sequence start (inline / block) and must return
     * sumething that store numerical indexed entries
     */
    onSequenceStart(offset) {
        return [];
    }
    /**
     * Called when the sequence parsed and return value uased as final
     * sequence object
     */
    onSequenceEnd(sequence) {
        return sequence;
    }
    /**
     * Called when an sequence entry is found
     */
    onSequenceEntry(offset, sequence, entry) {
        sequence.push(entry);
    }
    /**
     * Called when a tag start, and must return a factory function
     * or NULL when not found a factory function
     */
    onTagStart(offset, qname) {
        return this.schema.tags[qname] || this.schema.resolveTag(qname);
    }
    /**
     * Called when a tag is parsed and return value uased as final
     * tag object
     */
    onTagEnd(value) {
        return value;
    }
    /**
     * Called when a anchor found (&anchor)
     */
    onAnchor(offset, name, value) {
        this.references[name] = value;
    }
    /**
     * Called when an alias found (*alias)
     */
    onAlias(offset, name) {
        if (!this.references.hasOwnProperty(name)) {
            this.error(`Missing reference for this name: '${ name }'.`, offset);
        }
        return this.references[name];
    }
    /**
     * Called when an unqouted string found
     */
    onScalar(offset, value) {
        let v;
        return (v = this.schema.scalars.resolve(this, value)) === undefined ? value : v;
    }
    /**
     * Called when a single or double qouted string found
     */
    onQuotedString(offset, value, quote) {
        return value;
    }
    /**
     * Called when a block string found
     */
    onBlockString(offset, value) {
        return value;
    }
    error(message, offset) {
        this.loader.onError(message, this.loader.parser.getLocation(offset));
    }
    dispose() {
        delete this.content;
        delete this.references;
        delete this.schema;
    }
}

function load(data, options) {
    let loader = new Loader(YamlDocument);
    return loader.load(data);
}
function loadFile(filePath, options) {
    let loader = new Loader(YamlDocument);
    return loader.loadFile(filePath);
}

exports.Parser = Parser;
exports.Loader = Loader;
exports.YamlError = YamlError;
exports.YamlDocument = YamlDocument;
exports.Schema = Schema;
exports.TypeFactory = TypeFactory;
exports.ScalarResolver = ScalarResolver;
exports.ScalarValueMap = ScalarValueMap;
exports.ScalarRegexMatch = ScalarRegexMatch;
exports.ScalarResolverAsType = ScalarResolverAsType;
exports.ScalarResolverSet = ScalarResolverSet;
exports.SchemaCollection = SchemaCollection;
exports.SCHEMA_FAILSAFE = SCHEMA_FAILSAFE;
exports.SCHEMA_COMMON = SCHEMA_COMMON;
exports.SCHEMA_JSON = SCHEMA_JSON;
exports.SCHEMA_V11 = SCHEMA_V11;
exports.SCHEMA_V12 = SCHEMA_V12;
exports.load = load;
exports.loadFile = loadFile;
//# sourceMappingURL=index.js.map
