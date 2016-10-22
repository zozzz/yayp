import {YamlDocument, Mapping, Sequence, Scalar} from "../document"
import {ISchema, TagFactory} from "./schema"


class MapFactory extends TagFactory {
	public createFromMapping(document: YamlDocument, value: Mapping): any {
		return value
	}
}


class SeqFactory extends TagFactory {
	public createFromSequence(document: YamlDocument, value: Sequence): any {
		return value
	}
}


class StrFactory extends TagFactory {
	public createFromScalar(document: YamlDocument, value: Scalar): any {
		return value
	}
}


const FACTORIES: {[key: string]: TagFactory} = {
	"map": new MapFactory,
	"seq": new SeqFactory,
	"str": new StrFactory
}


export class FailsafeSchema implements ISchema {
	public resolveTag(namespace: string, name: string): TagFactory | null {
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