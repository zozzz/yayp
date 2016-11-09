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


if (0)
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

const IS_WS_A = []
IS_WS_A[32] = true
IS_WS_A[160] = true
IS_WS_A[9] = true
IS_WS_A[13] = true
IS_WS_A[10] = true

const IS_WS_M = {
	32: true,
	160: true,
	9: true,
	13: true,
	10: true
}
function IS_WS_F(ch) {
	return ch === 32 || ch === 160 || ch === 9 || ch === 13 || ch === 10
}

const SPACE = 32
const Z = 90

bt("Is Whitespace", {
	"Array": () => {
		let a = IS_WS_A[SPACE]
		let b = IS_WS_A[Z]
		return a && b
	},

	"Mapping": () => {
		let a = IS_WS_M[SPACE]
		let b = IS_WS_M[Z]
		return a && b
	},

	"Function": () => {
		let a = IS_WS_F(SPACE)
		let b = IS_WS_F(Z)
		return a && b
	},

	"Inline switch": () => {
		let a, b
		switch (SPACE as any) {
			case 32: a = true; break
			case 160: a = true; break
			case 9: a = true; break
			case 13: a = true; break
			case 10: a = true; break
		}

		switch (Z as any) {
			case 32: b = true; break
			case 160: b = true; break
			case 9: b = true; break
			case 13: b = true; break
			case 10: b = true; break
		}

		return a && b
	}
})