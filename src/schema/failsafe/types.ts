import { TypeFactory, Mapping, Sequence } from "../type"
import { Schema } from "../schema"


class Map extends TypeFactory {
	public onMappingStart(): Mapping {
		return {}
	}
}


class Seq extends TypeFactory {
	public onSequenceStart(): Sequence {
		return []
	}
}


class Str extends TypeFactory {
	public onScalar(value: string): any {
		return value
	}

	public onQuotedString(value: string, quote: string): any {
		return value
	}

	public onBlockString(value: string): any {
		return value
	}
}


export const SCHEMA_FAILSAFE = new Schema({
	"tag:yaml.org,2002:map": new Map(),
	"tag:yaml.org,2002:seq": new Seq(),
	"tag:yaml.org,2002:str": new Str(),
})