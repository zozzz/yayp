import { ScalarResolverSet } from "./scalar"
import { TypeFactory } from "./type"
import { ISchema, TagMap } from "./schema"


export class SchemaCollection implements ISchema {
	public readonly tags: TagMap = {}
	public readonly scalars: ScalarResolverSet = new ScalarResolverSet()

	public constructor(public schemas: ISchema[]) {
		for (let schema of schemas) {
			Object.assign(this.tags, schema.tags)
			this.scalars = this.scalars.merge(schema.scalars)
		}
	}

	public resolveTag(qname: string): TypeFactory | null {
		let result
		for (let schema of this.schemas) {
			if (result = schema.resolveTag(qname)) {
				return result
			}
		}
		return null
	}
}