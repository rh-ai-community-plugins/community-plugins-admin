const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-source-map',
  devServer: {
    port: parseInt(process.env.PORT, 10) || 9500, // [PLUGIN-SPECIFIC] dev port
    historyApiFallback: true,
    hot: true,
    proxy: [
      {
        context: ['/community-plugins-admin/api'], // [PLUGIN-SPECIFIC] BFF proxy — must come before the general proxy
        target: 'http://localhost:3000',
        pathRewrite: { '^/community-plugins-admin/api': '/api' },
      },
      {
        context: ['/community-plugins-admin'], // [PLUGIN-SPECIFIC] must match route prefix
        target: 'http://localhost:8443',
        pathRewrite: { '^/community-plugins-admin': '/community-plugins-admin' },
      },
    ],
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  },
});
