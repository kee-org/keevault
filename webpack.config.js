const path = require('path');

const webpack = require('webpack');

const StringReplacePlugin = require('string-replace-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
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
            }
        },
        module: {
            rules: [
                {
                    test: /\.hbs$/, loader: StringReplacePlugin.replace('handlebars-loader', {
                        replacements: [{ pattern: /\r?\n\s*/g, replacement: () => '\n' }]
                    })
                },
                {
                    test: /runtime-info\.js$/, loader: StringReplacePlugin.replace({
                        replacements: [
                            { pattern: /@@VERSION/g, replacement: () => pkg.version + (grunt.option('beta') ? '-beta' : '') },
                            { pattern: /@@BETA/g, replacement: () => grunt.option('beta') ? '1' : '' },
                            { pattern: /@@DATE/g, replacement: () => dt },
                            { pattern: /@@COMMIT/g, replacement: () => grunt.config.get('gitinfo.local.branch.current.shortSHA') }
                        ]
                    })
                },
                {
                    test: /baron(\.min)?\.js$/,
                    use: [
                        StringReplacePlugin.replace({
                            replacements: [
                                { pattern: /\([01],\s*eval\)\(['"]this['"]\)/g, replacement: () => 'window' }
                            ]
                        }),
                        {
                            loader: 'exports-loader',
                            options: { type: 'commonjs', exports: 'single baron' }
                        }
                    ]
                },
                // {test: /pikaday\.js$/, loader: 'uglify-loader'},
                {test: /handlebars/, loader: 'strip-sourcemap-loader'},
                {
                    test: /(kee-frontend|kprpc|kdbx-placeholders)\/dist\/.+\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
                },
                {
                    test: /\.js$/, exclude: /(node_modules)/, loader: 'babel-loader',
                    query: {presets: [['@babel/preset-env', {
                        // 'targets': {
                        //     'browsers': [
                        //         'chrome >= 60'
                        //     ]
                        // },
                        'useBuiltIns': false,
                        'modules': 'cjs' // the default value is auto
                    }]],
                    plugins: ['@babel/plugin-transform-runtime'], cacheDirectory: true}
                    // test: /\.js$/, exclude: /(node_modules|kee-frontend|kprpc|kdbx-placeholders)/, loader: 'babel-loader',
                },
                {test: /argon2\.wasm/, type: 'javascript/auto', loader: 'base64-loader'},
                {test: /argon2(\.min)?\.js/, loader: 'raw-loader'},
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
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor',
                        chunks: 'all'
                    }
                }
            },
            minimizer: [
                new TerserPlugin({
                    cache: true,
                    parallel: true,
                    terserOptions: {
                        compress: {
                            comparisons: false
                        },
                        output: {
                            comments: false
                        }
                    }
                }),
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
            new webpack.ProvidePlugin({_: 'underscore', $: 'jquery'}),
            new webpack.IgnorePlugin(/^(moment)$/),
            new StringReplacePlugin(),
            new MiniCssExtractPlugin({
                filename: 'css/[name].css'
            })
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
        },
        devtool: devMode ? 'source-map' : undefined
    };
}

module.exports.config = config;
