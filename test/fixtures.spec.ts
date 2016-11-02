import * as fs from "fs"
import * as path from "path"

import { expect } from "chai"
let getObjPath = require("get-object-path")

import { Loader, YamlDocument, TypeFactory, SCHEMA_CORE, SchemaCollection, ISchema, Mapping, Sequence, Scalar } from "../src"


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
	only?: boolean
}


class FakeTF extends TypeFactory {
	public constructor(public qname: string) {
		super()
	}

	public onMappingStart(): Mapping {
		return { "$type": `!<${this.qname}>`, "$mapping": {} }
	}

	public onMappingKey(mapping: Mapping, key: any, value: any): void {
		mapping["$mapping"][key] = value
	}

	public onSequenceStart(): any {
		return { "$type": `!<${this.qname}>`, "$sequence": [] }
	}

	public onSequenceEntry(sequence: any, entry: any): void {
		sequence["$sequence"].push(entry)
	}

	public onScalar(value: string): any {
		return `!<${this.qname}>[SCALAR](${value})`
	}

	public onQuotedString(value: string, quote: string): any {
		return `!<${this.qname}>[QUOTED]${quote}${value}${quote}`
	}

	public onBlockString(value: string): any {
		return `!<${this.qname}>[BLOCK](${value})`
	}

	public onTagStart(qname: string): TypeFactory {
		return this.document.onTagStart(qname)
	}
}


class TestSchema implements ISchema {
	public resolveTag(qname: string): TypeFactory {
		return new FakeTF(qname)
	}

	public resolveScalar() {
		return undefined
	}
}


const TEST_SCHEMA = new SchemaCollection([
	SCHEMA_CORE,
	new TestSchema()
])


class TesterDocument extends YamlDocument {
	public constructor(parser) {
		super(parser, TEST_SCHEMA)
	}

	public onMappingKey(mapping, key, value) {
		if (key === null) {
			key = "<null>"
		}
		return super.onMappingKey(mapping, key, value)
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
			only: false
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
		let p = new Loader(TesterDocument)
		let l = {
			documents: p.load(file.yaml, file.path)
		}

		// console.log(require("util").inspect(file, {depth: null}))

		for (let prop of file.properties) {
			let c = getObjPath(l, prop.property)
			c = JSON.parse(JSON.stringify(c))

			console.log(require("util").inspect(c, { depth: null }))
			console.log(require("util").inspect(JSON.parse(prop.json), { depth: null }))

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
			} else {
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