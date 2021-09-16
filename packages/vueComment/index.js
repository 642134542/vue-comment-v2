// 导入组件，组件必须声明 name

import vueComment from './main';

// 为组件添加 install 方法，用于按需引入
vueComment.install = function (Vue) {
  Vue.component(vueComment.name, vueComment);
};

export default vueComment;
