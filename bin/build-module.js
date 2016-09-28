#!/usr/bin/env node
const gulp = require('gulp');
const concat = require('gulp-concat');
const insert = require('gulp-insert');
const path = require('path');
const argv = require('yargs').argv;
const browserify = require('browserify');
const source = require('vinyl-source-stream');

// TODO reduce dup
const rootDir = (argv.rootDir && argv.rootDir !== true ) ? path.join(process.cwd(), argv.rootDir) : process.cwd();
const moduleName = (argv.moduleName && argv.moduleName !== true ) ? argv.moduleName : "FeatureExtractor"; // TODO probably throw an error instead
const outPath = (argv.outPath && argv.outPath !== true ) ? path.join(process.cwd(), argv.outPath) : process.cwd() + '/dist/module.js';
const paths = {
    plugins: [rootDir + '/**/feats-config.json']
};
const interimModuleName = 'pre-browserify-module.js';

gulp.task('build-module', () => {
    return gulp.src(paths.plugins)
        .pipe(insert.transform((contents, file) => {
            const mainRelativePath = JSON.parse(contents).main;
            const basePath = file.path.split('feats-config.json')[0];
            const mainBasePath = path.join(basePath, mainRelativePath.split(mainRelativePath)[0]);
            const extractorPath = path.join(mainBasePath, mainRelativePath);
            return 'factories.push({ extractor: sr => new (require("' + extractorPath + '")).default(sr), metadata: JSON.parse(' + JSON.stringify(contents) + ').description});';
        }))
        .pipe(concat(interimModuleName))
        .pipe(insert.wrap('export function create() { let factories = [];', 'return new Feats.LocalModuleRequestHandler(...factories);}'))
        .pipe(gulp.dest(rootDir + '/dist/'));
});

gulp.task('browserify-module', ['build-module'], () => {
    return browserify({ entries: path.join(rootDir, '/dist/', interimModuleName), standalone: moduleName})
        .transform('babelify')
        .bundle()
        .pipe(source(outPath))
        .pipe(gulp.dest(process.cwd())); // outPath is relative to the current directory
});

gulp.start('browserify-module'); // TODO this isn't really recommended, gulp scripts are supposed to be consumed by gulp-cli