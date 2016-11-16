// Generated by dts-bundle v0.6.1

declare module 'yayp' {
    export { Parser } from "yayp/parser";
    export { Loader, YamlError } from "yayp/loader";
    export * from "yayp/document";
    export * from "yayp/schema";
    export * from "yayp/handler";
    export * from "yayp/shorthands";
}

declare module 'yayp/parser' {
    import { YamlDocument } from "yayp/document";
    import { Loader } from "yayp/loader";
    import { ITypeFactory } from "yayp/handler";
    export type Cursor = {
        line: number;
        col: number;
    };
    export type Location = {
        file: string;
        column: number;
        line: number;
        offset: number;
    };
    export const enum State {
        ONLY_COMPACT_MAPPING = 1,
        IN_EXPLICIT_KEY = 2,
        IN_IMPLICIT_KEY = 4,
        IN_FLOW_SEQ = 8,
        IN_FLOW_MAP = 16,
        IN_BLOCK_MAP = 32,
        IN_BLOCK_SEQ = 64,
        IN_NODE = 126,
        IN_FLOW = 24,
        NO_BLOCK_MAPPING = 20,
        MAPPING_KEY = 6,
        ALLOW_NL_IN_KEY = 18,
    }
    export class Parser {
        protected loader: Loader;
        fileName: string;
        protected offset: number;
        protected data: string;
        protected documents: YamlDocument[];
        protected doc: YamlDocument;
        protected linePosition: number;
        constructor(loader: Loader);
        parse(data: string, fileName: string): YamlDocument[];
        getLocation(offset?: number): Location;
        protected readonly column: number;
        protected parseFile(): any;
        protected parseDocument(): boolean;
        protected parseValue(handler: ITypeFactory, state: State, minColumn?: number): any;
        protected isDocumentSeparator(offset: number): boolean;
        protected isDocumentStart(offset: number): boolean;
        protected isDocumentEnd(offset: number): boolean;
        protected directive(): void;
        protected blockSequence(handler: ITypeFactory, state: State): any;
        protected flowSequence(handler: ITypeFactory, state: State): any;
        protected flowMapping(handler: ITypeFactory, state: State): any;
        protected scalar(handler: ITypeFactory, state: State): any;
        protected quotedString(handler: ITypeFactory, state: State, quote: string): any;
        protected isBlockMappingKey(state: State): boolean;
        protected blockMapping(offset: number, handler: ITypeFactory, state: State, column: number, mappingKey: any): any;
        protected mappingKey(state: State): any;
        protected explicitKey(handler: ITypeFactory, state: State): any;
        protected tag(handler: ITypeFactory, state: State): any;
        protected anchor(handler: ITypeFactory, state: State): any;
        protected alias(): any;
        protected unexpected(expected?: string | string[]): void;
        protected error(message: string, offset?: number): void;
        protected read(rx: RegExp): string;
        /**
          * Skip all non breaking space like tab or space
          */
        protected eatNBS(): void;
        protected readScalar(state: State): string;
        protected blockScalar(handler: ITypeFactory, state: State, minColumn: number, isFolded: boolean): any;
        protected readQuotedString(terminal: string): string;
    }
}

