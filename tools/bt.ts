let ansi = require("ansi")
const CURSOR = ansi(process.stdout)
import { Suite } from "benchmark"


function bt(title, cases: { [key: string]: Function }) {
	let suite = new Suite(title, {
		onStart: (event) => {
			console.log(title)
		},

		onComplete: (event) => {
			CURSOR.write("\n")
		}
	})

	for (let k in cases) {
		suite.add(k, {
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

			fn: cases[k]
		})
	}

	suite.run()
}


const STR = "123456789"

bt("Char compare", {
	"charCodeAt": () => {
		return STR.charCodeAt(3) === 52
	},

	"index": () => {
		return STR[3] === "4"
	},

	"inSwitch / charCodeAt": () => {
		switch (STR.charCodeAt(3)) {
			case 48: return false;
			case 49: return false;
			case 50: return false;
			case 51: return false;
			case 52: return true;
			case 53: return false;
			case 54: return false;
			case 55: return false;
			case 56: return false;
		}
	},

	"inSwitch / index": () => {
		switch (STR[3]) {
			case "0": return false;
			case "1": return false;
			case "2": return false;
			case "3": return false;
			case "4": return true;
			case "5": return false;
			case "6": return false;
			case "7": return false;
			case "8": return false;
		}
	}
})