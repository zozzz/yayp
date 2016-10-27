import {expect} from "chai"
import {Loader, YamlDocument} from "../src"


describe("Parser basics", () => {
	describe("Directive", () => {
		it.only("YAML", () => {
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
	})
})