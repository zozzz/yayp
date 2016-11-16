import { Loader, LoaderOptions } from "./loader"
import { YamlDocument } from "./document"


export type LoadOptions = LoaderOptions & {
	/**
	 * Use this document class to construct document(s) in the file
	 */
	document?: typeof YamlDocument,
	/**
	 * Use this filename in the error messages
	 */
	filename?: string
}


export function load(data: string, options: LoadOptions = {}) {
	options.allowMultipleDocuments = false
	return _load(data, options)
}


export function loadAll(data: string, options: LoadOptions = {}) {
	options.allowMultipleDocuments = true
	return _load(data, options)
}


function _load(data: string, options: LoadOptions) {
	let loader = new Loader(options.document || YamlDocument, options)
	let documents: YamlDocument[] = loader.load(data, options.filename)

	loader.dispose()

	if (options.allowMultipleDocuments) {
		let result = []
		for (let doc of documents) {
			result.push(doc.content)
			doc.dispose()
		}
		return result
	} else {
		let result = documents[0].content
		documents[0].dispose()
		return result
	}
}