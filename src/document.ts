import {Parser, Location} from "./parser"
import {Loader} from "./loader"
import {SCHEMA_CORE, ISchema, TagFactory} from "./schema"


export interface Mapping extends Object {
	[key: string]: any
}


export interface Sequence extends Array<any> {

}


export type Scalar = string;


export interface TagDirective {
	handle: string
	namespace: string
}


export class TagName {
	public constructor(public localName: string, public namespace: string) {
	}

	public toString() {
		return `!<${this.namespace}${this.localName}>`
	}
}


export type Directive = {
	/**
	 * Any key-value pair that starts with %
	 * like %YAML 1.2
	 * BUT CURRENTLY ONLY SUPPORTS YAML AND TAG DIRECTIVES
	 */
	[key: string]: any
	/**
	 * YAML version number
	 */
	YAML?: string
	/**
	 * TAG ns definitions
	 */
	TAG?: TagDirective
}


export type YamlDocumentClass = {
	new(loader: Loader, schema?: ISchema): YamlDocument
}


export class YamlDocument {
	public readonly schema: ISchema
	protected _content: any
	protected references = {}
	protected tagNS = {
		"!!": "tag:yaml.org,2002:"
	}

	public constructor(protected loader: Loader, schema: ISchema = SCHEMA_CORE) {
		this.schema = schema
	}

	/**
	 * Called when the directive found, not test if the directive is available
	 * in the YAML spec.
	 */
	public onDirective(name: string, value: any): void {
		if (name === "TAG") {
			this.tagNS[(<TagDirective> value).handle] = (<TagDirective> value).namespace
		}
	}

	/**
	 * Called when the mapping start (inline / block) and must return
	 * something that store key / value pairs
	 */
	public onMappingStart(): Mapping {
		return {}
	}

	/**
	 * Called when the mapping parsed and return value used as final
	 * mapping object
	 */
	public onMappingEnd(mapping: Mapping): Mapping {
		return mapping
	}

	/**
	 * Called when a mapping key found
	 */
	public onMappingKey(mapping: Mapping, key: any, value: any): void {
		mapping[key] = value
	}

	/**
	 * Called when a sequence start (inline / block) and must return
	 * sumething that store numerical indexed entries
	 */
	public onSequenceStart(): Sequence {
		return []
	}

	/**
	 * Called when the sequence parsed and return value uased as final
	 * sequence object
	 */
	public onSequenceEnd(sequence: Sequence): Sequence {
		return sequence
	}

	/**
	 * Called when an sequence entry is found
	 */
	public onSequenceEntry(sequence: Sequence, entry: any): void {
		sequence.push(entry)
	}

	/**
	 * Called when a tag start, and must return a factory function
	 * or NULL when not found a factory function
	 */
	public onTagStart(handle: string, name: string): TagFactory {
		return this.schema.resolveTag(this.tagNS[handle] || handle, name)
	}

	/**
	 * Called when a tag is parsed and return value uased as final
	 * tag object
	 */
	public onTagEnd(value: any): any {
		return value
	}

	/**
	 * Called when a anchor found (&anchor)
	 */
	public onAnchor(name: string, value: any): void {
		this.references[name] = value
	}

	/**
	 * Called when an alias found (*alias)
	 */
	public onAlias(name: string): any {
		if (!this.references.hasOwnProperty(name)) {
			this.error(`Missing reference for this name: '${name}'.`)
		}
		return this.references[name]
	}

	/**
	 * Called when a number found (int / float)
	 */
	public onNumber(value: number): any {
		return value
	}

	/**
	 * Called when an unqouted string found
	 */
	public onScalar(value: string): any {
		let resolved = this.schema.resolveScalar(this, value)
		if (resolved !== undefined) {
			return resolved
		}
		return value
	}

	/**
	 * Called when a single or double qouted string found
	 */
	public onQuotedString(value: string, quote: string): any {
		return value
	}

	/**
	 * Called when a block string found
	 *
	 * @param isFolded True when string constructed with ">" char
	 */
	public onBlockString(value: string, isFolded: boolean): any {
		return value
	}

	public get content(): any {
		return this._content
	}

	public error(message: string): void {
		this.loader.onError(message, this.loader.parser.getLocation())
	}

	public dispose() {
		delete this._content
		delete this.references
		delete this.schema
	}
}