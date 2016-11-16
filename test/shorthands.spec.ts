import { expect } from "chai"
import { load, loadAll, YamlError } from "../src"


describe("Shorthands", () => {
	describe("load", () => {
		it("return one document content", () => {
			expect(load("42")).to.be.eql(42)
		})

		it("handle document end", () => {
			expect(load(`\n42\n...`)).to.be.eql(42)
		})

		it("handle document start", () => {
			expect(load(`---\n42\n`)).to.be.eql(42)
		})

		it("handle document start / end", () => {
			expect(load(`---\n42\n...`)).to.be.eql(42)
		})

		it("error multiple documents", () => {
			expect(() => {
				load(`
document 1
---
document 2
`)
			}).to.throw(YamlError, /^Multiple documents found at/)
				.and.has.property("location")
				.and.eql({ line: 4, column: 1, offset: 16, file: "<string>" })
		})
	})

	describe("loadAll", () => {
		it("load one document", () => {
			expect(loadAll("42")).to.be.eql([42])
		})

		it("load two documents", () => {
			expect(loadAll("42\n...\n---\n24")).to.be.eql([42, 24])
		})
	})
})