<template>
  <div class="draw-canvas">
    <div class="tool-bar">
      <ul class="clearfix">
        <li class="fl d-btn-item" v-for="obj in operationList"
            :key="obj.id">
          <button class="cd-image--btn" :class="{ 'is-active': obj.id === current_button_index }"
                  :title="obj.name" @click="button_clicked(obj.id)">
            <svg-icon :icon-class="obj.icon"></svg-icon>
          </button>
        </li>
      </ul>
    </div>
    <div class="canvas-main">
      <div class="cd-draw-select">
        <div class="picker_item color_picker">
          <span class="picker_title">颜色:</span>
          <el-color-picker title="选择颜色" v-model="color" :show-alpha="true" size="mini" />
        </div>

        <div class="picker_item size_picker">
          <span class="picker_title">笔触:</span>
          <el-input class="picker_input" v-model="size_input_val" size="mini">
            <el-button slot="append" :icon="!show_picker_slider ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
                       @click.stop="show_picker_slider = !show_picker_slider" />
          </el-input>
          <div class="picker_slider" v-show="show_picker_slider">
            <el-slider input-size="mini" :show-tooltip="false" v-model="size_picker_val"
                       :max="picker_min_max_size.max"
                       :min="picker_min_max_size.min" />
          </div>
        </div>
      </div>
      <div class="draw_wrapper" ref="draw_wrapper" id="drawWrapper">
        <canvas ref="canvas" id="canvasId"
                :width="canvas_wh.width"
                :height="canvas_wh.height">你的浏览器不支持 canvas，请升级你的浏览器</canvas>
      </div>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
import SvgIcon from '../SvgIcon';
import '../icons';
// import '../less/canvas-draw.less';
import Drawboard, { DrawMode } from '../utils/drawboard';
import { register_arror_draw } from '../utils/custom';
import { get_image_natural_wh } from '../utils/common';

const DEFAULT_MODE = 100; // 默认画笔模式
const DEFAULT_ANGLE = 0; // 默认旋转角度
const DEFAULT_ZOOM = 100; // 默认缩放比例
const DEFAULT_COLOR = '#FF0000'; // 默认颜色

// 字体大小
const DEFAULT_FONT_SIZE = 32; // 默认字体大小
const DEFAULT_MAX_FONT_SIZE = 128;
const DEFAULT_MIN_FONT_SIZE = 16;

// 线宽大小
const DEFAULT_BRUSH_WIDTH = 4;
const DEFAULT_MAX_BRUSH_WIDTH = 32;
const DEFAULT_MIN_BRUSH_WIDTH = 4;