declare module 'yayp/loader' {
    import { YamlDocument } from "yayp/document";
    import { Parser, Location } from "yayp/parser";
    import { ISchema } from "yayp/schema";
    export interface TagDirective {
            handle: string;
            namespace: string;
    }
    export type LoaderOptions = {
            /**
                * If YAML document dont specifiy the version in directives, than use
                * this version value.
                *
                * default value: 1.2
                */
            defaultVersion?: number;
            /**
                * Always use this version in documents.
                *
                * default value: -
                */
            forcedVersion?: number;
            /**
                * Use this schema + version schema in documents.
                *
                * default value: -
                */
            extraSchema?: ISchema;
            /**
                * Only use this schema in documents.
                *
                * default value: -
                */
            schema?: ISchema;
            /**
                * Control parser ot call the onComment method or not.
                *
                * default value: false
                */
            needComments?: boolean;
            /**
                * Control loader to allow multiple documents in the same file
                *
                * default value: false
                */
            allowMultipleDocuments?: boolean;
    };
    export class YamlError extends Error {
            location: Location;
            constructor(message: string, location: Location, content?: string);
    }
    export class Loader {
            readonly documentClass: typeof YamlDocument;
            options: LoaderOptions;
            readonly parser: Parser;
            protected namespaces: {
                    [key: string]: string;
            };
            protected version: number;
            protected docCount: number;
            constructor(documentClass: typeof YamlDocument, options?: LoaderOptions);
            load(data: string, fileName?: string): YamlDocument[];
            /**
                * Called when the directive found, not test if the directive is available
                * in the YAML spec.
                */
            onDirective(name: string, value: any): void;
            /**
                * Called when starts a new document
                */
            onDocumentStart(): YamlDocument;
            /**
                * Called when the documents end (EOF / ...)
                */
            onDocumentEnd(document: YamlDocument): YamlDocument;
            /**
                * Called when a comment found
                */
            onComment(comment: string): void;
            /**
                * Called when error occured
                */
            onError(message: string, location: Location): void;
            dispose(): void;
    }
}

declare module 'yayp/document' {
    import { Loader } from "yayp/loader";
    import { ISchema, TypeFactory } from "yayp/schema";
    import { IDocumentHandler } from "yayp/handler";
    export class YamlDocument implements IDocumentHandler {
            readonly loader: Loader;
            readonly schema: ISchema;
            readonly version: number;
            readonly content: any;
            readonly namespaces: {
                    [key: string]: string;
            };
            protected references: {
                    [key: string]: any;
            };
            constructor(loader: Loader, schema: ISchema);
            addNamespace(handle: string, namespace: string): void;
            getNamespace(handle: string): string;
            /**
                * Called when the mapping start (inline / block) and must return
                * something that store key / value pairs
                */
            onMappingStart(offset: number): any;
            /**
                * Called when the mapping parsed and return value used as final
                * mapping object
                */
            onMappingEnd(mapping: any): any;
            /**
                * Called when a mapping key found
                */
            onMappingKey(offset: number, mapping: any, key: any, value: any): void;
            /**
                * Called when a sequence start (inline / block) and must return
                * sumething that store numerical indexed entries
                */
            onSequenceStart(offset: number): any;
            /**
                * Called when the sequence parsed and return value uased as final
                * sequence object
                */
            onSequenceEnd(sequence: any): any;
            /**
                * Called when an sequence entry is found
                */
            onSequenceEntry(offset: number, sequence: any, entry: any): void;
            /**
                * Called when a tag start, and must return a factory function
                * or NULL when not found a factory function
                */
            onTagStart(offset: number, qname: string): TypeFactory;
            /**
                * Called when a tag is parsed and return value uased as final
                * tag object
                */
            onTagEnd(value: any): any;
            /**
                * Called when a anchor found (&anchor)
                */
            onAnchor(offset: number, name: string, value: any): void;
            /**
                * Called when an alias found (*alias)
                */
            onAlias(offset: number, name: string): any;
            /**
                * Called when an unqouted string found
                */
            onScalar(offset: number, value: string): any;
            /**
                * Called when a single or double qouted string found
                */
            onQuotedString(offset: number, value: string, quote: string): any;
            /**
                * Called when a block string found
                */
            onBlockString(offset: number, value: string): any;
            error(message: string, offset?: number): void;
            dispose(): void;
    }
}

declare module 'yayp/schema' {
    export * from "yayp/schema/schema";
    export * from "yayp/schema/type";
    export * from "yayp/schema/scalar";
    export * from "yayp/schema/collection";
    export * from "yayp/schema/basic";
    export * from "yayp/schema/json";
    export * from "yayp/schema/version-1.1";
    export * from "yayp/schema/version-1.2";
}

