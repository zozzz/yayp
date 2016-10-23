import {YamlDocument} from "../document"
import {Mapping, Sequence, Scalar} from "../node"
import {ISchema, TypeFactory} from "./schema"


class MapFactory extends TypeFactory {
	public onMappingStart(): Mapping {
		return {}
	}
}


class SeqFactory extends TypeFactory {
	public onSequenceStart(): Sequence {
		return []
	}
}


class StrFactory extends TypeFactory {
	public onScalar(value: string): any {
		return value
	}

	public onQuotedString(value: string, quote: string): any {
		return value
	}

	public onBlockString(value: string, isFolded: boolean): any {
		return value
	}
}


const FACTORIES: {[key: string]: TypeFactory} = {
	"map": new MapFactory,
	"seq": new SeqFactory,
	"str": new StrFactory
}


export class FailsafeSchema implements ISchema {
	public resolveTag(namespace: string, name: string): TypeFactory | null {
		if (namespace === "tag:yaml.org,2002:") {
			return FACTORIES[name]
		}
		return null
	}

	public resolveScalar(document: YamlDocument, value: Scalar) {
		return undefined
	}
}


export const SCHEMA_FAILSAFE = new FailsafeSchema