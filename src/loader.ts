import {readFileSync, realpathSync} from "fs"

import {YamlDocument, YamlDocumentClass} from "./document"
import {Parser, Location} from "./parser"


export class Loader {
	public readonly parser = new Parser(this)

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
	 * Called when starts a new document
	 */
	public onDocumentStart(): YamlDocument {
		return new this.documentClass(this)
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