declare module 'yayp/handler' {
    export interface IMappingHandler {
            /**
                * Called when the mapping start (inline / block) and must return
                * something that store key / value pairs
                */
            onMappingStart(offset: number): any;
            /**
                * Called when the mapping parsed and return value used as final
                * mapping object
                */
            onMappingEnd(mapping: any): any;
            /**
                * Called when a mapping key found
                */
            onMappingKey(offset: number, mapping: any, key: any, value: any): void;
    }
    export interface ISequenceHandler {
            /**
                * Called when a sequence start (inline / block) and must return
                * sumething that store numerical indexed entries
                */
            onSequenceStart(offset: number): any;
            /**
                * Called when the sequence parsed and return value uased as final
                * sequence object
                */
            onSequenceEnd(sequence: any): any;
            /**
                * Called when an sequence entry is found
                */
            onSequenceEntry(offset: number, sequence: any, entry: any): void;
    }
    export interface IScalarHandler {
            /**
                * Called when an unqouted string found
                */
            onScalar(offset: number, value: string | null): any;
            /**
                * Called when a single or double qouted string found
                */
            onQuotedString(offset: number, value: string, quote: string): any;
            /**
                * Called when a block string found
                */
            onBlockString(offset: number, value: string): any;
    }
    export interface ITagHandler {
            /**
                * Called when a tag start, and must return a factory function
                * or NULL when not found a factory function
                */
            onTagStart(offset: number, qname: string): ITypeFactory;
            /**
                * Called when a tag is parsed and return value uased as final
                * tag object
                */
            onTagEnd(value: any): any;
    }
    export interface IReferenceHandler {
            /**
                * Called when a anchor found (&anchor)
                */
            onAnchor(offset: number, name: string, value: any): void;
            /**
                * Called when an alias found (*alias)
                */
            onAlias(offset: number, name: string): any;
    }
    export interface ITypeFactory extends IMappingHandler, ISequenceHandler, IScalarHandler, ITagHandler {
    }
    export interface IDocumentHandler extends ITypeFactory, IReferenceHandler {
    }
}

declare module 'yayp/shorthands' {
    import { LoaderOptions } from "yayp/loader";
    import { YamlDocument } from "yayp/document";
    export type LoadOptions = LoaderOptions & {
            /**
                * Use this document class to construct document(s) in the file
                */
            document?: typeof YamlDocument;
            /**
                * Use this filename in the error messages
                */
            filename?: string;
    };
    export function load(data: string, options?: LoadOptions): any;
    export function loadAll(data: string, options?: LoadOptions): any;
}

declare module 'yayp/schema/schema' {
    import { ScalarResolverSet } from "yayp/schema/scalar";
    import { TypeFactory } from "yayp/schema/type";
    export type TagMap = {
            [key: string]: TypeFactory;
    };
    export interface ISchema {
            /**
                * The system use this member to speed up well qualified name resolves, like: tag:yaml.org,2002:null
                */
            readonly tags: TagMap;
            readonly scalars: ScalarResolverSet;
            /**
                * Fallback only, called when the computed tags, does not contains
                * the specified qualified tag name
                */
            resolveTag(qname: string): TypeFactory | null;
    }
    export class Schema implements ISchema {
            readonly tags: TagMap;
            readonly scalars: ScalarResolverSet;
            constructor(tags?: TagMap, scalars?: ScalarResolverSet);
            resolveTag(qname: string): TypeFactory | null;
    }
}

declare module 'yayp/schema/type' {
    import { YamlDocument } from "yayp/document";
    import { ITypeFactory } from "yayp/handler";
    export abstract class TypeFactory implements ITypeFactory {
        document: YamlDocument;
        onMappingStart(offset: number): any;
        onMappingEnd(mapping: any): any;
        onMappingKey(offset: number, mapping: any, key: any, value: any): void;
        onSequenceStart(offset: number): any;
        onSequenceEnd(sequence: any): any;
        onSequenceEntry(offset: number, sequence: any, entry: any): void;
        onScalar(offset: number, value: string): any;
        onQuotedString(offset: number, value: string, quote: string): any;
        onBlockString(offset: number, value: string): any;
        onTagStart(offset: number, qname: string): TypeFactory;
        onTagEnd(value: any): any;
    }
}