const ROTATE_DIALOG_KEY = 'noshowdrawrotatedialog';
const ROTATE_DIALOG_VAL = '1';
export default {
  name: 'vueComment',
  components: {
    SvgIcon,
  },
  props: {
    src: {
      type: String,
    },
    jsonData: {
      type: Object,
    },
  },
  data() {
    return {
      operationList: [
        {
          id: 100,
          name: '选择',
          icon: 'select',
        },
        {
          id: 1,
          name: '方框',
          icon: 'rect',
        },
        {
          id: 2,
          name: '圆形',
          icon: 'ellipse',
        },
        {
          id: 3,
          name: '箭头',
          icon: 'arrow',
        },
        {
          id: 4,
          name: '画线',
          icon: 'line',
        },
        {
          id: 5,
          name: '画笔',
          icon: 'pen',
        },
        {
          id: 6,
          name: '文本',
          icon: 'text',
        },
        {
          id: 7,
          name: '删除',
          icon: 'delete',
        },
        {
          id: 50,
          name: '撤销',
          icon: 'undo',
        },
        {
          id: 51,
          name: '清屏',
          icon: 'clean',
        },
        {
          id: 52,
          name: '导出图片',
          icon: 'exportImg',
        },
        {
          id: 53,
          name: '导出json',
          icon: 'exportJson',
        }
      ],
      img_loading: false,
      drawboard: null,
      current_button_index: 100,
      // 颜色
      color: DEFAULT_COLOR,
      // 处于移动模式
      in_move_mode: false,
      rotate_angle: DEFAULT_ANGLE,
      init_zoom: DEFAULT_ZOOM / 100,
      zoom: DEFAULT_ZOOM,
      font_size: DEFAULT_FONT_SIZE,
      canvas_wh: { width: 1000, height: 450 },
      brush_width: DEFAULT_BRUSH_WIDTH,
      rotate_dialog: false,
      rotate_dialog_checked: false,
      current_size_mode_is_font: false,
      size_input_val: DEFAULT_BRUSH_WIDTH,
      size_picker_val: DEFAULT_BRUSH_WIDTH,
      show_picker_slider: false,
      init_state: { is_img: false, img_check: true, data: '' },
    };
  },
  created() {
    // this.imgUrl = require('@/assets/234.jpg');
  },
  watch: {
    color: {
      handler() {
        if (!this.drawboard) { return; }

        this.drawboard.set_brush({color: this.color, width: this.brush_width});
      },
    },
    brush_width: {
      handler() {
        if (!this.drawboard) { return; }
        this.set_zoom_size();
      },
    },
    font_size: {
      handler() {
        if (!this.drawboard) { return; }
        this.set_zoom_size();
      },
    },
    size_input_val: {
      handler() {
        this.size_picker_val= Number(this.size_input_val);
      },
    },
    size_picker_val: {
      handler() {
        this.size_input_val = this.size_picker_val;

        if (this.current_size_mode_is_font) {
          this.font_size = this.size_picker_val;
        } else {
          this.brush_width = this.size_picker_val;
        }
      },
    },
    current_button_index: {
      handler() {
        this.current_size_mode_is_font = [6].indexOf(this.current_button_index) !== -1;
      },
    },
    current_size_mode_is_font: {
      handler(val) {
        this.size_input_val = val ? this.font_size : this.brush_width;
      },
    },
    src: {
      handler() {
        this.$nextTick(() => {
          this.imgUrl = this.src;
          this.draw(this.imgUrl);
        });
      },
      immediate: true,
    },
    jsonData: {
      handler() {
        this.restoreJson(this.jsonData);
      },
    },
  },
  computed: {
    picker_min_max_size() {
      if (this.current_size_mode_is_font) {
        return {min: DEFAULT_MIN_FONT_SIZE, max: DEFAULT_MAX_FONT_SIZE};
      }
      return {min: DEFAULT_MIN_BRUSH_WIDTH, max: DEFAULT_MAX_BRUSH_WIDTH};
    },
  },
  mounted() {
    // this.init_drawboard();
    this.delete_event = this.delete_handler.bind(this);
    window.addEventListener('keyup', this.delete_event);
  },
  destroyed() {
    window.removeEventListener('keyup', this.delete_event);
    if (!this.drawboard) { return; }
    this.drawboard.destroyed();
  },
  methods: {
    /* 有数据的时候初始化画布 */
    initDataCanvas(data) {
      console.log('data', data);
      this.destroy_drawboard();
      this.init_drawboard(true, data)
    },
    init_drawboard(isLoad = false, data) {
      if (this.drawboard) {
        return;
      }
      const $canvas = this.$refs.canvas;
      if (!$canvas) {
        console.error('[draw-dialog] canvas not found!');
        return;
      }
      this.drawboard = new Drawboard({
        canvas: document.getElementById('canvasId'),
        brush_color: this.color,
        brush_width: DEFAULT_BRUSH_WIDTH,
        mode: DrawMode.PEN,
        back_event: (history) => {
          if (!history.length) {
            this.$message.warning('没有可撤销的记录了');
            this.destroy_drawboard();
            this.draw_init_state();
          }
        },
        zoom_change: (zoom) => {
          const scale = zoom / this.init_zoom;
          this.zoom = parseInt(`${scale * 100}`, 10);
          this.set_zoom_size();
        },
        drag_event: (status) => {
          if (status) {
            this.in_move_mode = false;
          }
        },
      });
      console.log('this.drawboard', this.drawboard)
      this.current_button_index = DEFAULT_MODE;
      this.register_custom_draw_func();
      if (isLoad) {
        this.drawboard.set_min_zoom(0.2 * this.init_zoom);
        this.drawboard.set_max_zoom(3 * this.init_zoom);
        this.drawboard.set_zoom(this.init_zoom);
        this.drawboard.initJson(data)
        this.init_state.is_img = true;
        this.init_state.img_check = true;
        this.init_state.data = data.backgroundImage.src;
      }
    },
    draw(str) {
      const box = document.getElementById('drawWrapper');
      const win_height = box.offsetHeight;
      const win_width = box.offsetWidth;
      this.canvas_wh = {width: win_width, height: win_height};
      this.set_img(str);
    },
    restoreJson(data) {
      const box = document.getElementById('drawWrapper');
      const win_height = box.offsetHeight;
      const win_width = box.offsetWidth;
      this.canvas_wh = { width: win_width, height: win_height };
      // 加载画布信息
      this.destroy_drawboard();
      get_image_natural_wh(data.backgroundImage.src).then((res2) => {
        const { naturalWidth, naturalHeight } = res2;
        const aspectRatio = naturalWidth / naturalHeight;
        let boxWidth = this.canvas_wh.width;
        let boxHeight = this.canvas_wh.height;

        if (this.canvas_wh.height * aspectRatio > this.canvas_wh.width) {
          boxHeight = this.canvas_wh.width / aspectRatio;
        } else {
          boxWidth = this.canvas_wh.height * aspectRatio;
        }

        boxWidth = Math.min(boxWidth, naturalWidth);
        boxHeight = Math.min(boxHeight, naturalHeight);
        document.getElementById('canvasId').width = boxWidth
        document.getElementById('canvasId').height = boxHeight
        let zoom = 1;
        if (naturalWidth > this.canvas_wh.width) {
          zoom = boxWidth / naturalWidth;
        }
        this.init_zoom = zoom;
        this.init_drawboard(true, data);
        // this.font_size = this.font_size / zoom;
      })
    },
    /** 设置图片 */
    async set_img(src, angle = DEFAULT_ANGLE, imgcheck = true) {
      this.img_loading = true;
      // const img_src = network_url_replace_to_root_url(get_img_src_or_url(src));
      const img_src = src;
      console.log('draw_dialog url: ', src, img_src);

      const set_error_img = () => {
        console.warn('drawing_board load image error ', img_src);
        this.drawboard.set_text({ text: ['图片加载失败:   ' + img_src], left: 15, top: 15, color: 'red' });
      };
      const finish = () => { this.img_loading = false; };

      try {
        let { naturalWidth, naturalHeight } = await get_image_natural_wh(img_src);
        console.log('naturalWidth, naturalHeight', naturalWidth, naturalHeight)
        const aspectRatio = naturalWidth / naturalHeight;
        let boxWidth = this.canvas_wh.width;
        let boxHeight = this.canvas_wh.height;


        if (this.canvas_wh.height * aspectRatio > this.canvas_wh.width) {
          boxHeight = this.canvas_wh.width / aspectRatio;
        } else {
          boxWidth = this.canvas_wh.height * aspectRatio;
        }

        boxWidth = Math.min(boxWidth, naturalWidth);
        boxHeight = Math.min(boxHeight, naturalHeight);
        document.getElementById('canvasId').width = boxWidth
        document.getElementById('canvasId').height = boxHeight


        if (angle === 90 || angle === 270) {
          const tempw = naturalWidth;
          naturalWidth = naturalHeight;
          naturalHeight = tempw;
        }

        let zoom = 1;
        if (naturalWidth > this.canvas_wh.width) {
          zoom = boxWidth / naturalWidth;
          // naturalHeight = naturalHeight * zoom;
        }
        this.init_zoom = zoom;

        await this.reset_canvas();
        if (!this.drawboard) {
          finish();
          return;
        }
        if (this.drawboard) {
          // this.font_size = this.font_size / zoom;
          this.drawboard.set_bg_img({ src: img_src, angle, catch: set_error_img, finish });
          this.drawboard.set_min_zoom(0.2 * zoom);
          this.drawboard.set_max_zoom(3 * zoom);
          this.drawboard.set_zoom(zoom);
        }
      } catch (err) {
        this.reset_canvas();
        set_error_img();
        finish();
      }

      this.init_state.is_img = true;
      this.init_state.img_check = imgcheck;
      this.init_state.data = src;
    },
    /** 注册自定义绘图函数 */
    register_custom_draw_func() {
      if (!this.drawboard) { return; }
      // 箭头
      register_arror_draw('箭头', this.drawboard);
      // 勾
      // register_right_draw(this.btn_names[8], this.drawboard);
      // 叉
      // register_wrong_draw(this.btn_names[9], this.drawboard);
      // A+
      // register_aplus_draw(this.btn_names[10], this.drawboard);
      // A-
      // register_aminus_draw(this.btn_names[11], this.drawboard);

    },
    /** 按比例设置线宽和字体大小 */
    set_zoom_size() {
      if (!this.drawboard) { return; }
      const zoom = this.zoom / 100;
      this.drawboard.set_brush({width: this.brush_width / zoom});
      this.drawboard.set_font_size(this.font_size / zoom);
      console.log(`'当前比例: ${zoom}; 当前线宽: ${this.brush_width}/${this.brush_width / zoom}; 字体为: ${this.font_size}/${this.font_size / zoom}`);
    },
    draw_init_state() {
      if (this.init_state.is_img) {
        this.set_img(this.init_state.data, this.rotate_angle, this.init_state.img_check);
      }
    },
    /** 键盘事件-删除 */
    delete_handler(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      // DEL 删除按钮
      if (ev.keyCode !== 46) { return; }
      this.delete_selected();
    },
    /** 删除 */
    delete_selected() {
      if (!this.drawboard) { return; }
      this.drawboard.delete_selected();
    },
    async reset_canvas() {
      await this.$nextTick();
      this.destroy_drawboard();
      this.init_drawboard();
    },
    destroy_drawboard() {
      if (this.drawboard) {
        this.drawboard.destroyed();
      }
      this.drawboard = null;
    },
    /* 移动 */
    change_move_mode() {
      if (!this.drawboard) { return; }
      this.in_move_mode = !this.in_move_mode;
      if (this.in_move_mode) {
        this.drawboard.enable_select();
      } else {
        this.button_clicked(this.current_button_index);
      }
    },
    button_clicked(button_index) {
      if (!this.drawboard) { return; }

      // 退出移动模式
      if (this.in_move_mode && ([50, 51].indexOf(button_index) === -1)) {
        this.in_move_mode = false;
      }
      switch (button_index) {
        case 100: // 选择
          this.change_move_mode();
          this.current_button_index = button_index;
          break;
        case 1: // 画矩形
          this.drawboard.set_mode(DrawMode.RECT);
          this.current_button_index = button_index;
          break;
        case 2: // 画圆
          this.drawboard.set_mode(DrawMode.CIRCLE);
          this.current_button_index = button_index;
          break;
        case 3: // 画箭头
          this.drawboard.set_custom_draw_func_enable(['箭头']);
          this.current_button_index = button_index;
          break;
        case 4: // 画直线
          this.drawboard.set_mode(DrawMode.LINE);
          this.current_button_index = button_index;
          break;
        case 5: // 画笔
          this.drawboard.set_mode(DrawMode.PEN);
          this.current_button_index = button_index;
          break;
        case 6: // 输入文字
          this.drawboard.set_mode(DrawMode.TEXT);
          this.current_button_index = button_index;
          break;
        case 7: // 删除
          this.delete_selected();
          break;
        case 50: // 撤销
          this.drawboard.back();
          break;
        case 51: // 清屏
          this.drawboard.clear();
          this.draw_init_state();
          break;
        case 52:
          this.exportToImage();
          break;
        case 53:
          this.exportToJson();
          break;

              /* case 9: // 勾
                this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                this.current_button_index = button_index;
                break;
              case 10: // 叉
                this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                this.current_button_index = button_index;
                break;
              case 10: // A+
                this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                this.current_button_index = button_index;
                break;
              case 11: // A-
                this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                this.current_button_index = button_index;
                break;
              case 12: // 旋转
              const status = window.localStorage.getItem(ROTATE_DIALOG_KEY);
                if (status === ROTATE_DIALOG_VAL) {
                  this.rotate();
                } else {
                  this.rotate_dialog = true;
                }
                break;*/
      }
    },
    exportToImage() {
      this.drawboard.exportCanvas().then((res) => {
        this.$emit('savePng', res)
      });
    },
    exportToJson() {
      this.drawboard.exportToJson().then((res) => {
        this.$emit('saveJson', res)
      });
    },
  },
};
</script>

