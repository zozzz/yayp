import * as fs from "fs"
import * as path from "path"
let ansi = require("ansi")
import { Suite } from "benchmark"

const FILES_PATH = fs.realpathSync(path.join(__dirname, "benchmark"))
const CURSOR = ansi(process.stdout)


function runSample(filePath: string): void {
	let title = path.basename(filePath),
		content = fs.readFileSync(filePath, "UTF-8"),
		suite = new Suite(title, {
			onStart: (event) => {
				console.log(`Start ${title}`)
			},

			onComplete: (event) => {
				CURSOR.write("\n")
			}
		})

	for (let runner of runners()) {
		suite.add(runner.title, {
			onCycle: (event) => {
				CURSOR.horizontalAbsolute()
				CURSOR.eraseLine()
				CURSOR.write(`\t> ${event.target}`)
			},

			onComplete: (event) => {
				CURSOR.horizontalAbsolute()
				CURSOR.eraseLine()
				CURSOR.write(`\t> ${event.target}\n`)
			},

			fn: () => {
				runner.run(content)
			}
		})
	}

	suite.run()
}


type Runner = {
	title: string,
	run: (content: string) => void
}


function* runners(): Iterable<Runner> {
	yield currentVersionRunner()
	yield jsYaml()
}


function currentVersionRunner(): Runner {
	let yayp = require("../lib"),
		pckg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "UTF-8"))

	return {
		title: `yayp@${pckg.version}`,
		run: yayp.load
	}
}


function jsYaml() {
	let jsYaml = require("js-yaml"),
		pckg = JSON.parse(fs.readFileSync(path.join(__dirname, "node_modules", "js-yaml", "package.json"), "UTF-8"))

	return {
		title: `js-yaml@${pckg.version}`,
		run: jsYaml.load
	}
}


for (let p of fs.readdirSync(FILES_PATH).sort()) {
	if (/\.yaml$/i.test(p)) {
		runSample(path.join(FILES_PATH, p))
		break
	}
}