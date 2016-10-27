var path = require("path")

var gulp = require("gulp")
var ts = require("gulp-typescript")
var merge = require("merge2")
var sourcemaps = require("gulp-sourcemaps")
var istanbul = require("gulp-istanbul")
var mocha = require("gulp-mocha")
var remapIstanbul = require("remap-istanbul/lib/gulpRemapIstanbul")
var coveralls = require("gulp-coveralls")
var newer = require("gulp-newer")

var tsProject = ts.createProject("tsconfig.json");

gulp.task("compile", function() {
	var result = tsProject.src()
		.pipe(newer({
			dest: "dist",
			ext: ".js",
			extra: ["gulpfile.js", "package.json", "tsconfig.json"]
		}))
		.pipe(sourcemaps.init())
		.pipe(tsProject())

	return merge([
        result.js
			.pipe(sourcemaps.write())
			.pipe(gulp.dest("dist"))
	])
})

gulp.task("copy-test-files", function() {
	// TODO: lehetne tovább is optimalizálni...
	return gulp.src("test/fixtures/**/*.*", {base: "test"})
		.pipe(newer({
			dest: "dist/test",
			extra: ["tools/yaml-examples.ts"]
		}))
		.pipe(gulp.dest("dist/test"))
})

gulp.task("prepare-test", ["compile", "copy-test-files"])

gulp.task("pre-test", ["prepare-test"], function() {
	return gulp.src("dist/src/**/*.js")
		.pipe(istanbul())
		.pipe(istanbul.hookRequire())
})

gulp.task("test", ["prepare-test"], function () {
	return
})

gulp.task("coverage-collect", ["pre-test"], function() {
	return gulp.src("dist/test/**/*.spec.js")
		.pipe(mocha())
		.pipe(istanbul.writeReports({
			dir: ".coverage",
			reporters: ["json", "text"]
		}))
		// .pipe(istanbul.enforceThresholds({thresholds: {global: 90}}))
})

gulp.task("coverage-remap", ["coverage-collect"], function() {
	return gulp.src(".coverage/coverage-final.json")
		.pipe(remapIstanbul({
			reports: {
				"json": ".coverage/coverage.json",
				"lcovonly": ".coverage/lcov.info",
				"html": ".coverage/html"
			}
		}))
		.pipe(gulp.dest(".coverage"))
})

gulp.task("coverage", ["coverage-remap"], function() {
})

gulp.task("coveralls", ["coverage"], function() {
	return gulp.src(".coverage/lcov.info")
		.pipe(coveralls())
})

// gulp.task("pre-test", ["compile", "copy-test-files"], function() {
// 	// return gulp.src("dist/src/**/*.js")
// 	// 	// .pipe(sourcemaps.init())
// 	// 	.pipe(istanbul())
// 	// 	// .pipe(sourcemaps.write('.'))
// 	// 	.pipe(istanbul.hookRequire())
// })

// // gulp.task("test", ["pre-test"], function() {
// // 	return gulp.src("dist/test/*.spec.js", {read: false})
// // 		.pipe(mocha())
// // 		.pipe(istanbul.writeReports())
// // 		.pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }))
// // })

// gulp.task("test", ["pre-test"], function() {
// 	return gulp.src("dist/test/*.spec.js", {read: false})
// 		.pipe(mocha())
// })