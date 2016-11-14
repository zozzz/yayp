import { YamlDocument } from "../document"
import { Mapping, Sequence, Scalar } from "../node"
import { ITypeFactory } from "../handler"
export { Mapping, Sequence, Scalar }


export abstract class TypeFactory implements ITypeFactory {
	public document: YamlDocument

	public onMappingStart(offset: number): any {
		this.document.error("Unexpected value (mapping)", offset)
	}

	public onMappingEnd(mapping: any): any {
		return mapping
	}

	public onMappingKey(offset: number, mapping: any, key: any, value: any): void {
		mapping[key] = value
	}

	public onSequenceStart(offset: number): any {
		this.document.error("Unexpected value (sequence)", offset)
	}

	public onSequenceEnd(sequence: any): any {
		return sequence
	}

	public onSequenceEntry(offset: number, sequence: any, entry: any): void {
		sequence.push(entry)
	}

	public onScalar(offset: number, value: string): any {
		this.document.error("Unexpected value (scalar)", offset)
	}

	public onQuotedString(offset: number, value: string, quote: string): any {
		this.document.error("Unexpected value (string)", offset)
	}

	public onBlockString(offset: number, value: string): any {
		this.document.error("Unexpected value (string)", offset)
	}

	public onTagStart(offset: number, qname: string): TypeFactory {
		this.document.error("Unexpected value (tag)", offset)
		return null
	}

	public onTagEnd(value: any): any {
		return value
	}
}





