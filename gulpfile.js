var path = require("path")

var typescript = require("typescript")
var gulp = require("gulp")
var ts = require("gulp-typescript")
var merge = require("merge2")
var sourcemaps = require("gulp-sourcemaps")
var istanbul = require("gulp-istanbul")
var mocha = require("gulp-mocha")
var remapIstanbul = require("remap-istanbul/lib/gulpRemapIstanbul")
var coveralls = require("gulp-coveralls")
var newer = require("gulp-newer")
var replace = require("gulp-replace")
var dts = require("dts-bundle")
var rollup = require("gulp-rollup")
var rollupNodeResolve = require("rollup-plugin-node-resolve")
var babel = require("gulp-babel")


function createCompileTS(name, opts) {
    var tsProject = ts.createProject("tsconfig.json", opts.ts);

    gulp.task(name, function () {
        var result = gulp.src(["./src/**/*.ts", "./test/**/*.ts"], { base: "." }),
            failed = false

        // if (opts.test) {
        //     result = result.pipe(newer({
        //         dest: "dist",
        //         ext: ".js",
        //         extra: ["gulpfile.js", "package.json", "tsconfig.json"]
        //     }))
        // }

        result = result.pipe(sourcemaps.init())
        result = result.pipe(tsProject())
            .on("error", () => {
                failed = true
            })
            .on("finish", () => {
                if (failed) {
                    process.exit(1)
                }
            })

        return merge([
            result.js
                .pipe(sourcemaps.write(".", {
                    mapSources: function (sourcePath) {
                        return __dirname + sourcePath.substr(2)
                    }
                }))
                .pipe(gulp.dest("dist")),

            result.dts
                .pipe(gulp.dest("dist/dts"))
        ])
    })
}

createCompileTS("compile-ts", {})
createCompileTS("compile-ts-for-test", {
    test: true,
    ts: {
        module: "commonjs"
    }
})


gulp.task("bundle-dts", ["compile-ts"], function () {
    dts.bundle({
        name: "yayp",
        main: "dist/dts/src/index.d.ts",
        baseDir: "dist/dts/src/",
        out: "yayp.d.ts",
        referenceExternals: true
    });

    return gulp.src("dist/dts/src/yayp.d.ts")
        .pipe(gulp.dest("lib"))
})


gulp.task("rollup", ["bundle-dts"], function () {
    return gulp.src("dist/src/**/*.js")
        .pipe(sourcemaps.init())
        .pipe(rollup({
            entry: "./dist/src/index.js",
            plugins: [
                rollupNodeResolve({
                    jsnext: true,
                    browser: false,

                })
            ]
        }))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest("./lib"))
})


gulp.task("compile", ["rollup"], function () {
    return gulp.src("./lib/index.js")
        .pipe(sourcemaps.init())
        .pipe(babel({
            presets: ["node6"]
        }))
        .pipe(sourcemaps.write(".", sourcemaps.write(".", {
            mapSources: function (sourcePath) {
                return __dirname + sourcePath.substr(2)
            }
        })))
        .pipe(gulp.dest("./lib"))
})


gulp.task("copy-test-files", function () {
    // TODO: lehetne tovább is optimalizálni...
    return gulp.src("test/fixtures/**/*.*", { base: "test" })
        .pipe(newer({
            dest: "dist/test",
            extra: ["tools/yaml-examples.ts"]
        }))
        .pipe(gulp.dest("dist/test"))
})


gulp.task("prepare-test", ["compile-ts-for-test", "copy-test-files"], function () {

})


gulp.task("pre-test", ["prepare-test"], function () {
    return gulp.src("dist/src/**/*.js")
        .pipe(istanbul())
        .pipe(istanbul.hookRequire())
})


gulp.task("test", ["prepare-test"], function () {
    return gulp.src("dist/test/**/*.spec.js", { read: false })
        .pipe(mocha({
            bail: true
        }))
})


gulp.task("coverage-collect", ["pre-test"], function () {
    return gulp.src("dist/test/**/*.spec.js", { read: false })
        .pipe(mocha())
        .on("error", function () {
            process.exit(1)
        })
        .pipe(istanbul.writeReports({
            dir: ".coverage",
            reporters: ["json", "text"]
        }))
})


gulp.task("coverage-remap", ["coverage-collect"], function () {
    return gulp.src(".coverage/coverage-final.json")
        .pipe(remapIstanbul({
            reports: {
                "json": ".coverage/coverage.json",
                "lcovonly": ".coverage/coverage.lcov",
                "html": ".coverage/html"
            }
        }))
        .pipe(gulp.dest(".coverage/remapped"))
})


gulp.task("coverage", ["coverage-remap"], function () {
    return gulp.src(".coverage/coverage.lcov")
        // just dont see this line... :)
        // remove dist part from path, i cannot do with remap-istanbul
        .pipe(replace("SF:" + __dirname + path.sep + "dist" + path.sep, "SF:" + __dirname + path.sep))
        .pipe(gulp.dest(".coverage"))
})


gulp.task("coveralls", ["coverage"], function () {
    return gulp.src(".coverage/coverage.lcov")
        .pipe(coveralls())
})