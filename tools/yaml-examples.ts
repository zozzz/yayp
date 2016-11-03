import * as path from "path"
import * as fs from "fs"

import * as jsdom from "jsdom"
var yaml = require("js-yaml")


const OUT_PATH = path.join(__dirname, "..", "test", "fixtures", "yaml-examples")


function createTest(idx, title, raw, documents) {
	let fileName = path.join(OUT_PATH, `yaml_example_${idx}.yml`)
	try {
		if (fs.statSync(fileName).isFile()) {
			return
		}
	} catch (e) {

	}

	let fd = fs.openSync(fileName, "w")
	fs.writeSync(fd, `# --- [title] ${title}\n\n`)
	fs.writeSync(fd, raw)

	for (let k in documents) {
		fs.writeSync(fd, `\n\n# --- [success] documents[${k}].content\n\n`)
		fs.writeSync(fd, JSON.stringify(documents[k]))
	}
}


function leadingZero(num: number): string {
	return `${num < 10 ? "00" : (num < 100 ? "0" : "")}${num}`
}

// TODO 1.1 and 1.2 examples

jsdom.env(
	"http://www.yaml.org/spec/1.2/spec.html",
	["http://code.jquery.com/jquery.js"],
	(error, window: any) => {
		let idx = 0
		window.$("div.example").each(function () {
			let el = window.$(this)
			let title: string = el.find(".title").text().replace(/[ \r\n\t]+/g, " ").trim()
			if (title.length) {
				let m = title.match(/example\s*([\d\\.]+)\s*/i)
				++idx
				let sidx = 0

				if (m) {
					title = `YAML Example / ${m[1].trim()} ${title.slice(m[0].length).trim()}`
				}

				el.find("pre.programlisting").each(function () {
					++sidx
					let ymlNode = window.$(this)
					let content = ymlNode.html().replace(/<br(?:\s*\/)?>/ig, "\n")
					content = content.replace(/°/g, "")
					content = content.replace(/→/g, "\t")
					content = content.replace(/·/g, " ")
					content = content.replace(/↓[^\r\n]*(\r?\n)?/g, "\n")
					content = content.replace(/⇔/, String.fromCharCode(0xFEFF))
					content = window.$("<div />").html(content).text().trim()

					try {
						let documents = []
						yaml.loadAll(content, (doc) => {
							documents.push(doc)
						}, {
								schema: yaml.DEFAULT_FULL_SCHEMA
							})
						createTest(`${leadingZero(idx)}_${sidx}`, `${title} (${sidx})`, content, documents)
					} catch (e) {
						createTest(`${leadingZero(idx)}_${sidx}`, `${title} (${sidx})`, content, [])
					}
				})
			}
		})
	}
)