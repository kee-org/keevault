/* eslint-env node */

const fs = require('fs');
const path = require('path');

const StringReplacePlugin = require('string-replace-webpack-plugin');
const StatsPlugin = require('stats-webpack-plugin');

module.exports = function(grunt) {
    require('time-grunt')(grunt);
    require('load-grunt-tasks')(grunt);
    grunt.loadTasks('grunt/tasks');
    grunt.loadNpmTasks('grunt-string-replace');

    const webpack = require('webpack');
    const pkg = require('./package.json');
    const dt = new Date().toISOString().replace(/T.*/, '');
    const year = new Date().getFullYear();

    function replaceFont(css) {
        css.walkAtRules('font-face', rule => {
            const fontFamily = rule.nodes.filter(n => n.prop === 'font-family')[0];
            if (!fontFamily) {
                throw 'Font rule missing font-face: ' + rule.toString();
            }
            const value = fontFamily.value.replace(/["']/g, '');
            const fontFiles = {
                'Font Awesome 5 Brands': 'fa-brands-400.woff2',
                'Font Awesome 5 Free': {
                    '400': 'fa-regular-400.woff2',
                    '900': 'fa-solid-900.woff2'
                }
            };
            let fontFile = fontFiles[value];
            if (!fontFile) {
                throw 'Unsupported font ' + value + ': ' + rule.toString();
            }
            if (typeof fontFile !== 'string') {
                const fontWeight = rule.nodes.filter(n => n.prop === 'font-weight')[0];
                if (!fontWeight) {
                    throw 'Font rule missing font-weight: ' + rule.toString();
                }
                fontFile = fontFile[fontWeight.value];
                if (!fontFile) {
                    throw 'Unsupported font ' + value + ': ' + rule.toString();
                }
            }
            const data = fs.readFileSync('tmp/fonts/' + fontFile, 'base64');
            const src = 'url(data:application/font-woff2;charset=utf-8;base64,{data}) format(\'woff2\')'
                .replace('{data}', data);
            rule.nodes = rule.nodes.filter(n => n.prop !== 'src');
            rule.append({ prop: 'src', value: src });
        });
    }

    const webpackConfig = {
        entry: {
            app: 'app',
            vendor: ['jquery', 'underscore', 'backbone', 'kdbxweb', 'baron', 'pikaday', 'file-saver', 'jsqrcode',
                'argon2-wasm', 'argon2-browser']
        },
        output: {
            path: path.resolve('.', 'tmp/js'),
            filename: 'app.js'
        },
        stats: {
            colors: false,
            modules: true,
            reasons: true
        },
        progress: false,
        failOnError: true,
        resolve: {
            modules: [path.join(__dirname, 'app/scripts'), path.join(__dirname, 'node_modules')],
            alias: {
                backbone: 'backbone/backbone-min.js',
                underscore: 'underscore/underscore-min.js',
                _: 'underscore/underscore-min.js',
                jquery: 'jquery/dist/jquery.min.js',
                kdbxweb: 'kdbxweb/dist/kdbxweb.js',
                baron: 'baron/baron.min.js',
                pikaday: 'pikaday/pikaday.js',
                filesaver: 'FileSaver.js/FileSaver.min.js',
                qrcode: 'jsqrcode/dist/qrcode.min.js',
                'argon2': 'argon2-browser/dist/argon2.min.js',
                hbs: 'handlebars/runtime.js',
                'argon2-wasm': 'argon2-browser/dist/argon2.wasm',
                templates: path.join(__dirname, 'app/templates')
            }
        },
        module: {
            loaders: [
                { test: /\.hbs$/, loader: StringReplacePlugin.replace('handlebars-loader', { replacements: [{
                    pattern: /\r?\n\s*/g,
                    replacement: function() { return '\n'; }
                }]})},
                { test: /runtime-info\.js$/, loader: StringReplacePlugin.replace({ replacements: [
                    {
                        pattern: /@@VERSION/g,
                        replacement: function () { return pkg.version + (grunt.option('beta') ? '-beta' : ''); }
                    },
                    { pattern: /@@BETA/g, replacement: function() { return grunt.option('beta') ? '1' : ''; } },
                    { pattern: /@@DATE/g, replacement: function() { return dt; } },
                    { pattern: /@@COMMIT/g, replacement: function() { return grunt.config.get('gitinfo.local.branch.current.shortSHA'); } }
                ]})},
                { test: /baron(\.min)?\.js$/, loader: 'exports-loader?baron; delete window.baron;' },
                { test: /pikaday\.js$/, loader: 'uglify-loader' },
                { test: /handlebars/, loader: 'strip-sourcemap-loader' },
                {
                    test: /(kee-frontend|kprpc|kdbx-placeholders)\/dist\/.+\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
                },
                { test: /\.js$/, exclude: /(node_modules|kee-frontend|kprpc|kdbx-placeholders)/, loader: 'babel-loader',
                    query: { presets: ['es2015'], cacheDirectory: true }
                },
                { test: /\.json$/, loader: 'json-loader' },
                { test: /argon2\.wasm$/, loader: 'base64-loader' },
                { test: /argon2\.min\.js/, loader: 'raw-loader' },
                { test: /\.scss$/, loader: 'raw-loader' }
            ]
        },
        plugins: [
            new webpack.optimize.CommonsChunkPlugin({ name: 'vendor', minChunks: Infinity, filename: 'vendor.js' }),
            new webpack.BannerPlugin('kee vault v' + pkg.version + ', (c) ' + year + ' ' + pkg.author.name +
                ', AGPLv3 with supplemental terms'),
            new webpack.ProvidePlugin({ _: 'underscore', $: 'jquery' }),
            new webpack.IgnorePlugin(/^(moment)$/),
            new StringReplacePlugin(),
            new StatsPlugin('stats.json', { chunkModules: true })
        ],
        node: {
            console: false,
            process: false,
            crypto: false,
            Buffer: false,
            __filename: false,
            __dirname: false,
            fs: false,
            setImmediate: false,
            path: false
        },
        externals: {
            xmldom: 'null',
            crypto: 'null',
            fs: 'null',
            path: 'null'
        }
    };

    grunt.initConfig({
        gitinfo: {
            branch: {
                current: {
                    SHA: 'Current HEAD SHA',
                    shortSHA: 'Current HEAD short SHA',
                    name: 'Current branch name',
                    lastCommitTime: 'Last commit time'
                }
            }
        },
        clean: {
            dist: ['dist', 'tmp']
        },
        'string-replace': {
            inline: {
                files: {
                    'dist/sw.js': 'dist/sw.js',
                    'tmp/sw.js': 'tmp/sw.js'
                },
                options: {
                    replacements: [
                        {
                            pattern: '@@VERSION',
                            replacement: function (match, p1) {
                                return pkg.version + (grunt.option('beta') ? '-beta' : '');
                            }
                        },
                        {
                            pattern: '@@COMMIT',
                            replacement: function (match, p1) {
                                return grunt.config.get('gitinfo.local.branch.current.shortSHA');
                            }
                        }
                    ]
                }
            }
        },
        copy: {
            html: {
                src: 'app/index.html',
                dest: 'tmp/index.html',
                nonull: true
            },
            icons: {
                cwd: 'app/icons/',
                src: ['*.png', '*.svg', '*.webmanifest', '*.xml', '*.ico'],
                dest: 'tmp/icons/',
                expand: true,
                nonull: true
            },
            'dist-icons': {
                cwd: 'app/icons/',
                src: ['*.png', '*.svg', '*.webmanifest', '*.xml', '*.ico'],
                dest: 'dist/icons/',
                expand: true,
                nonull: true
            },
            sw: {
                cwd: 'app/',
                src: ['sw.js'],
                dest: 'tmp/',
                expand: true,
                nonull: true
            },
            'dist-sw': {
                cwd: 'app/',
                src: ['sw.js'],
                dest: 'dist/',
                expand: true,
                nonull: true
            },
            fonts: {
                src: 'node_modules/@fortawesome/fontawesome-free/webfonts/fa-*.woff2',
                dest: 'tmp/fonts/',
                nonull: true,
                expand: true,
                flatten: true
            }
        },
        eslint: {
            app: ['app/scripts/**/*.js'],
            desktop: ['desktop/**/*.js', '!desktop/node_modules/**'],
            grunt: ['Gruntfile.js', 'grunt/**/*.js']
        },
        sass: {
            options: {
                sourceMap: false,
                includePaths: ['./node_modules']
            },
            dist: {
                files: {
                    'tmp/css/main.css': 'app/styles/main.scss'
                }
            }
        },
        postcss: {
            options: {
                processors: [
                    replaceFont,
                    require('cssnano')({discardComments: {removeAll: true}})
                ]
            },
            dist: {
                src: 'tmp/css/main.css',
                dest: 'tmp/css/main.css'
            }
        },
        inline: {
            app: {
                src: 'tmp/index.html',
                dest: 'tmp/app.html'
            }
        },
        htmlmin: {
            options: {
                removeComments: true,
                collapseWhitespace: true
            },
            app: {
                files: {
                    'dist/index.html': 'tmp/app.html'
                }
            }
        },
        webpack: {
            js: webpackConfig
        },
        'webpack-dev-server': {
            options: {
                webpack: webpackConfig,
                contentBase: path.join(__dirname, 'tmp'),
                publicPath: '/js',
                progress: false,
                https: fs.existsSync('cert/server.key')
                    ? {
                        key: fs.readFileSync('cert/server.key'),
                        cert: fs.readFileSync('cert/server.crt')
                    }
                    : true,
                public: 'app-dev.kee.pm',
                host: '0.0.0.0'
            },
            js: {
                keepalive: true,
                webpack: {
                    devtool: 'source-map'
                },
                port: 8087
            }
        },
        uglify: {
            options: {
                preserveComments: false
            },
            app: {
                files: { 'tmp/js/app.js': ['tmp/js/app.js'] }
            },
            vendor: {
                options: {
                    mangle: false,
                    compress: false
                },
                files: { 'tmp/js/vendor.js': ['tmp/js/vendor.js'] }
            }
        },
        watch: {
            options: {
                interrupt: true,
                debounceDelay: 500
            },
            styles: {
                files: 'app/styles/**/*.scss',
                tasks: ['sass']
            },
            indexhtml: {
                files: 'app/index.html',
                tasks: ['copy:html']
            }
        },
        'sign-html': {
            'app': {
                options: {
                    file: 'dist/index.html',
                    skip: grunt.option('skip-sign')
                }
            }
        },
        'concurrent': {
            options: {
                logConcurrentOutput: true
            },
            'dev-server': [
                'watch:styles',
                'webpack-dev-server'
            ]
        }
    });

    // compound builder tasks

    grunt.registerTask('build-web-app', [
        'gitinfo',
        'clean',
        'eslint',
        'copy:html',
        'copy:icons',
        'copy:sw',
        'copy:fonts',
        'webpack',
        // 'uglify',
        'sass',
        'postcss',
        'inline',
        'htmlmin',
        'copy:dist-icons',
        'copy:dist-sw',
        'string-replace',
        'sign-html'
    ]);

    // entry point tasks

    grunt.registerTask('default', 'Default: build web app', [
        'build-web-app'
    ]);

    grunt.registerTask('dev', 'Build project and start web server and watcher', [
        'build-web-app',
        'devsrv'
    ]);

    grunt.registerTask('devsrv', 'Start web server and watcher', [
        'concurrent:dev-server'
    ]);
};
