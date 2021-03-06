import { expect } from "chai"
import { Loader, YamlDocument } from "../src"


describe("Number parsing", () => {

	function test(num: number) {
		let dec = (num < 0 ? "-" : "") + Math.abs(num).toString(10),
			oct = (num < 0 ? "-" : "+") + "0o" + Math.abs(num).toString(8),
			hex = (num < 0 ? "-" : "+") + "0x" + Math.abs(num).toString(16)

		it(`DEC: ${dec} | OCT: ${oct} | HEX: ${hex}`, () => {
			let d = new Loader(YamlDocument).load(`${dec}`)
			expect(d[0]).to.have.property("content").and.eql(num)

			d = new Loader(YamlDocument).load(`${oct}`)
			expect(d[0]).to.have.property("content").and.eql(num)

			d = new Loader(YamlDocument).load(`${hex}`)
			expect(d[0]).to.have.property("content").and.eql(num)
		})
	}

	function floatTest(num: string, v?: number) {
		v = v === undefined ? parseFloat(num) : v
		it(`FLOAT: ${num}`, () => {
			let d = new Loader(YamlDocument).load(`${num}`)
			expect(d[0]).to.have.property("content").and.eql(v)

			d = new Loader(YamlDocument).load(`-${num}`)
			expect(d[0]).to.have.property("content").and.eql(-v)

			d = new Loader(YamlDocument).load(`+${num}`)
			expect(d[0]).to.have.property("content").and.eql(v)
		})
	}

	test(0)
	test(1)
	test(2)
	test(3)
	test(4)
	test(5)
	test(6)
	test(7)
	test(8)
	test(9)
	test(-9)
	test(123456789)

	floatTest("1.0")
	floatTest(".01")
	floatTest("1e2")
	floatTest("1.1e2")
	floatTest("6.8523015e+5", 685230.15)
	floatTest("685.230_15e+03", 685230.15)
	floatTest("685_230.15", 685230.15)
	floatTest("190:20:30.15", 685230.15)

	floatTest(".Inf", Infinity)

	// floatTest("1:60", )

	it("HEX: 0x00CC33", () => {
		let d = new Loader(YamlDocument).load(`0x00CC33`)
		expect(d[0]).to.have.property("content").and.eql(0x00CC33)
	})

	it("NaN", () => {
		let d = new Loader(YamlDocument).load(`.NaN`)
		expect(d[0]).to.have.property("content").and.eql(NaN)
	})

	it("OCT: 0o00123", () => {
		let d = new Loader(YamlDocument).load(`0o00123`)
		expect(d[0]).to.have.property("content").and.eql(0o00123)
	})

	it("In mapping", () => {
		let d = new Loader(YamlDocument).load(`
  x: 1
  y: -42
  z: 0x34`)
		expect(d[0]).to.have.property("content").and.eql({ x: 1, y: -42, z: 0x34 })
	})
})