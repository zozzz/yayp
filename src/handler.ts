import { Mapping, Sequence, Scalar } from "./node"
import { TypeFactory } from "./schema"


export interface IMappingHandler {
	/**
	 * Called when the mapping start (inline / block) and must return
	 * something that store key / value pairs
	 */
	onMappingStart(offset: number): any

	/**
	 * Called when the mapping parsed and return value used as final
	 * mapping object
	 */
	onMappingEnd(mapping: any): any

	/**
	 * Called when a mapping key found
	 */
	onMappingKey(offset: number, mapping: any, key: any, value: any): void
}


export interface ISequenceHandler {
	/**
	 * Called when a sequence start (inline / block) and must return
	 * sumething that store numerical indexed entries
	 */
	onSequenceStart(offset: number): any

	/**
	 * Called when the sequence parsed and return value uased as final
	 * sequence object
	 */
	onSequenceEnd(sequence: any): any

	/**
	 * Called when an sequence entry is found
	 */
	onSequenceEntry(offset: number, sequence: any, entry: any): void
}


export interface IScalarHandler {
	/**
	 * Called when an unqouted string found
	 */
	onScalar(offset: number, value: string | null): any

	/**
	 * Called when a single or double qouted string found
	 */
	onQuotedString(offset: number, value: string, quote: string): any

	/**
	 * Called when a block string found
	 */
	onBlockString(offset: number, value: string): any
}


export interface ITagHandler {
	/**
	 * Called when a tag start, and must return a factory function
	 * or NULL when not found a factory function
	 */
	onTagStart(offset: number, qname: string): TypeFactory

	/**
	 * Called when a tag is parsed and return value uased as final
	 * tag object
	 */
	onTagEnd(value: any): any
}


export interface IReferenceHandler {
	/**
	 * Called when a anchor found (&anchor)
	 */
	onAnchor(offset: number, name: string, value: any): void

	/**
	 * Called when an alias found (*alias)
	 */
	onAlias(offset: number, name: string): any
}


export interface ITypeFactory extends
	IMappingHandler,
	ISequenceHandler,
	IScalarHandler,
	ITagHandler {

}


export interface IDocumentHandler extends
	ITypeFactory,
	IReferenceHandler {
}

