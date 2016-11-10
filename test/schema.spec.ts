import { expect } from "chai"
import { Loader, YamlDocument } from "../src"


describe("Schema", () => {
	describe("Failsafe", () => {

	})

	describe("Common", () => {

		it("Set", () => {
			let x = "!!set {x, y, z}"
			let d = new Loader(YamlDocument).load(x)

			expect(d[0]).to.have.property("content").and.instanceOf(Set)
			expect(Array.from(d[0].content)).to.eql(["x", "y", "z"])
		})
	})

})