import { Loader } from "./loader"
import { ISchema, TypeFactory } from "./schema"
import { IDocumentHandler } from "./handler"


export class YamlDocument implements IDocumentHandler {
	public readonly version: number = 1.2
	public readonly content: any = null

	public readonly namespaces: { [key: string]: string } = {
		"!!": "tag:yaml.org,2002:"
	}

	protected references: { [key: string]: any } = {}


	public constructor(public readonly loader: Loader, public readonly schema: ISchema) {
	}

	public addNamespace(handle: string, namespace: string) {
		this.namespaces[handle] = namespace
	}

	public getNamespace(handle: string) {
		if (!this.namespaces[handle]) {
			if (handle === "!") {
				return "!"
			} else {
				this.error(`Undeclared tag handle '${handle}'`)
			}
		}
		return this.namespaces[handle]
	}

	/**
	 * Called when the mapping start (inline / block) and must return
	 * something that store key / value pairs
	 */
	public onMappingStart(offset: number): any {
		return {}
	}

	/**
	 * Called when the mapping parsed and return value used as final
	 * mapping object
	 */
	public onMappingEnd(mapping: any): any {
		// TODO: ha minden érték null, esetleg visszatérhet Set-tel is
		return mapping
	}

	/**
	 * Called when a mapping key found
	 */
	public onMappingKey(offset: number, mapping: any, key: any, value: any): void {
		mapping[key] = value
	}

	/**
	 * Called when a sequence start (inline / block) and must return
	 * sumething that store numerical indexed entries
	 */
	public onSequenceStart(offset: number): any {
		return []
	}

	/**
	 * Called when the sequence parsed and return value uased as final
	 * sequence object
	 */
	public onSequenceEnd(sequence: any): any {
		return sequence
	}

	/**
	 * Called when an sequence entry is found
	 */
	public onSequenceEntry(offset: number, sequence: any, entry: any): void {
		sequence.push(entry)
	}

	/**
	 * Called when a tag start, and must return a factory function
	 * or NULL when not found a factory function
	 */
	public onTagStart(offset: number, qname: string): TypeFactory {
		return this.schema.tags[qname] || this.schema.resolveTag(qname)
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
	public onAnchor(offset: number, name: string, value: any): void {
		this.references[name] = value
	}

	/**
	 * Called when an alias found (*alias)
	 */
	public onAlias(offset: number, name: string): any {
		if (!this.references.hasOwnProperty(name)) {
			this.error(`Missing reference for this name: '${name}'.`, offset)
		}
		return this.references[name]
	}

	/**
	 * Called when an unqouted string found
	 */
	public onScalar(offset: number, value: string): any {
		let v
		return (v = this.schema.scalars.resolve(this, value)) === undefined
			? value
			: v
	}

	/**
	 * Called when a single or double qouted string found
	 */
	public onQuotedString(offset: number, value: string, quote: string): any {
		return value
	}

	/**
	 * Called when a block string found
	 */
	public onBlockString(offset: number, value: string): any {
		return value
	}

	public error(message: string, offset?: number): void {
		this.loader.onError(message, this.loader.parser.getLocation(offset))
	}

	public dispose() {
		delete (<any>this).content
		delete (<any>this).references
		delete (<any>this).schema
		delete (<any>this).loader
	}
}