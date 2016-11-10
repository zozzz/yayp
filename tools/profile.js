var path = require("path")
var yayp = require("../lib")

for (let i = 0; i < 5000; ++i) {
	let doc = yayp.loadFile(path.join(__dirname, "benchmark/random_data.yaml"))
}