declare module 'yayp/schema/scalar' {
    import { YamlDocument } from "yayp/document";
    import { TypeFactory } from "yayp/schema/type";
    export abstract class ScalarResolver {
            readonly decision: number[];
            constructor(decision: string);
            abstract resolve(document: YamlDocument, value: string): any;
    }
    /**
        * usage:
        * ScalarToNull = new ScalarValueMap({"null": null, "Null": null})
        */
    export class ScalarValueMap extends ScalarResolver {
            readonly valueMapping: {
                    [key: string]: any;
            };
            constructor(valueMapping: {
                    [key: string]: any;
            });
            resolve(document: YamlDocument, value: string): any;
    }
    export type ScalarRegexConverter = (match: RegExpMatchArray, document: YamlDocument) => any;
    /**
        * usage:
        * ScalarToInt = new ScalarRegexMatch("+-0123456789", /^[+-]?[1-9][0-9]+$/, (m) => parseInt(m[0]))
        */
    export class ScalarRegexMatch extends ScalarResolver {
            converter: ScalarRegexConverter;
            rx: RegExp;
            constructor(decision: string, rx: RegExp | string, converter: ScalarRegexConverter);
            resolve(document: YamlDocument, value: string): any;
    }
    /**
        * usage:
        * Int = new ScalarResolverAsType(ScalarToInt)
        */
    export class ScalarResolverAsType extends TypeFactory {
            sr: ScalarResolver;
            constructor(sr: ScalarResolver);
            onScalar(offset: number, value: string): any;
            onQuotedString(offset: number, value: string, quote: string): any;
    }
    /**
        * usage:
        * JsonScalars = new ScalarResolverSet([ScalarToNull, ScalarToInt])
        */
    export class ScalarResolverSet {
            readonly resolvers: ScalarResolver[];
            protected map: ScalarResolver[][];
            constructor(resolvers?: ScalarResolver[]);
            resolve(document: YamlDocument, value: string): any;
            merge(other: ScalarResolverSet | ScalarResolverSet[] | ScalarResolver[]): ScalarResolverSet;
    }
}

declare module 'yayp/schema/collection' {
    import { ScalarResolverSet } from "yayp/schema/scalar";
    import { TypeFactory } from "yayp/schema/type";
    import { ISchema, TagMap } from "yayp/schema/schema";
    export class SchemaCollection implements ISchema {
        schemas: ISchema[];
        readonly tags: TagMap;
        readonly scalars: ScalarResolverSet;
        constructor(schemas: ISchema[]);
        resolveTag(qname: string): TypeFactory | null;
    }
}

declare module 'yayp/schema/basic' {
    import { SchemaCollection } from "yayp/schema/collection";
    import { SCHEMA_FAILSAFE } from "yayp/schema/basic/types";
    export { SCHEMA_FAILSAFE };
    export const SCHEMA_COMMON: SchemaCollection;
}

declare module 'yayp/schema/json' {
    import { SchemaCollection } from "yayp/schema/collection";
    export const SCHEMA_JSON: SchemaCollection;
}

declare module 'yayp/schema/version-1.1' {
    import { SchemaCollection } from "yayp/schema/collection";
    export const SCHEMA_V11: SchemaCollection;
}

declare module 'yayp/schema/version-1.2' {
    import { SchemaCollection } from "yayp/schema/collection";
    export const SCHEMA_V12: SchemaCollection;
}

declare module 'yayp/schema/basic/types' {
    import { Schema } from "yayp/schema/schema";
    export const SCHEMA_FAILSAFE: Schema;
    export const CommonTypes: Schema;
}

