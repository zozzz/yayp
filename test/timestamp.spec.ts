import { expect } from "chai"
import { Loader, YamlDocument } from "../src"


describe("Timestamp parsing", () => {

	function test(yaml: string, date: any) {
		it(yaml, () => {
			let d = new Loader(YamlDocument).load(`${yaml}`)
			expect(d[0]).to.have.property("content").and.eql(date)
		})
	}

	describe("Valid timestamps", () => {
		test("2016-04-21", new Date("2016-04-21T00:00:00Z"))
		test("2016-12-01", new Date("2016-12-01T00:00:00Z"))
		test("2016-04-21 10:00:00", new Date("2016-04-21 10:00:00Z"))
		test("2016-04-21 10:00:00 +5", new Date("2016-04-21T10:00:00+0500"))
		test("2016-04-21 10:00:00+05", new Date("2016-04-21T10:00:00+0500"))
		test("2016-04-21 10:00:00+05:00", new Date("2016-04-21T10:00:00+0500"))
		test("2016-04-21 10:00:00+0500", new Date("2016-04-21T10:00:00+0500"))

		test("2016-04-21 10:00:00 -5", new Date("2016-04-21T10:00:00-0500"))
		test("2016-04-21 10:00:00-05", new Date("2016-04-21T10:00:00-0500"))
		test("2016-04-21 10:00:00-05:00", new Date("2016-04-21T10:00:00-0500"))
		test("2016-04-21 10:00:00-0500", new Date("2016-04-21T10:00:00-0500"))

		test("2016-04-21T23:59:59", new Date("2016-04-21T23:59:59Z"))
		test("2016-04-21T23:59:59.1", new Date("2016-04-21T23:59:59.1Z"))
		test("2016-04-21T23:59:59.42", new Date("2016-04-21T23:59:59.42Z"))
		test("2016-04-21T23:59:59.999", new Date("2016-04-21T23:59:59.999Z"))

		test("2016-04-21T23:59:59Z", new Date("2016-04-21T23:59:59Z"))
		test("2016-04-21T23:59:59+5", new Date("2016-04-21T23:59:59+0500"))
		test("2016-04-21T23:59:59.1+08", new Date("2016-04-21T23:59:59.1+0800"))
		test("2016-04-21T23:59:59.42+10:33", new Date("2016-04-21T23:59:59.42+1033"))
		test("2016-04-21T23:59:59.999+0455", new Date("2016-04-21T23:59:59.999+0455"))
	})

	describe("Incomplete timestamps", () => {
		test("2016-04-21 10:00", "2016-04-21 10:00")
		test("2016-04-21 10:00:00.", "2016-04-21 10:00:00.")
		test("2016", 2016)
		test("2016-", "2016-")
		test("2016-1", "2016-1")
		test("2016-12", "2016-12")
		test("2016-12-0", "2016-12-0")

		test("2016-12-05T", "2016-12-05T")
		test("2016-12-05T1", "2016-12-05T1")
		test("2016-12-05T12", "2016-12-05T12")
		test("2016-12-05T12:", { "2016-12-05T12": null })
		test("2016-12-05T12:3", "2016-12-05T12:3")
		test("2016-12-05T12:33", "2016-12-05T12:33")
		test("2016-12-05T12:33:", { "2016-12-05T12:33": null })
		test("2016-12-05T12:33:4", "2016-12-05T12:33:4")

		test("2016-12-05T12:33:44+", "2016-12-05T12:33:44+")
		test("2016-12-05T12:33:44-", "2016-12-05T12:33:44-")

		test("2016-12-05 1", "2016-12-05 1")
	})
})