var path = require("path")
var yayp = require("../lib")

for (let i = 0; i < 10000; ++i) {
	let doc = yayp.loadFile(path.join(__dirname, "benchmark/document_nodeca_application.yaml"))
}
