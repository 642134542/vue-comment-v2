/* eslint-disable */
/* 配置参考 https://cli.vuejs.org/zh/config/#vue-config-js */
const path = require('path');

// const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');
function resolve(dir) {
  return path.resolve(__dirname, dir);
}
module.exports = {
  // 基本路径
  publicPath: './',
  // 输出文件目录
  outputDir: 'dist',
  assetsDir: 'assets', // 静态资源目录 (js, css, img, fonts)
  // eslint-loader 是否在保存的时候检查
  lintOnSave: true,
  // use the full build with in-browser compiler?
  // webpack-dev-server 相关配置
  // 将 examples 目录添加为新的页面
  pages: {
    index: {
      // page 的入口
      entry: 'examples/main.js',
      // 模板来源
      template: 'public/index.html',
      // 输出文件名
      filename: 'index.html'
    }
  },
  devServer: {
    host: '0.0.0.0',
    port: 9527,
    hot: true,
    open: true,
  },
  configureWebpack: {
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        '@': resolve('examples'),
      },
    },
    plugins: [
      new CompressionPlugin({
        test: /\.js$|\.html$|.\css/, // 匹配文件名
        threshold: 10240, // 对超过10k的数据压缩
        deleteOriginalAssets: false, // 不删除源文件
      }),
    ],
  },
  css: {
    loaderOptions: { // 向 CSS 相关的 loader 传递选项
      less: {
        sourceMap: true,
        javascriptEnabled: true,
      },
    },
  },
  chainWebpack: config => {
    // set svg-sprite-loader
    config.module
      .rule('svg')
      .exclude.add(resolve('packages/icons'))
      .end()
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('packages/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
      .end()
  },
  // 生产环境是否生成 sourceMap 文件
  productionSourceMap: false,
  // use thread-loader for babel & TS in production build
  // enabled by default if the machine has more than 1 cores 构建时开启多进程处理babel编译
  parallel: require('os').cpus().length > 1,
  // 第三方插件配置
  pluginOptions: {
    // ...
  },
};
