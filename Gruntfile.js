/* eslint-env node */

const webpackConfig = require('./webpack.config');
const pkg = require('./package.json');

module.exports = function (grunt) {
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
            // options: {
            //     webpack: webpackConfig.config(grunt, 'development'),

            // },
            js: webpackConfig.config(grunt, 'development')
        }
    });
};
