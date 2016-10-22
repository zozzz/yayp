import {YamlDocument, Mapping, Sequence, Scalar} from "../document"


export abstract class TagFactory {
	public createFromMapping(document: YamlDocument, value: Mapping): any {
		document.error("Unsupported value")
	}

	public createFromSequence(document: YamlDocument, value: Sequence): any {
		document.error("Unsupported value")
	}

	public createFromScalar(document: YamlDocument, value: Scalar): any {
		document.error("Unsupported value")
	}
}


export interface ISchema {
	resolveTag(namespace: string, name: string): TagFactory | null
	resolveScalar(document: YamlDocument, value: Scalar): any | undefined
}