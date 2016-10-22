import {expect} from "chai"
import {Loader, YamlDocument} from "../src"


class Document extends YamlDocument {
	public directives = []

	public onDirective(name: string, value: any): void {
		this.directives.push({[name]: value})
		return super.onDirective(name, value)
	}
}


describe("Parser basics", () => {
	describe("Directive", () => {
		it("YAML", () => {
			let x = "%YAML 1.2\n---\n"
			let d = new Loader(Document).load(x) as Document[]
			expect(d[0].directives).to.eql([{YAML: "1.2"}])
		})

		it("TAG / primary", () => {
			let x = "%TAG ! !local-"
			let d = new Loader(Document).load(x) as Document[]
			expect(d[0].directives).to.eql([{TAG: {prefix: "!", namespace: "!local-"}}])
		})

		it("TAG / secondary", () => {
			let x = "%TAG !! !local-"
			let d = new Loader(Document).load(x) as Document[]
			expect(d[0].directives).to.eql([{TAG: {prefix: "!!", namespace: "!local-"}}])
		})

		it("TAG / named 1", () => {
			let x = "%TAG !a! !local-"
			let d = new Loader(Document).load(x) as Document[]
			expect(d[0].directives).to.eql([{TAG: {prefix: "!a!", namespace: "!local-"}}])
		})

		it("TAG / named 2", () => {
			let x = "%TAG !local! !local-"
			let d = new Loader(Document).load(x) as Document[]
			expect(d[0].directives).to.eql([{TAG: {prefix: "!local!", namespace: "!local-"}}])
		})
	})


	describe("String parsing", () => {

		it("Single Quote 1", () => {
			let x = "'Hello World'"
			let d = new Loader(YamlDocument).load(x) as Document[]
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Double Quote 1", () => {
			let x = "\"Hello World\""
			let d = new Loader(YamlDocument).load(x) as Document[]
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Plain 1", () => {
			let x = "Hello World"
			let d = new Loader(YamlDocument).load(x) as Document[]
			expect(d[0]).to.have.property("content").and.eql("Hello World")
		})

		it("Plain 2", () => {
			let x = "Hello World:xy"
			let d = new Loader(YamlDocument).load(x) as Document[]
			expect(d[0]).to.have.property("content").and.eql("Hello World:xy")
		})
	})
})