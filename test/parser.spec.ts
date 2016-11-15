import { expect } from "chai"
import { Loader, YamlDocument, YamlError } from "../src"
import { PatchedLoader } from "./patched"


describe("Parser basics", () => {
	describe("Directive", () => {
		it("YAML", () => {
			let x = "%YAML 1.2\n---\n"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0].version).to.eql(1.2)
		})

		it("TAG / primary", () => {
			let x = "%TAG ! !local-"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0].namespaces).to.eql({
				"!!": "tag:yaml.org,2002:",
				"!": "!local-"
			})
		})

		it("TAG / secondary", () => {
			let x = "%TAG !! !local-"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0].namespaces).to.eql({
				"!!": "!local-"
			})
		})

		it("TAG / named 1", () => {
			let x = "%TAG !a! !local-"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0].namespaces).to.eql({
				"!!": "tag:yaml.org,2002:",
				"!a!": "!local-"
			})
		})

		it("TAG / named 2", () => {
			let x = "%TAG !local! !local-"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0].namespaces).to.eql({
				"!!": "tag:yaml.org,2002:",
				"!local!": "!local-"
			})
		})
	})

	describe("String parsing", () => {
		it("Single Quote 1", () => {
			let x = "'Hello World'"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Double Quote 1", () => {
			let x = "\"Hello World\""
			let d = new Loader(YamlDocument).load(x)
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Plain 1", () => {
			let x = "Hello World"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Plain 2", () => {
			let x = "Hello World:xy"
			let d = new Loader(YamlDocument).load(x)
			expect(d[0]).to.have.property("content").and.eql("Hello World:xy")
		})

		it("Block scalar EOF", () => {
			let x = `
|
a`
			let d = new Loader(YamlDocument).load(x)
			expect(d[0]).to.have.property("content").and.eql("a")
		})
	})

	describe("Errors", () => {
		var loader

		beforeEach(() => {
			loader = new PatchedLoader(YamlDocument)
		})

		describe("Directive YAML", () => {
			it("%YAML", () => {
				expect(() => { loader.load("%YAML") })
					.to.throw(YamlError, /^Missing or invalid YAML version/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 6, offset: 5, file: "<string>" })
			})

			it("%YAML X.Y", () => {
				expect(() => { loader.load("%YAML X.Y") })
					.to.throw(YamlError, /^Missing or invalid YAML version/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 7, offset: 6, file: "<string>" })
			})

			it("%YAML\\n", () => {
				expect(() => { loader.load("%YAML\n") })
					.to.throw(YamlError, /^Missing directive value/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 6, offset: 5, file: "<string>" })
			})
		})

		describe("Directive TAG", () => {
			it("%TAG\\n", () => {
				expect(() => { loader.load("%TAG\n") })
					.to.throw(YamlError, /^Missing directive value/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 5, offset: 4, file: "<string>" })
			})

			it("%TAG", () => {
				expect(() => { loader.load("%TAG") })
					.to.throw(YamlError, /^Missing or invalid tag handle/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 5, offset: 4, file: "<string>" })
			})

			it("%TAG 23", () => {
				expect(() => { loader.load("%TAG 23") })
					.to.throw(YamlError, /^Missing or invalid tag handle/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 6, offset: 5, file: "<string>" })

			})

			it("%TAG !e!", () => {
				expect(() => { loader.load("%TAG !e!") })
					.to.throw(YamlError, /^Missing or invalid tag uri/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 9, offset: 8, file: "<string>" })
			})

			it("%TAG ! ű", () => {
				expect(() => { loader.load("%TAG ! ű") })
					.to.throw(YamlError, /^Missing or invalid tag uri/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 8, offset: 7, file: "<string>" })
			})
		})

		it("Missing directive name", () => {
			expect(() => { loader.load("%") })
				.to.throw(YamlError, /^Missing directive name/)
				.and.has.property("location")
				.and.eql({ line: 1, column: 2, offset: 1, file: "<string>" })
		})

		describe("Block sequence in flow is not allowed", () => {
			it("In flow sequence", () => {
				expect(() => {
					loader.load(`
[
- 12
]
					`)
				})
					.to.throw(YamlError, /^Block sequence is not allowed/)
					.and.has.property("location")
					.and.eql({ line: 3, column: 1, offset: 3, file: "<string>" })
			})

			it("In flow mapping", () => {
				expect(() => {
					loader.load(`
{
xy: - 12
}
					`)
				})
					.to.throw(YamlError, /^Block sequence is not allowed/)
					.and.has.property("location")
					.and.eql({ line: 3, column: 5, offset: 7, file: "<string>" })
			})
		})

		describe("Flow sequence", () => {
			it("Unterminated", () => {
				expect(() => { loader.load("[1") })
					.to.throw(YamlError, /^Unterminated flow sequence/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 3, offset: 2, file: "<string>" })
			})

			it("Missing separator", () => {
				expect(() => { loader.load("['1' 2]") })
					.to.throw(YamlError, /^Unexpected character: '2' expected: ',', '\]'/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 6, offset: 5, file: "<string>" })
			})
		})

		describe("Flow Mapping", () => {
			it("Unterminated", () => {
				expect(() => { loader.load("{x: y") })
					.to.throw(YamlError, /^Unterminated flow mapping/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 6, offset: 5, file: "<string>" })
			})

			it("Missing separator", () => {
				expect(() => { loader.load("{x: 'y' c: v}") })
					.to.throw(YamlError, /^Unexpected character: 'c' expected: ',', '\}'/)
					.and.has.property("location")
					.and.eql({ line: 1, column: 9, offset: 8, file: "<string>" })
			})
		})
	})

})