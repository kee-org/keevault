/* eslint-env node */

const fs = require('fs');
const path = require('path');

const sass = require('node-sass');

const webpackConfig = require('./webpack.config');
const postCssReplaceFont = require('./build/util/postcss-replace-font');
const pkg = require('./package.json');

module.exports = function(grunt) {
    require('time-grunt')(grunt);
    require('load-grunt-tasks')(grunt);

    grunt.loadNpmTasks('grunt-string-replace');

    require('./grunt.tasks')(grunt);
    require('./grunt.entrypoints')(grunt);

    const date = new Date();
    grunt.config.set('date', date);

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
            grunt: ['Gruntfile.js', 'grunt/**/*.js']
        },
        sass: {
            options: {
                sourceMap: false,
                includePaths: ['./node_modules'],
                implementation: sass
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
                    postCssReplaceFont,
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
            js: webpackConfig.config(grunt)
        },
        'webpack-dev-server': {
            options: {
                webpack: webpackConfig.devServerConfig(grunt),
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
                host: '0.0.0.0',
                disableHostCheck: true
            },
            js: {
                keepalive: true,
                port: 8087
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
};
