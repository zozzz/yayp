import * as fs from "fs"
import * as path from "path"

import { expect } from "chai"
let getObjPath = require("get-object-path")

import { Loader, YamlDocument, TypeFactory, SCHEMA_V12, SchemaCollection, ISchema, Mapping, Sequence, Scalar, Schema } from "../src"
import { PatchedLoader } from "./patched"


type FixtureFile = {
	/**
	 * Fixture file path
	 */
	path: string
	/**
	 * Input YAML string
	 */
	yaml: string
	properties?: {
		/**
		 * Property path where sit the expected data
		 * default: documents[0].content
		 */
		property: string,
		/**
		 * Expected result in JSON format
		 */
		json: string
	}[]
	/**
	 * Test only this fixture
	 */
	only?: boolean,
	/**
	 * skip this
	 */
	skip?: boolean,
	schema: string
}


class FakeTF extends TypeFactory {
	public constructor(public qname: string) {
		super()
	}

	public onMappingStart(offset: number): Mapping {
		return { "$type": `!<${this.qname}>`, "$mapping": {} }
	}

	public onMappingKey(offset: number, mapping: Mapping, key: any, value: any): void {
		mapping["$mapping"][key] = value
	}

	public onSequenceStart(offset: number): any {
		return { "$type": `!<${this.qname}>`, "$sequence": [] }
	}

	public onSequenceEntry(offset: number, sequence: any, entry: any): void {
		sequence["$sequence"].push(entry)
	}

	public onScalar(offset: number, value: string): any {
		return `!<${this.qname}>[SCALAR](${value})`
	}

	public onQuotedString(offset: number, value: string, quote: string): any {
		return `!<${this.qname}>[QUOTED]${quote}${value}${quote}`
	}

	public onBlockString(offset: number, value: string): any {
		return `!<${this.qname}>[BLOCK](${value})`
	}

	public onTagStart(offset: number, qname: string): TypeFactory {
		return this.document.onTagStart(offset, qname)
	}
}


class TestSchema extends Schema {
	public resolveTag(qname: string): TypeFactory {
		return new FakeTF(qname)
	}
}


const TEST_DEFAULT_SCHEMA = new SchemaCollection([
	SCHEMA_V12,
	new TestSchema()
])


// console.log(require("util").inspect(TEST_DEFAULT_SCHEMA, { depth: 8 }))


abstract class TesterDocument extends YamlDocument {
	public constructor(parser, schema) {
		super(parser, schema)
	}

	public onMappingKey(offset: number, mapping, key, value) {
		if (key === null) {
			key = "<null>"
		} else if (Array.isArray(key) || `${key}` === "[object Object]") {
			key = JSON.stringify(key)
		}
		return super.onMappingKey(offset, mapping, key, value)
	}
}


class TestDefaultDoc extends TesterDocument {
	public constructor(parser) {
		super(parser, TEST_DEFAULT_SCHEMA)
	}
}


class TestTypeDoc extends TesterDocument {
	public onTagStart(offset: number, qname: string): TypeFactory {
		return new FakeTF(qname)
	}
}


type FixtureGroup = {
	[key: string]: FixtureGroup | FixtureFile
}


let fixtures: FixtureGroup = {}


function parseFile(fileName: string): { title: string[], file: FixtureFile } {
	let content = fs.readFileSync(fileName, "UTF-8")
	let rx = /#\s+---\s+\[(.*?)\](?:\s*([^\r\n]+))*?(?:\r?\n)/g
	let m: RegExpExecArray
	let result = {
		title: [fileName],
		file: {
			path: fileName,
			yaml: "",
			json: null,
			properties: [],
			only: false,
			skip: false,
			schema: "test-default"
		}
	}

	let yamlStart = 0

	while (m = rx.exec(content)) {
		switch (m[1]) {
			case "title":
				result.title = m[2].split(/\s*\/\s*/)
				yamlStart = m.index + m[0].length
				break

			case "only":
				result.file.only = true
				break

			case "skip":
				result.file.skip = true
				break

			case "schema":
				result.file.schema = m[2].trim()
				break

			case "success":
			case "error":
				if (!result.file.yaml) {
					result.file.yaml = content.slice(yamlStart, m.index)
				}

				if (result.file.properties.length > 0) {
					let p = result.file.properties[result.file.properties.length - 1]
					p.json = content.slice(p.json, m.index).trim()
				}

				if (m[2] && m[2].length) {
					result.file.properties.push({
						property: m[2],
						json: m.index + m[0].length
					})
				}
		}
	}

	if (result.file.properties.length > 0) {
		let p = result.file.properties[result.file.properties.length - 1]
		p.json = content.slice(p.json).trim()
	}

	return result
}


function addToFixtures(fileName: string) {
	let parsed = parseFile(fileName)
	let obj = fixtures
	let l = parsed.title.length

	// console.log(require("util").inspect(parsed, {depth:null}))

	for (let i = 0, k; i < l; ++i) {
		k = parsed.title[i]

		if (i !== l - 1) {
			if (!obj[k]) {
				obj[k] = {}
			}
			obj = <any>obj[k]
		} else {
			obj[k] = parsed.file
		}
	}
}


function createTestCase(file: FixtureFile): () => void {
	return () => {
		let p
		switch (file.schema) {
			case "test-default":
				p = new PatchedLoader(TestDefaultDoc, { allowMultipleDocuments: true })
				break

			case "test-type":
				p = new PatchedLoader(TestTypeDoc, { allowMultipleDocuments: true })
				break

			default:
				throw new Error(`Unexpected schema definition in ${file.path}`)
		}

		let l = {
			documents: p.load(file.yaml, file.path)
		}

		expect(file.properties, "Missing expected result").to.have.property("length").and.gt(0)

		// console.log(require("util").inspect(l, { depth: 3 }))

		for (let prop of file.properties) {
			let c = getObjPath(l, prop.property)
			c = JSON.parse(JSON.stringify(c))

			// console.log(require("util").inspect(c, { depth: null }))
			// console.log(require("util").inspect(JSON.parse(prop.json), { depth: null }))

			expect(c).to.be.eql(JSON.parse(prop.json))
		}
	}
}


function constructTestCases(group: Object) {
	function maked(value) {
		return () => {
			constructTestCases(value)
		}
	}

	for (let k in group) {
		if (group[k].path) {
			if (group[k].only) {
				it.only(`${k} - (${path.basename(group[k].path)})`, createTestCase(<FixtureFile>group[k]))
			} else if (!group[k].skip) {
				it(`${k} - (${path.basename(group[k].path)})`, createTestCase(<FixtureFile>group[k]))
			}
		} else {
			describe(k, maked(group[k]))
		}
	}
}


function addFromDirectory(dirPath: string) {
	for (let name of fs.readdirSync(dirPath)) {
		if (0 && name === "yaml-examples") {
			continue
		}
		let full = path.join(dirPath, name)
		if (fs.statSync(full).isDirectory()) {
			addFromDirectory(full)
		} else if (full.endsWith(".yml")) {
			addToFixtures(full)
		}
	}
}


addFromDirectory(path.join(__dirname, "fixtures"))



constructTestCases(fixtures)