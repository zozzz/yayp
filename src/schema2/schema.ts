import { ScalarResolverSet } from "./scalar"
import { TypeFactory } from "./type"


export type TagMap = { [key: string]: TypeFactory }


export class Schema {
	public constructor(public readonly tags: TagMap, public readonly scalars: ScalarResolverSet) {
	}
}