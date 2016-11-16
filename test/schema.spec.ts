import { expect } from "chai"
import { YamlDocument, YamlError } from "../src"
import { PatchedLoader } from "./patched"
import { SCHEMA_COMMON, SCHEMA_JSON } from "../src"


describe("Schema", () => {
	describe("Common", () => {
		let loader: PatchedLoader

		beforeEach(() => {
			loader = new PatchedLoader(YamlDocument, { schema: SCHEMA_COMMON })
		})

		describe("String", () => {
			it("!!str is string", () => {
				let d = loader.load("!!str")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("")
			})

			it("!!str ''", () => {
				let d = loader.load("!!str ''")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("")
			})

			it("!!str \"\"", () => {
				let d = loader.load("!!str \"\"")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("")
			})

			it("!!str \\n|\\n hello world", () => {
				let d = loader.load("!!str \n|\n hello world")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("hello world")
			})

			it("!!str null", () => {
				let d = loader.load("!!str null")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("null")
			})

			it("!!str true", () => {
				let d = loader.load("!!str true")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("true")
			})

			it("!!str 42", () => {
				let d = loader.load("!!str 42")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("42")
			})
		})

		describe("Mapping", () => {
			it("!!map {}", () => {
				let d = loader.load("!!map {}")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.eql({})
			})

			it("!!map {hello: world}", () => {
				let d = loader.load("!!map {hello: world}")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.eql({ hello: "world" })
			})

			it("!!map [] -> unexpected", () => {
				expect(function () { loader.load("!!map []") })
					.to.throw(YamlError, /^Unexpected value \(sequence\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!map '' -> unexpected", () => {
				expect(function () { loader.load("!!map ''") })
					.to.throw(YamlError, /^Unexpected value \(string\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!map true -> unexpected", () => {
				expect(function () { loader.load("!!map true") })
					.to.throw(YamlError, /^Unexpected value \(scalar\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})
		})

		describe("Sequence", () => {
			it("!!seq []", () => {
				let d = loader.load("!!seq []")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.eql([])
			})

			it("!!seq [hello, world]", () => {
				let d = loader.load("!!seq [hello, world]")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.eql(["hello", "world"])
			})

			it("!!seq {} -> unexpected", () => {
				expect(function () { loader.load("!!seq {}") })
					.to.throw(YamlError, /^Unexpected value \(mapping\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!seq '' -> unexpected", () => {
				expect(function () { loader.load("!!seq ''") })
					.to.throw(YamlError, /^Unexpected value \(string\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!seq true -> unexpected", () => {
				expect(function () { loader.load("!!seq true") })
					.to.throw(YamlError, /^Unexpected value \(scalar\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!seq \\n|\\n hello world -> unexpected", () => {
				expect(function () { loader.load("!!seq \n|\n hello world") })
					.to.throw(YamlError, /^Unexpected value \(string\)/)
					.and.has.property("location")
					.and.eql({ line: 2, column: 1, offset: 7, file: "<string>" })
			})

			it("!!seq !!str OK -> unexpected", () => {
				expect(function () { loader.load("!!seq !!str OK") })
					.to.throw(YamlError, /^Unexpected value \(tag\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})
		})

		describe("Set", () => {
			it("!!set {x, y, z}", () => {
				let d = loader.load("!!set {x, y, z}")

				expect(d[0]).to.have.property("content").and.instanceOf(Set)
				expect(Array.from(d[0].content)).to.eql(["x", "y", "z"])
			})

			it("!!set {x: 10, y, z} -> error", () => {
				expect(function () { loader.load("!!set {x: 10, y, z}") })
					.to.throw(YamlError, /^Set is not a mapping/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 8, offset: 7, file: "<string>" })
			})

			it("!!set [x, y, z]", () => {
				let d = loader.load("!!set [x, y, z]")

				expect(d[0]).to.have.property("content").and.instanceOf(Set)
				expect(Array.from(d[0].content)).to.eql(["x", "y", "z"])
			})

			it("!!set '' -> unexpected", () => {
				expect(function () { loader.load("!!set ''") })
					.to.throw(YamlError, /^Unexpected value \(string\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("!!set true -> unexpected", () => {
				expect(function () { loader.load("!!set true") })
					.to.throw(YamlError, /^Unexpected value \(scalar\)/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})
		})

		describe("Binary", () => {
			it("!!binary aGVsbG8gd29ybGQ=", () => {
				let d = loader.load("!!binary aGVsbG8gd29ybGQ=")

				expect(d[0]).to.have.property("content").and.instanceOf(Buffer)
				expect(Array.from(d[0].content)).to.eql(Array.from(Buffer.from("hello world")))
			})

			it("!!binary 'aGVsbG8gd29ybGQ='", () => {
				let d = loader.load("!!binary 'aGVsbG8gd29ybGQ='")

				expect(d[0]).to.have.property("content").and.instanceOf(Buffer)
				expect(Array.from(d[0].content)).to.eql(Array.from(Buffer.from("hello world")))
			})

			it("!!binary \"aGVsbG8gd29ybGQ=\"", () => {
				let d = loader.load("!!binary 'aGVsbG8gd29ybGQ='")

				expect(d[0]).to.have.property("content").and.instanceOf(Buffer)
				expect(Array.from(d[0].content)).to.eql(Array.from(Buffer.from("hello world")))
			})
		})

		describe("Ordered map", () => {
			it("!!omap {hello: world, x: y}", () => {
				let d = loader.load("!!omap {hello: world, x: y}")

				expect(d[0]).to.have.property("content").and.eql([
					{ hello: "world" },
					{ x: "y" }
				])
			})

			it("!!omap [one: 1, two: 2, three : 3]", () => {
				let d = loader.load("!!omap [one: 1, two: 2, three : 3]")

				expect(d[0]).to.have.property("content").and.eql([
					{ one: "1" },
					{ two: "2" },
					{ three: "3" },
				])
			})

			it("!!omap [{}] -> error", () => {
				expect(() => { loader.load("!!omap [{}]") })
					.to.throw(YamlError, /^Empty key value pair not supported/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 9, offset: 8, file: "<string>" })
			})

			it("!!omap [{x: 1, y: 2}] -> error", () => {
				expect(() => { loader.load("!!omap [{x: 1, y: 2}]") })
					.to.throw(YamlError, /^Too many key value pair in ordered map/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 9, offset: 8, file: "<string>" })
			})
		})
	})

	describe("JSON", () => {
		let loader: PatchedLoader

		beforeEach(() => {
			loader = new PatchedLoader(YamlDocument, { schema: SCHEMA_JSON })
		})

		describe("Booleans", () => {
			it("true is boolean", () => {
				let d = loader.load("true")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(true)
			})

			it("false is boolean", () => {
				let d = loader.load("false")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(false)
			})

			it("True is scalar", () => {
				let d = loader.load("True")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("True")
			})

			it("False is scalar", () => {
				let d = loader.load("False")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("False")
			})
		})

		describe("Null", () => {
			it("null is null", () => {
				let d = loader.load("null")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(null)
			})

			it("Null is scalar", () => {
				let d = loader.load("Null")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("Null")
			})
		})

		describe("Integers", () => {
			it("1 is number", () => {
				let d = loader.load("1")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(1)
			})

			it("-1 is number", () => {
				let d = loader.load("-1")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(-1)
			})

			it("0x33 is scalar", () => {
				let d = loader.load("0x33")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("0x33")
			})

			it("0o33 is scalar", () => {
				let d = loader.load("0o33")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("0o33")
			})
		})

		describe("Floats", () => {
			it("1.0 is number", () => {
				let d = loader.load("1.0")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(1.0)
			})

			it("-0.1 is number", () => {
				let d = loader.load("-0.1")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(-0.1)
			})

			it("12.2e3 is number", () => {
				let d = loader.load("12.2e3")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(12.2e3)
			})

			it("12e3 is number", () => {
				let d = loader.load("12e3")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(12e3)
			})

			it("12.2e-3 is number", () => {
				let d = loader.load("12.2e-3")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(12.2e-3)
			})

			it("12.2e+3 is number", () => {
				let d = loader.load("12.2e+3")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(12.2e3)
			})

			it(".1 is scalar", () => {
				let d = loader.load(".1")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal(".1")
			})

			it("-.1 is scalar", () => {
				let d = loader.load("-.1")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("-.1")
			})

			it("1_2.2 is scalar", () => {
				let d = loader.load("1_2.2")

				expect(d.length).to.eq(1)
				expect(d[0]).to.have.property("content").and.equal("1_2.2")
			})
		})
	})
})