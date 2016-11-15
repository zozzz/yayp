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

if (0)
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


const BOOL_RX = /true|True|TRUE|false|False|FALSE/
const BOOL_ARRAY = ["true", "True", "TRUE", "false", "False", "FALSE"]
const BOOL_MAP = { "true": true, "True": true, "TRUE": true, "false": true, "False": true, "FALSE": true }
const BOOL_VALUE = "TRUE"

if (0)
	bt("Regex vs indexOf vs Mapping", {
		"regex": () => {
			if (BOOL_RX.test(BOOL_VALUE)) {
				return true
			}
		},

		"array": () => {
			if (BOOL_ARRAY.indexOf(BOOL_VALUE) > -1) {
				return true
			}
		},

		"map": () => {
			let v
			if ((v = BOOL_MAP[BOOL_VALUE]) !== undefined) {
				return v
			}
		},

		"map2": () => {
			let v = BOOL_MAP[BOOL_VALUE]
			if (typeof v !== "undefined") {
				return v
			}
		},

		"map3": () => {
			if (BOOL_MAP.hasOwnProperty(BOOL_VALUE)) {
				return BOOL_MAP[BOOL_VALUE]
			}
		}
	})


const NO_BLOCK_MAPPING = 1;
const ONLY_COMPACT_MAPPING = 2;
const IN_FLOW_SEQ = 4;
const IN_FLOW_MAP = 8;
const IN_FLOW = IN_FLOW_SEQ | IN_FLOW_MAP; // 12
const STATE = {
	inFlowSeq: 0,
	inFlowMap: 0,
	iterations_1: 0,
	iterations_2: 0,
	iterations_3: 0,

	parseValue_1: function (x) {
		if (x > 0) {
			if (x % 2 === 0) {
				this.parseSeq_1(x)
			} else {
				this.parseMap_1(x)
			}

			if (this.inFlowSeq || this.inFlowMap) {
				++this.iterations_1
			}
		}
	},

	parseSeq_1: function (x) {
		++this.inFlowSeq
		this.parseValue_1(x - 1)
		--this.inFlowSeq
	},

	parseMap_1: function (x) {
		++this.inFlowMap
		this.parseValue_1(x - 1)
		--this.inFlowMap
	},


	parseValue_2: function (x, state) {
		if (x > 0) {
			if (x % 2 === 0) {
				this.parseSeq_2(x, state)
			} else {
				this.parseMap_2(x, state)
			}

			if (state & 12) {
				++this.iterations_2
			}
		}
	},

	parseSeq_2: function (x, state) {
		this.parseValue_2(x - 1, state | 4)
	},

	parseMap_2: function (x, state) {
		this.parseValue_2(x - 1, state | 8)
	},

	parseValue_3: function (x, inFlowSeq, inFlowMap) {
		if (x > 0) {
			if (x % 2 === 0) {
				this.parseSeq_3(x, inFlowSeq, inFlowMap)
			} else {
				this.parseMap_3(x, inFlowSeq, inFlowMap)
			}

			if (inFlowSeq || inFlowMap) {
				++this.iterations_3
			}
		}
	},

	parseSeq_3: function (x, inFlowSeq, inFlowMap) {
		this.parseValue_3(x - 1, true, inFlowMap)
	},

	parseMap_3: function (x, inFlowSeq, inFlowMap) {
		this.parseValue_3(x - 1, inFlowSeq, true)
	},
}


bt("Flags", {
	"Number": () => {
		STATE.parseValue_1(10)
	},

	"Flag": () => {
		STATE.parseValue_2(10, 0)
	},

	"Bool arg": () => {
		STATE.parseValue_3(10, false, false)
	}
})