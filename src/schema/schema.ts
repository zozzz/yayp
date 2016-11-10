import { YamlDocument } from "../document"
import { ScalarResolverSet } from "./scalar"
import { TypeFactory } from "./type"


export type TagMap = { [key: string]: TypeFactory }


export interface ISchema {
	/**
	 * The system use this member to speed up well qualified name resolves, like: tag:yaml.org,2002:null
	 */
	readonly tags: TagMap
	readonly scalars: ScalarResolverSet

	/**
	 * Fallback only, called when the computed tags, does not contains
	 * the specified qualified tag name
	 */
	resolveTag(qname: string): TypeFactory | null
}


export class Schema implements ISchema {
	public constructor(public readonly tags: TagMap = {},
		public readonly scalars: ScalarResolverSet = new ScalarResolverSet()) {
	}

	public resolveTag(qname: string): TypeFactory | null {
		return null
	}
}