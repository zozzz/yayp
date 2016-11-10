import { YamlDocument } from "../document"
import { Mapping, Sequence, Scalar } from "../node"
import { ITypeFactory } from "../handler"


export abstract class TypeFactory implements ITypeFactory {
	public document: YamlDocument

	public onMappingStart(): Mapping {
		this.document.error("Unsupported value")
		return null
	}

	public onMappingEnd(mapping: Mapping): Mapping {
		return mapping
	}

	public onMappingKey(mapping: Mapping, key: any, value: any): void {
		mapping[key] = value
	}

	public onSequenceStart(): Sequence {
		this.document.error("Unsupported value")
		return null
	}

	public onSequenceEnd(sequence: Sequence): Sequence {
		return sequence
	}

	public onSequenceEntry(sequence: Sequence, entry: any): void {
		sequence.push(entry)
	}

	public onScalar(value: string): any {
		this.document.error("Unsupported value")
	}

	public onQuotedString(value: string, quote: string): any {
		this.document.error("Unsupported value")
	}

	public onBlockString(value: string): any {
		this.document.error("Unsupported value")
	}

	public onTagStart(qname: string): TypeFactory {
		this.document.error("Unsupported value")
		return null
	}

	public onTagEnd(value: any): any {
		return value
	}
}


export interface ISchema {
	resolveTag(qname: string): TypeFactory | null
	resolveScalar(document: YamlDocument, value: Scalar): any | undefined
}