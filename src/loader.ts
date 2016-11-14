import { readFileSync, realpathSync } from "fs"

import { YamlDocument, YamlDocumentClass } from "./document"
import { Parser, Location } from "./parser"
import { SCHEMA_V11, SCHEMA_V12, SchemaCollection, ISchema } from "./schema"


export interface TagDirective {
	handle: string
	namespace: string
}


export type LoaderOptions = {
	/**
	 * If YAML document dont specifiy the version in directives, than use
	 * this version value
	 */
	defaultVersion?: number,
	/**
	 * Always use this version in documents
	 */
	forcedVersion?: number,
	/**
	 * Use this schema + version schema in documents
	 */
	extraSchema?: ISchema,
	/**
	 * Onkly use this schema in documents
	 */
	schema?: ISchema,
	/**
	 * Control parser ot call the onComment method or not
	 */
	needComments?: boolean
}


export class YamlError extends Error {
	public constructor(message: string, public location: Location, content?: string) {
		super(`${message} at ${location.file}:${location.line},${location.column}`)
	}
}


export class Loader {
	public readonly parser = new Parser(this)
	protected namespaces: { [key: string]: string } = {}
	protected version: number = null

	public constructor(public readonly documentClass: YamlDocumentClass, public options: LoaderOptions = {}) {
	}

	public load(data: string, fileName: string = "<string>"): YamlDocument[] {
		return this.parser.parse(data, fileName)
	}

	public loadFile(fileName: string, encoding: string = "UTF-8"): YamlDocument[] {
		fileName = realpathSync(fileName)
		return this.load(readFileSync(fileName, encoding), fileName)
	}

	/**
	 * Called when the directive found, not test if the directive is available
	 * in the YAML spec.
	 */
	public onDirective(name: string, value: any): void {
		if (name === "TAG") {
			this.namespaces[(<TagDirective>value).handle] = (<TagDirective>value).namespace
		} else if (name === "YAML") {
			this.version = parseFloat(value)
		}
	}

	/**
	 * Called when starts a new document
	 */
	public onDocumentStart(): YamlDocument {
		let version = this.options.forcedVersion
			? this.options.forcedVersion
			: (this.version
				? this.version
				: (this.options.defaultVersion || 1.2)
			)

		let schema = this.options.schema
			? this.options.schema
			: (this.options.extraSchema
				? new SchemaCollection([version === 1.2 ? SCHEMA_V12 : SCHEMA_V11, this.options.extraSchema]) // todo: cache
				: version === 1.2 ? SCHEMA_V12 : SCHEMA_V11
			)

		let doc = new this.documentClass(this, schema);
		(doc as any).version = version
		for (let k in this.namespaces) {
			doc.addNamespace(k, this.namespaces[k])
		}
		return doc
	}

	/**
	 * Called when the documents end (EOF / ...)
	 */
	public onDocumentEnd(document: YamlDocument): YamlDocument {
		return document
	}

	/**
	 * Called when a comment found
	 */
	public onComment(comment: string): void {

	}

	/**
	 * Called when error occured
	 */
	public onError(message: string, location: Location): void {
		throw new YamlError(message, location)
		// throw new Error(`${message} at ${location.file ? location.file + ":" : ""}${location.line},${location.column}`)
	}
}