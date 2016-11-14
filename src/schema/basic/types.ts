import { TypeFactory, Mapping, Sequence } from "../type"
import { Schema } from "../schema"


class YamlMap extends TypeFactory {
	public onMappingStart(): Mapping {
		return {}
	}
}


class YamlOMap extends TypeFactory {
	public onMappingStart(): Mapping {
		return []
	}

	public onMappingKey(offset: number, omap: any, key: string, value: any) {
		omap.push({ [key]: value })
	}

	public onSequenceStart(): Sequence {
		return []
	}

	public onSequenceEntry(offset: number, sequence: Sequence, entry: any): void {
		if (`${entry}` === "[object Object]") { // TODO: need a better way
			switch (Object.keys(entry).length) {
				case 1:
					sequence.push(entry)
					break

				case 0:
					this.document.error("Empty key value pair not supported", offset)
					break

				default:
					this.document.error("Too many key value pair in ordered map", offset)
					break
			}
		}
	}
}


class YamlSeq extends TypeFactory {
	public onSequenceStart(): Sequence {
		return []
	}
}


class YamlStr extends TypeFactory {
	public onScalar(offset: number, value: string): any {
		return value ? value : ""
	}

	public onQuotedString(offset: number, value: string, quote: string): any {
		return value
	}

	public onBlockString(offset: number, value: string): any {
		return value
	}
}


class YamlSet extends TypeFactory {
	public onMappingStart(offset: number) {
		return new Set()
	}

	public onMappingKey(offset: number, set: Set<any>, entry: any, value: any) {
		if (value !== null) {
			this.document.error("Set is not a mapping, and not allow to specify value for keys", offset)
		} else {
			set.add(entry)
		}
	}

	public onSequenceStart(offset: number) {
		return new Set()
	}

	public onSequenceEntry(offset: number, sequence: any, entry: any): void {
		sequence.add(entry)
	}
}


class YamlBinary extends TypeFactory {
	public onScalar(offset: number, value: string): any {
		return this.createFromBase64(value)
	}

	public onQuotedString(offset: number, value: string): any {
		return this.createFromBase64(value)
	}

	public onBlockString(offset: number, value: string): any {
		return this.createFromBase64(value)
	}

	protected createFromBase64(data: string) {
		return Buffer.from(data.replace(/\s+/, ""), "base64")
	}
}


export const SCHEMA_FAILSAFE = new Schema({
	"tag:yaml.org,2002:map": new YamlMap(),
	"tag:yaml.org,2002:seq": new YamlSeq(),
	"tag:yaml.org,2002:str": new YamlStr()
})


export const CommonTypes = new Schema({
	"tag:yaml.org,2002:set": new YamlSet(),
	"tag:yaml.org,2002:omap": new YamlOMap(),
	"tag:yaml.org,2002:pairs": new YamlSeq(),
	"tag:yaml.org,2002:binary": new YamlBinary()
})