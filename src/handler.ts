import { Mapping, Sequence, Scalar } from "./node"
import { TypeFactory } from "./schema"


export interface IMappingHandler {
	/**
	 * Called when the mapping start (inline / block) and must return
	 * something that store key / value pairs
	 */
	onMappingStart(): Mapping

	/**
	 * Called when the mapping parsed and return value used as final
	 * mapping object
	 */
	onMappingEnd(mapping: Mapping): Mapping

	/**
	 * Called when a mapping key found
	 */
	onMappingKey(mapping: Mapping, key: any, value: any): void
}


export interface ISequenceHandler {
	/**
	 * Called when a sequence start (inline / block) and must return
	 * sumething that store numerical indexed entries
	 */
	onSequenceStart(): Sequence

	/**
	 * Called when the sequence parsed and return value uased as final
	 * sequence object
	 */
	onSequenceEnd(sequence: Sequence): Sequence

	/**
	 * Called when an sequence entry is found
	 */
	onSequenceEntry(sequence: Sequence, entry: any): void
}


export interface IScalarHandler {
	/**
	 * Called when an unqouted string found
	 */
	onScalar(value: string): any

	/**
	 * Called when a single or double qouted string found
	 */
	onQuotedString(value: string, quote: string): any

	/**
	 * Called when a block string found
	 */
	onBlockString(value: string): any
}


export interface ITagHandler {
	/**
	 * Called when a tag start, and must return a factory function
	 * or NULL when not found a factory function
	 */
	onTagStart(qname: string): TypeFactory

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
	onAnchor(name: string, value: any): void

	/**
	 * Called when an alias found (*alias)
	 */
	onAlias(name: string): any
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

