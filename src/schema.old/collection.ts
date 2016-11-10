import { YamlDocument } from "../document"
import { ISchema, TypeFactory } from "./schema"


export class SchemaCollection implements ISchema {
	public constructor(protected schemas: ISchema[]) {
	}

	public resolveTag(qname: string): TypeFactory | null {
		for (let s of this.schemas) {
			let factory = s.resolveTag(qname)
			if (factory) {
				return factory
			}
		}
		return null
	}

	public resolveScalar(document: YamlDocument, value: string) {
		for (let s of this.schemas) {
			let result = s.resolveScalar(document, value)
			if (result !== undefined) {
				return result
			}
		}
		return undefined
	}
}