<style type="text/css">
  canvas,
  div,
  button,
  ol,
  ul {
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    font-size: 100%;
    vertical-align: baseline;
    background: transparent;
  }
  ol, ul {
    list-style: none;
  }

  .fl { float: left; }

  .fr { float: right; }

  .clearfix::before,
  .clearfix::after {
    content: " ";
    display: table;
  }
  .draw-canvas {
    display: flex;
    height: 100%;
    flex-direction: column;
    flex-basis: auto;
    box-sizing: border-box;
    min-width: 0;
    background-color: rgba(0, 0, 0, 0.5);
  }
  .draw-canvas .tool-bar {
    height: 42px;
    width: 100%;
    background-color: #164f7f;
  }
  .draw-canvas .canvas-main {
    flex: 1;
  }
  .canvas-main {
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .canvas-main .draw_wrapper {
    flex: 1;
  }
  .canvas-container {
    margin: 0 auto;
  }
  .cd-image--btn {
    display: inline-block;
    width: 60px;
    height: 42px;
    line-height: 42px;
    white-space: nowrap;
    cursor: pointer;
    color: #fff;
    -webkit-appearance: none;
    text-align: center;
    box-sizing: border-box;
    outline: 0;
    margin: 0;
    transition: 0.1s;
    font-weight: 500;
    padding: 0;
    font-size: 20px;
    border-radius: 0;
    border-color: transparent;
    background-color: transparent;
  }
  .cd-image--btn.is-active,
  .cd-image--btn:hover {
    background-color: hsla(0, 0%, 84.7%, 0.2);
  }
  textarea[data-fabric-hiddentextarea] {
    top: 0;
    left: 0;
  }
  .cd-draw-select {
    position: absolute;
    top: 0;
    right: 15px;
    z-index: 33;
    color: #fff;
  }
  .cd-draw-select .picker_item {
    position: relative;
  }
  .cd-draw-select .picker_title {
    vertical-align: middle;
    color: #fff;
    margin-right: 4px;
  }
  .cd-draw-select .el-color-picker {
    vertical-align: middle;
  }
  .cd-draw-select .el-color-picker__trigger {
    border: none;
    width: 70px;
  }
  .cd-draw-select .el-color-picker__color {
    width: 70px;
  }
  .cd-draw-select .el-color-picker__icon {
    left: 55px;
  }
  .cd-draw-select .picker_input {
    width: 64px;
    height: 24px;
    margin-left: 4px;
  }
  .cd-draw-select .picker_input .el-input__inner {
    padding: 0 5px;
  }
  .cd-draw-select .el-input-group__append {
    padding: 0 4px;
    color: #333;
    background-color: #EBEBEB;
  }
  .picker_slider {
    position: absolute;
    top: 24px;
    right: 0;
    width: 140px;
    padding: 0 14px;
    background-color: #EBEBEB;
  }
  .picker_slider .el-slider {
    width: 112px;
  }
  .picker_slider .el-slider__bar {
    background-color: #595959;
  }
  .picker_slider .el-slider__button-wrapper .el-tooltip {
    border-color: #595959;
  }
  .picker_slider .el-slider__runway {
    background-color: #ccc;
  }
</style>
