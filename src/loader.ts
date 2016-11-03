import { readFileSync, realpathSync } from "fs"

import { YamlDocument, YamlDocumentClass } from "./document"
import { Parser, Location } from "./parser"
import { SCHEMA_CORE } from "./schema"


export interface TagDirective {
	handle: string
	namespace: string
}


export class Loader {
	public readonly parser = new Parser(this)
	protected namespaces: { [key: string]: string } = {}
	protected version: number

	public constructor(public readonly documentClass: YamlDocumentClass) {
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
		let doc = new this.documentClass(this, SCHEMA_CORE);
		(doc as any).version = this.version
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
		throw new Error(`${message} at ${location.file ? location.file + ":" : ""}${location.line},${location.column}`)
	}
}