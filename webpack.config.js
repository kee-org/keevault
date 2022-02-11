/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const pkg = require('./package.json');

process.noDeprecation = true; // for css loaders

function config(grunt, mode = 'production') {
    const devMode = mode === 'development';
    const date = grunt.config.get('date');
    const dt = date.toISOString().replace(/T.*/, '');
    const year = date.getFullYear();
    return {
        devServer: {
            port: 8087,
            static: {
                publicPath: '/',
                directory: path.resolve(__dirname, 'tmp')
            },
            https: fs.existsSync('cert/server.key')
                ? {
                    key: fs.readFileSync('cert/server.key'),
                    cert: fs.readFileSync('cert/server.crt')
                }
                : true,
            // webSocketURL: {
            //     hostname: "0.0.0.0",
            //     pathname: "/ws",
            //     port: 8087,
            //   },
            host: '0.0.0.0',
            allowedHosts: 'all'
        },
        experiments: {
            syncWebAssembly: true
        },
        mode,
        entry: {
            app: ['app', 'main.scss'],
            vendor: ['jquery', 'underscore', 'backbone', 'kdbxweb', 'baron',
                'pikaday', 'jsqrcode', 'argon2-wasm', 'argon2']
        },
        output: {
            path: path.resolve('.', 'tmp'),
            filename: 'js/[name].js'
        },
        performance: {
            hints: false
        },
        stats: {
            colors: false,
            modules: true,
            reasons: true
        },
        progress: false,
        failOnError: true,
        resolve: {
            modules: [
                path.join(__dirname, 'app/scripts'),
                path.join(__dirname, 'app/styles'),
                path.join(__dirname, 'node_modules')
            ],
            alias: {
                backbone: `backbone/backbone${devMode ? '-min' : ''}.js`,
                underscore: `underscore/underscore${devMode ? '-min' : ''}.js`,
                _: `underscore/underscore${devMode ? '-min' : ''}.js`,
                jquery: `jquery/dist/jquery${devMode ? '.min' : ''}.js`,
                kdbxweb: 'kdbxweb/dist/kdbxweb.js',
                baron: 'baron/baron.min.js',
                qrcode: 'jsqrcode/dist/qrcode.min.js',
                argon2: 'argon2-browser/dist/argon2.js',
                hbs: 'handlebars/runtime.js',
                'argon2-wasm': 'argon2-browser/dist/argon2.wasm',
                templates: path.join(__dirname, 'app/templates')
            },
            fallback: {
                timers: require.resolve('timers-browserify')
            }
        },
        module: {
            rules: [
                {
                    test: /\.hbs$/,
                    use: [
                        {
                            loader: 'string-replace-loader',
                            options: {
                                search: /\r?\n\s*/g,
                                replace: '\n'
                            }
                        },
                        'handlebars-loader'
                    ]
                },
                {
                    test: /runtime-info\.js$/,
                    loader: 'string-replace-loader',
                    options: {
                        multiple: [
                            {
                                search: /@@VERSION/g,
                                replace(match, p1, offset, string) {
                                    console.log(`Replace "${match}" in file "${this.resource}".`);
                                    return pkg.version + (grunt.option('beta') ? '-beta' : '');
                                }
                            },
                            {
                                search: /@@BETA/g,
                                replace(match, p1, offset, string) {
                                    console.log(`Replace "${match}" in file "${this.resource}".`);
                                    return grunt.option('beta') ? '1' : '';
                                }
                            },
                            {
                                search: /@@DATE/g,
                                replace(match, p1, offset, string) {
                                    return dt;
                                }
                            },
                            {
                                search: /@@COMMIT/g,
                                replace(match, p1, offset, string) {
                                    return grunt.config.get('gitinfo.local.branch.current.shortSHA');
                                }
                            }
                        ]
                    }
                },
                {
                    test: /baron(\.min)?\.js$/,
                    use: [
                        {
                            loader: 'string-replace-loader',
                            options: {
                                search: /\([01],\s*eval\)\(['"]this['"]\)/g,
                                replace: 'window'
                            }
                        },
                        {
                            loader: 'exports-loader',
                            options: { type: 'commonjs', exports: 'single baron' }
                        }
                    ]
                },
                { test: /handlebars/, loader: 'strip-sourcemap-loader' },
                {
                    test: /(kee-frontend|kprpc|kdbx-placeholders)\/dist\/.+\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
                },
                {
                    test: /\.js$/, exclude: /(node_modules)/, loader: 'babel-loader',
                    options: {
                        presets: [['@babel/preset-env', {
                            // 'targets': {
                            //     'browsers': [
                            //         'chrome >= 60'
                            //     ]
                            // },
                            'useBuiltIns': false,
                            'modules': 'cjs' // the default value is auto
                        }]],
                        plugins: ['@babel/plugin-transform-runtime'], cacheDirectory: true
                    }
                    // test: /\.js$/, exclude: /(node_modules|kee-frontend|kprpc|kdbx-placeholders)/, loader: 'babel-loader',
                },
                { test: /argon2\.wasm/, type: 'javascript/auto', loader: 'base64-loader' },
                { test: /argon2(\.min)?\.js/, loader: 'raw-loader' },
                {
                    test: /\.s?css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        { loader: 'css-loader', options: { sourceMap: devMode } },
                        { loader: 'postcss-loader', options: { sourceMap: devMode } },
                        { loader: 'sass-loader', options: { sourceMap: devMode } }
                    ]
                },
                {
                    test: /webfonts\/.*\.(woff|ttf|eot|svg)$/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                esModule: false
                            }
                        },
                        {
                            loader: 'ignore-loader'
                        }
                    ]
                },
                {
                    test: /webfonts\/.*\.(woff2)/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                esModule: false
                            }
                        }
                    ]
                }
            ]
        },
        // optimization.splitChunks.cacheGroups.vendors → optimization.splitChunks.cacheGroups.defaultVendors
        optimization: {
            runtimeChunk: false,
            // splitChunks: {
            //     cacheGroups: {
            //         vendor: {
            //             test: /[\\/]node_modules[\\/]/,
            //             name: 'vendor',
            //             chunks: 'all'
            //         }
            //     }
            // },
            minimizer: [
                // new TerserPlugin({
                //     cache: true,
                //     parallel: true,
                //     terserOptions: {
                //         compress: {
                //             comparisons: false
                //         },
                //         output: {
                //             comments: false
                //         }
                //     }
                // }),
                new OptimizeCSSAssetsPlugin({
                    cssProcessorPluginOptions: {
                        preset: ['default', { discardComments: { removeAll: true } }]
                    }
                }),
                new BundleAnalyzerPlugin({
                    openAnalyzer: false,
                    analyzerMode: 'static',
                    reportFilename: 'stats/analyzer_report.html',
                    generateStatsFile: true,
                    statsFilename: 'stats/stats.json'
                })
            ]
        },
        plugins: [
            new webpack.BannerPlugin('kee vault v' + pkg.version + ', (c) ' + year + ' ' + pkg.author.name +
                ', AGPLv3 with supplemental terms'),
            new webpack.ProvidePlugin({ _: 'underscore', $: 'jquery' }),
            new webpack.IgnorePlugin({ resourceRegExp: /^(moment)$/ }),
            // new StringReplacePlugin(),
            new MiniCssExtractPlugin({
                filename: 'css/[name].css'
            })
        ],
        node: {
            // console: false,
            // process: false,
            // crypto: false,
            // Buffer: false,
            __filename: false,
            __dirname: false
            // fs: false,
            // setImmediate: false,
            // path: false
        },
        externals: {
            xmldom: 'null',
            crypto: 'null',
            fs: 'null',
            path: 'null'
        },
        devtool: devMode ? 'source-map' : undefined
    };
}

module.exports.config = config;

// module.exports = {
//     //...
//     resolve: {
//       fallback: {
//         assert: require.resolve('assert'),
//         buffer: require.resolve('buffer'),
//         console: require.resolve('console-browserify'),
//         constants: require.resolve('constants-browserify'),
//         crypto: require.resolve('crypto-browserify'),
//         domain: require.resolve('domain-browser'),
//         events: require.resolve('events'),
//         http: require.resolve('stream-http'),
//         https: require.resolve('https-browserify'),
//         os: require.resolve('os-browserify/browser'),
//         path: require.resolve('path-browserify'),
//         punycode: require.resolve('punycode'),
//         process: require.resolve('process/browser'),
//         querystring: require.resolve('querystring-es3'),
//         stream: require.resolve('stream-browserify'),
//         string_decoder: require.resolve('string_decoder'),
//         sys: require.resolve('util'),
//         timers: require.resolve('timers-browserify'),
//         tty: require.resolve('tty-browserify'),
//         url: require.resolve('url'),
//         util: require.resolve('util'),
//         vm: require.resolve('vm-browserify'),
//         zlib: require.resolve('browserify-zlib'),
//       },
//     },
//   };
