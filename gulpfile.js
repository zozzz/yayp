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
	var result = gulp.src(["./src/**/*.ts", "./test/**/*.ts"], {base: "."})
		.pipe(newer({
			dest: "dist",
			ext: ".js",
			extra: ["gulpfile.js", "package.json", "tsconfig.json"]
		}))
		.pipe(sourcemaps.init())
		.pipe(tsProject())

	return merge([
        result.js
			.pipe(sourcemaps.write(".", {
				mapSources: function(sourcePath) {
					return __dirname + sourcePath.substr(2)
				}
			}))
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
	return gulp.src("dist/test/**/*.spec.js", {read: false})
		.pipe(mocha())
})

gulp.task("coverage-collect", ["pre-test"], function() {
	return gulp.src("dist/test/**/*.spec.js", {read: false})
		.pipe(mocha())
		.pipe(istanbul.writeReports({
			dir: ".coverage",
			reporters: ["json", "text"]
		}))
})

gulp.task("coverage-remap", ["coverage-collect"], function() {
	return gulp.src(".coverage/coverage-final.json")
		.pipe(remapIstanbul({
			reports: {
				"json": ".coverage/coverage.json",
				"lcovonly": ".coverage/coverage.lcov",
				"html": ".coverage/html"
			},
			basePath: __dirname,
			fail: true
		}))
		.pipe(gulp.dest(".coverage/xxx"))
})

gulp.task("coverage", ["coverage-remap"], function() {
})

gulp.task("coveralls", ["coverage"], function() {
	return gulp.src(".coverage/coverage.lcov")
		.pipe(require("gulp-debug")())
		.pipe(coveralls())
})
