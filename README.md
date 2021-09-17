# vue-comment-v2

>  一个基于canvas的对图片进行批注功能的vue2.0组件

![avatar](/dist/preview.png)

## 特性：

1、支持图片导出；

2、支持json导入和导出；

3、支持对图片的自定义批注；

## 安装：

```
npm install vue-comment-v2 --save
```

## 使用：

main.js

```
import Vue from 'vue';


import vueComment from 'vue-comment-v2';
import 'vue-comment-v2/lib/vue-comment-v2.css';


Vue.use(vueComment);

new Vue({
  render: (h) => h(App),
}).$mount('#app');
```

App.vue

```
<div style="height: 800px;">
  <vue-comment :src="imgSrc"></vue-comment>
</div>
```

## 组件：

props

- src { string }
  图片的地址
- jsonData { Object }
  json导入，还原已绘制的批注

## 事件：

#### savePng

导出图片

```
savePng(dataURL) {
  const link = document.createElement('a');
  link.download = 'ceshi.png';
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
},
```

#### savePng

导出json数据

```
saveJson(data) {
  console.log('sasa', JSON.stringify(data));
},
```

## Development

```
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```
