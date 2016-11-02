import { YamlDocument } from "../document"
import { Mapping, Sequence, Scalar } from "../node"
import { ISchema, TypeFactory } from "./schema"


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

	public onBlockString(value: string): any {
		return value
	}

	public onTagStart(qname: string): TypeFactory {
		return this.document.onTagStart(qname)
	}

	public onTagEnd(value: any): any {
		if (typeof value.toString === "function") {
			return value.toString();
		}
		return `${value}`
	}
}


const FACTORIES: { [key: string]: TypeFactory } = {
	"tag:yaml.org,2002:map": new MapFactory,
	"tag:yaml.org,2002:set": new MapFactory,
	"tag:yaml.org,2002:seq": new SeqFactory,
	"tag:yaml.org,2002:omap": new SeqFactory,
	"tag:yaml.org,2002:str": new StrFactory
}


export class FailsafeSchema implements ISchema {
	public resolveTag(qname: string): TypeFactory | null {
		return FACTORIES[qname] || null
	}

	public resolveScalar(document: YamlDocument, value: Scalar) {
		return undefined
	}
}


export const SCHEMA_FAILSAFE = new FailsafeSchema