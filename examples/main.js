import Vue from 'vue';
import { Input, ColorPicker, Slider, Button } from 'element-ui';

import App from './App';

import 'element-ui/lib/theme-chalk/index.css';
import vueComment from '../packages/index';

Vue.config.productionTip = false;

Vue.use(Input);
Vue.use(ColorPicker);
Vue.use(Slider);
Vue.use(Button);
Vue.use(vueComment);

new Vue({
  render: (h) => h(App),
}).$mount('#app');
