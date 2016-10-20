import * as path from "path"
import * as fs from "fs"

import * as jsdom from "jsdom"
import * as yaml from "js-yaml"


const OUT_PATH = __dirname


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


jsdom.env(
	"http://www.yaml.org/spec/1.2/spec.html",
	["http://code.jquery.com/jquery.js"],
	(error, window) => {
		let idx = 0
		window.$("div.example").each(function () {
			let el = window.$(this)
			let title = el.find(".title").text().replace(/[ \r\n\t]+/g, " ").trim()
			if (title.length) {
				++idx
				let sidx = 0

				el.find("pre.programlisting").each(function() {
					let ymlNode = window.$(this)
					let content = ymlNode.html().replace(/<br(?:\s*\/)?>/ig, "\n")
					content = content.replace(/°/g, "")
					content = window.$("<div />").html(content).text().trim()

					try {
						let documents = []
						yaml.loadAll(content, (doc) => {
							documents.push(doc)
						})
						createTest(`${idx}_${sidx}`, `${title} (${sidx})`, content, documents)
					} catch (e) {
						createTest(`${idx}_${sidx}`, `${title} (${sidx})`, content, [])
					}
				})
			}
		})
	}
)