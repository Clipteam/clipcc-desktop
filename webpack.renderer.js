const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const makeConfig = require('./webpack.makeConfig.js');

const getModulePath = moduleName => path.dirname(require.resolve(`${moduleName}/package.json`));

module.exports = defaultConfig =>
    makeConfig(
        defaultConfig,
        {
            name: 'renderer',
            useReact: true,
            disableDefaultRulesForExtensions: ['js', 'jsx', 'css', 'svg', 'png', 'wav', 'gif', 'jpg', 'ttf'],
            babelPaths: [
                path.resolve(__dirname, 'src', 'renderer'),
                /node_modules[\\/]+scratch-[^\\/]+[\\/]+src/,
                /node_modules[\\/]+clipcc-[^\\/]+[\\/]+src/,
                /node_modules[\\/]+pify/,
                /node_modules[\\/]+@vernier[\\/]+godirect/
            ],
            plugins: [
                new CopyWebpackPlugin([{
                    from: path.join(getModulePath('clipcc-gui'), 'dist', 'static'),
                    to: 'static'
                }]),
                new CopyWebpackPlugin([{
                    from: path.join(getModulePath('clipcc-block'), 'media'),
                    to: 'static/blocks-media'
                }]),
                new CopyWebpackPlugin([{
                    from: 'extension-worker.{js,js.map}',
                    context: path.join(getModulePath('clipcc-vm'), 'dist', 'web')
                }]),
                new CopyWebpackPlugin([{
                    from: path.join(getModulePath('clipcc-gui'), 'src', 'lib', 'libraries', '*.json'),
                    to: 'static/libraries',
                    flatten: true
                }])
            ]
        }
    );
