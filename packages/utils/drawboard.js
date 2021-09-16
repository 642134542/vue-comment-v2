/* eslint-disable */
import { fabric } from 'fabric-pure-browser';

const W = window;

export const DrawMode = {
    SELECT: 'select',   // 选择
    LINE: 'line',     // 画直线
    PEN: 'pen',      // 画笔，自由绘图
    RECT: 'rect',     // 画矩形
    CIRCLE: 'circle',   // 画圆形
    TEXT: 'text',     // 绘制文字
    CUSTOM: 'custom'   // 自定义绘制
}

// 默认笔刷样式
const DEFAULT_BRUSH_COLOR = '#000';
const DEFAULT_BRUSH_WIDTH = 2;
// 默认背景色
const DEFAULT_BACKGROUND_COLOR = '#fff';
// 透明色
const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)';
// 默认字体大小
const DEFAULT_FONT_SIZE = 16;
// 默认缩放比例
const DEFAULT_ZOOM = 1;
const DEFAULT_MIN_ZOOM = 0.2;
const DEFAULT_MAX_ZOOM = 3;

const noop = () => {};

export default class {
    /** 用于控制绘画频率 */
    draw_rate = 0;
    /** 窗口中页面的当前显示大小(缩放系数) */
    window_zoom = W.zoom ? W.zoom : 1;
    /** canvas zoom */
    canvas_zoom = DEFAULT_ZOOM;
    canvas_min_zoom = DEFAULT_MIN_ZOOM;
    canvas_max_zoom = DEFAULT_MAX_ZOOM;
    /** canvas element */
    canvas = null;
    /** fabric.Canvas 画板对象 */
    fCanvas = null;

    /** 当前是否正在绘制中 */
    in_drawing = false;
    /** 当前是否正在拖拽中 */
    in_dragging = false;
    /** 移动图像的坐标 */
    drag_last_posx = 0;
    drag_last_posy = 0;

    /** 存储鼠标 xy pos 信息 */
    from_mouse_info = { x: 0, y: 0 };
    to_mouse_info = { x: 0, y: 0 };
    /** 绘制模式 */
    draw_mode = DrawMode.SELECT;
    /** 笔刷样式 */
    brush_color = DEFAULT_BRUSH_COLOR;
    brush_width = DEFAULT_BRUSH_WIDTH;
    font_size = DEFAULT_FONT_SIZE;
    /** 当前正在绘制的 obj */
    current_draw_obj = null;
    /** 当前正在输入文本 */
    current_text_obj = null;
    /** 历史记录 */
    history = [];
    /** 事件 */
    back_event = noop;
    zoom_change = noop;
    drag_event = noop;
    /** 自定义绘制 */
    custom_draw_store = [];

    /** 获取适配后的鼠标 from/to pos */
    get_fix_mouse_info() {
        const from_pos = this.from_mouse_info;
        const to_pos = this.to_mouse_info;
        const zoom = this.canvas_zoom;
        const vtfx = this.fCanvas.viewportTransform ? this.fCanvas.viewportTransform[4] : 0;
        const vtfy = this.fCanvas.viewportTransform ? this.fCanvas.viewportTransform[5] : 0;

        return {
            from: {
                x: (from_pos.x / zoom) - (vtfx / zoom),
                y: (from_pos.y / zoom) - (vtfy / zoom)
            },
            to: {
                x: (to_pos.x / zoom) - (vtfx / zoom),
                y: (to_pos.y / zoom) - (vtfy / zoom)
            }
        };
    }

    constructor(options) {
        if (!options.canvas) {
            throw new Error('[drawboard] canvas element not found!');
        }
        this.canvas = options.canvas;
        this.fCanvas = new fabric.Canvas(this.canvas, {
            selection: false,
            skipTargetFind: true
        });
        // 初始化画板样式
        this.init_style(options);
        // 初始化画板事件
        this.init_event();
        // 初始化 mode
        this.set_mode(options.mode || DrawMode.PEN);

        if (options.back_event) {
            this.back_event = options.back_event;
        }
        if (options.zoom_change) {
            this.zoom_change = options.zoom_change;
        }
        if (options.drag_event) {
            this.drag_event = options.drag_event;
        }

        this.enable_select();
    }

    /**
     * 清空画板
     * state: 是否会清空历史记录
     */
    clear(state = false) {
        this.fCanvas.clear();
        this.current_text_obj = null;
        this.current_draw_obj = null;

        if (state) {
            this.save_state();
        } else {
            this.history = [];
        }
    }

    /**
     * destroy
     */
    destroyed() {
        this.clear();
        this.fCanvas.dispose();
    }

    /**
     * 初始化事件
     */
    init_event() {
        this.fCanvas.on('mouse:down', (options) => {
            const ev = options.e;

            if (ev.altKey) {
                this.in_drawing = false;
                this.fCanvas.isDrawingMode = false;

                this.in_dragging = true;
                this.fCanvas.selection = false;
                this.fCanvas.skipTargetFind = true;
                this.drag_last_posx = ev.clientX;
                this.drag_last_posy = ev.clientY;
                if (this.drag_event) { this.drag_event(true); }

                if (this.current_text_obj) {
                    // 退出文本编辑状态
                    this.current_text_obj.exitEditing();
                    this.current_text_obj = null;
                }

                ev.preventDefault();
                ev.stopPropagation();
                return;
            }

            this.save_mouse_info(options);
            this.in_drawing = true;
            this.save_state();
            ev.preventDefault();
            ev.stopPropagation();
        });

        this.fCanvas.on('mouse:up', (options) => {
            const ev = options.e;

            if (this.in_dragging) {
                this.in_dragging = false;
                if (this.drag_event) { this.drag_event(false); }
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }

            this.save_mouse_info(options, false);
            this.draw_in_up();
            this.current_draw_obj = null; // 鼠标抬起时，置空当前正在绘制的 obj，避免该对象在下次绘制时被删除
            this.in_drawing = false;
            ev.preventDefault();
            ev.stopPropagation();
        });

        this.fCanvas.on('mouse:move', (options) => {
            const ev = options.e;

            if (this.in_dragging) {
                if (!this.fCanvas.viewportTransform) { return; }
                const current_x = this.fCanvas.viewportTransform[4] + ev.clientX - this.drag_last_posx;
                const current_y = this.fCanvas.viewportTransform[5] + ev.clientY - this.drag_last_posy;

                this.fCanvas.viewportTransform[4] = current_x;
                this.fCanvas.viewportTransform[5] = current_y;
                this.drag_last_posx = ev.clientX;
                this.drag_last_posy = ev.clientY;
                this.fCanvas.requestRenderAll();
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }

            if ((this.draw_rate % 2 !== 0) && !this.in_drawing) { return; }
            this.save_mouse_info(options, false);

            // const x = (options.e as any).offsetX / this.window_zoom;
            // const y = (options.e as any).offsetY / this.window_zoom;
            // this.check_mouse_is_in_draw_area(x, y);

            this.draw_in_move();
            this.draw_rate++;
            ev.preventDefault();
            ev.stopPropagation();
        });

        // 滚轮缩放 (alt + whell 缩放)
        this.fCanvas.on('mouse:wheel', (options) => {
            // if (!options.e.altKey) { return; }
            // const delta = options.e.deltaY;
            // let zoom = this.fCanvas.getZoom();

            // zoom = zoom + delta / 10000;
            // this.set_zoom(zoom);
            // this.fCanvas.zoomToPoint({ x: options.e.offsetX, y: options.e.offsetY }, this.canvas_zoom);

            // options.e.preventDefault();
            // options.e.stopPropagation();

            // 避免缩放后，图片移动到看不到的地方
            // const vpt = this.fCanvas.viewportTransform;
            // if (!vpt || !this.fCanvas.viewportTransform) { return; }

            // if (zoom < 400 / 10000) {
            //   this.fCanvas.viewportTransform[4] = 200 - 1000 * zoom / 2;
            //   this.fCanvas.viewportTransform[5] = 200 - 1000 * zoom / 2;
            // } else {
            //   if (vpt[4] >= 0) {
            //     this.fCanvas.viewportTransform[4] = 0;
            //   } else if (vpt[4] < this.fCanvas.getWidth() - 1000 * zoom) {
            //     this.fCanvas.viewportTransform[4] = this.fCanvas.getWidth() - 1000 * zoom;
            //   }
            //   if (vpt[5] >= 0) {
            //     this.fCanvas.viewportTransform[5] = 0;
            //   } else if (vpt[5] < this.fCanvas.getHeight() - 1000 * zoom) {
            //     this.fCanvas.viewportTransform[5] = this.fCanvas.getHeight() - 1000 * zoom;
            //   }
            // }
        });
    }

    /**
     * 初始化画板样式
     */
    init_style(options) {
        this.fCanvas.setBackgroundColor(options.background_color || DEFAULT_BACKGROUND_COLOR, () => { });
        this.set_brush({
            color: options.brush_color || DEFAULT_BRUSH_COLOR,
            width: options.brush_width || DEFAULT_BRUSH_WIDTH
        });
    }

    /**
     * 设置笔刷属性
     */
    set_brush({
                  color,
                  width
              }) {
        if (color) {
            this.fCanvas.freeDrawingBrush.color = color;
            this.brush_color = color;
        }
        if (width) {
            this.fCanvas.freeDrawingBrush.width = width;
            this.brush_width = width;
        }

    }

    set_min_zoom(zoom) {
        this.canvas_min_zoom = zoom;
    }

    set_max_zoom(zoom) {
        this.canvas_max_zoom = zoom;
    }

    set_font_size(size) {
        this.font_size = size;
    }

    /**
     * 设置绘制模式
     */
    set_mode(mode) {
        this.in_drawing = false;
        this.fCanvas.isDrawingMode = false;
        this.draw_mode = mode;

        switch (mode) {
            // 画笔模式
            case DrawMode.PEN:
                break;
            // 选择模式
            case DrawMode.SELECT:
                this.fCanvas.selection = true;
                this.fCanvas.skipTargetFind = false;
                break;
            default:
                this.fCanvas.skipTargetFind = true; // 画板元素不能被选中
                this.fCanvas.selection = false;     // 画板不显示选中
        }

        if (this.current_text_obj) {
            // 退出文本编辑状态
            this.current_text_obj.exitEditing();
            this.current_text_obj = null;
        }
    }

    /**
     * 可选择模块
     */
    enable_select() {
        this.set_mode(DrawMode.SELECT);
    }

    /**
     * 删除选中的元素
     */
    delete_selected() {
        const objs = this.fCanvas.getActiveObjects();

        if (objs && objs.length) {
            objs.forEach((el) => {
                this.fCanvas.remove(el);
            });
        }
    }

    /**
     * 撤销
     */
    back() {
        if (this.back_event) {
            this.back_event(this.history);
        }
        if (!this.history.length) {
            this.clear();
            return;
        }
        if (this.current_text_obj) {
            this.current_text_obj.exitEditing();
        }
        this.current_text_obj = null;
        this.current_draw_obj = null;

        const last_state = this.history.pop();
        this.fCanvas.loadFromJSON(last_state, () => {
            this.fCanvas.renderAll();
        });
    }

    /** img to base64 */
    to_img(zoom) {
        // 还原缩放和移动位置
        this.canvas_zoom = DEFAULT_ZOOM;
        this.fCanvas.setZoom(zoom || this.canvas_zoom);

        this.drag_last_posx = 0;
        this.drag_last_posy = 0;
        if (this.fCanvas.viewportTransform) {
            this.fCanvas.viewportTransform[4] = 0;
            this.fCanvas.viewportTransform[5] = 0;
        }

        const multiplier = Math.floor(1 / zoom * 100) / 100;

        const params = { format: 'jpeg', quality: 1, multiplier };
        console.log('to_img: ', zoom, params);
        return this.fCanvas.toDataURL(params);
    }

    /** 设置文本 */
    set_text(options, state = false) {
        const box = this.draw_text(options);

        this.fCanvas.add(box);
        if (state) {
            this.save_state();
        }
    }

    /** 设置背景图片 */
    set_bg_img(
        {
            src = '',
            // angle = 0,
            catch: catchfn,
            finish: finishfn
        },
        state = false,
    ) {
        const temp_img = new Image();
        temp_img.src = src;
        temp_img.crossOrigin = 'anonymous';

        temp_img.onload = () => {
            fabric.Image.fromURL(src, (img) => {
                // 目前只支持 0 90 180 270 360
                // if (angle === 0 || angle === 360) {
                //   img.set({ originX: 'left', originY: 'bottom', angle });
                // } else if (angle === 90) {
                //   img.set({ originX: 'left', originY: 'bottom', angle });
                // } else if (angle === 180) {
                //   img.set({ originX: 'right', originY: 'bottom', angle });
                // } else if (angle === 270) {
                //   img.set({ originX: 'right', originY: 'top', angle });
                // }
                /* const center = this.fCanvas.getCenter();
                const Shape = new fabric.Image(temp_img, {
                    // 通过scale来设置图片大小，这里设置和画布一样大
                    scaleX: this.fCanvas.width / temp_img.width,
                    scaleY: this.fCanvas.height / temp_img.height,
                    top: center.top,
                    left: center.left,
                });
                this.fCanvas.setBackgroundImage(Shape, this.fCanvas.renderAll.bind(this.fCanvas)); */
                this.fCanvas.setBackgroundImage(img, this.fCanvas.renderAll.bind(this.fCanvas));
                this.fCanvas.requestRenderAll();

                if (state) { this.save_state(); }
                if (finishfn) { finishfn(src); }
            }, { crossOrigin: 'anonymous' });
        };

        temp_img.onerror = () => {
            if (catchfn) { catchfn(src); }
            if (finishfn) { finishfn(src); }
        };
    }

    /**
     * 获取鼠标的坐标信息
     */
    save_mouse_info(options, from = true) {
        const x = options.e.offsetX / this.window_zoom;
        const y = options.e.offsetY / this.window_zoom;

        if (from) {
            this.from_mouse_info = { x, y };
        } else {
            this.to_mouse_info = { x, y };
        }
    }

    /**
     * 存储当前状态
     */
    save_state() {
        const state = this.fCanvas.toJSON();

        this.history.push(state);
    }

    /** 绘制方法 - mouse move */
    draw_in_move() {
        if (!this.in_drawing) { return; }
        if (this.current_draw_obj) {
            this.fCanvas.remove(this.current_draw_obj);
        }
        let draw_obj = null;
        this.fCanvas.isDrawingMode = false;

        switch (this.draw_mode) {
            case DrawMode.RECT:
                draw_obj = this.draw_rect();
                break;
            case DrawMode.CIRCLE:
                draw_obj = this.draw_circle();
                break;
            case DrawMode.LINE:
                draw_obj = this.draw_line();
                break;
            case DrawMode.PEN:
                this.draw_pen();
                break;
            case DrawMode.CUSTOM:
                this.call_custom_draw_funcs('move');
                break;
        }

        if (draw_obj) {
            this.fCanvas.add(draw_obj);
            this.current_draw_obj = draw_obj;
        }
    }

    /** 绘制方法 - mouse up */
    draw_in_up() {
        if (!this.in_drawing) { return; }
        let draw_obj = null;

        switch (this.draw_mode) {
            case DrawMode.TEXT:
                draw_obj = this.draw_text({ edit: true });
                console.log(draw_obj)
                break;
            case DrawMode.CUSTOM:
                this.call_custom_draw_funcs('up');
                break;
        }

        if (draw_obj) {
            this.fCanvas.add(draw_obj);
            this.current_draw_obj = draw_obj;
        }
    }

    /** 绘制-矩形 */
    draw_rect() {
        const pos_info = this.get_fix_mouse_info();
        let left = pos_info.from.x;
        let top = pos_info.from.y;
        let to_x = pos_info.to.x;
        let to_y = pos_info.to.y;
        if (to_x - left < 0) {
            left = pos_info.to.x;
            to_x = pos_info.from.x;
        }
        if (to_y - top < 0) {
            top = pos_info.to.y;
            to_y = pos_info.from.y;
        }
        return new fabric.Rect({
            left,
            top,
            fill: TRANSPARENT_COLOR,
            width: Math.abs(to_x - left),
            height: Math.abs(to_y - top),
            stroke: this.brush_color,
            strokeWidth: this.brush_width
        });
    }

    /** 绘制-直线 */
    draw_line() {
        const pos_info = this.get_fix_mouse_info();
        const points = [pos_info.from.x, pos_info.from.y, pos_info.to.x, pos_info.to.y];

        return new fabric.Line(points, {
            stroke: this.brush_color,
            strokeWidth: this.brush_width
        });
    }

    /** 绘制-画笔 */
    draw_pen() {
        if (this.draw_mode !== DrawMode.PEN) { return; }
        this.fCanvas.isDrawingMode = true;
    }

    /** 绘制-圆 */
    draw_circle() {
        const pos_info = this.get_fix_mouse_info();
        let left = pos_info.from.x;
        let top = pos_info.from.y;
        let to_x = pos_info.to.x;
        let to_y = pos_info.to.y;
        if (to_x - left < 0) {
            left = pos_info.to.x;
            to_x = pos_info.from.x;
        }
        if (to_y - top < 0) {
            top = pos_info.to.y;
            to_y = pos_info.from.y;
        }
        const xLength = Math.abs(to_x - left);
        const yLength = Math.abs(to_y - top);
        const radius = Math.sqrt((xLength * xLength) + (yLength * yLength)) / 2;
        return new fabric.Circle({
            left,
            top,
            radius,
            fill: TRANSPARENT_COLOR, // 填充透明
            stroke: this.brush_color,
            strokeWidth: this.brush_width
        });
    }

    /** 绘制-文本 */
    draw_text({
                  left,
                  top,
                  width = 150,
                  text = [''],
                  edit = false,
                  color,
                  font_size,
                  angle = 0
              }) {
        const pos_info = this.get_fix_mouse_info();
        const leftv = left || pos_info.from.x;
        const topv = top || pos_info.from.y;

        if (this.current_text_obj) {
            this.current_text_obj.exitEditing();
            const content = this.current_text_obj.text || '';

            if (!content.length) {
                this.fCanvas.remove(this.current_text_obj);
            }
        }

        const plus = angle > 0 ? 100 : 0;

        const ssize = font_size || this.font_size;
        this.current_text_obj = new fabric.Textbox(text.join('\n'), {
            angle,
            left: leftv + plus,
            top: topv + plus,
            width,
            fill: color || this.brush_color,
            fontSize: ssize,
            hasControls: true,
            fontFamily: 'Microsoft YaHei'
        });

        if (edit) {
            this.current_text_obj.enterEditing();
            if (this.current_text_obj.hiddenTextarea) {
                this.current_text_obj.hiddenTextarea.focus();
            }
        }

        return this.current_text_obj;
    }

    /** 绘制自定义图形 */
    draw_path({
                  path,
                  stroke,
                  stroke_width,
                  fill = TRANSPARENT_COLOR
              }) {
        if (!path) {
            throw new Error('[drawboard] draw path error');
        }
        const strokev = stroke || this.brush_color;
        const stroke_widthv = stroke_width || this.brush_width;

        return new fabric.Path(path, {
            stroke: strokev,
            strokeWidth: stroke_widthv,
            fill
        });
    }

    /** 获取可调用的自定义绘制函数 */
    call_custom_draw_funcs(event) {
        const funcs = this.custom_draw_store.filter((c) => c.enable && c.event === event);
        const pos_info = this.get_fix_mouse_info();

        funcs.forEach((f) => {
            let obj = null;

            if (f.type === 'path') {
                obj = this.draw_path(f.get_draw_path_options(pos_info.from, pos_info.to, this.brush_width, this.canvas_zoom));
            } else if (f.type === 'text') {
                obj = this.draw_text(f.get_draw_text_options(this.font_size, this.canvas_zoom));
            }

            if (obj) {
                this.fCanvas.add(obj);
                this.current_draw_obj = obj;
            }
        });
    }

    /** 注册自定义绘制函数 */
    register_custom_draw_func({
                                  name,
                                  type = 'path',
                                  get_draw_path_options,
                                  get_draw_text_options,
                                  event = 'move',
                                  enable = false
                              }) {
        if (!name) {
            throw new Error('[drawboard] register_custom_draw_func error (name not found)');
        }

        // draw path
        if (type === 'path') {
            if (!get_draw_path_options) {
                throw new Error('[drawboard] register_custom_draw_func error (path get_draw_path_options not found)');
            }

            this.custom_draw_store.push({ name, type, get_draw_path_options, event, enable });
        }

        // draw text
        if (type === 'text') {
            if (!get_draw_text_options) {
                throw new Error('[drawboard] register_custom_draw_func error (text get_draw_text_options not found)');
            }

            this.custom_draw_store.push({ name, type, get_draw_text_options, event, enable });
        }
    }

    /** 切换自定义绘制函数 */
    set_custom_draw_func_enable(names) {
        this.set_mode(DrawMode.CUSTOM);
        this.custom_draw_store.forEach((c) => {
            if (names.indexOf(c.name) !== -1) {
                c.enable = true;
            } else {
                c.enable = false;
            }
        });
    }

    /** 设置缩放比例 */
    set_zoom(z, dont_trigger_change_event = false, set_origin = false) {
        let zoom = z;
        if (zoom > this.canvas_max_zoom) { zoom = this.canvas_max_zoom; }
        if (zoom < this.canvas_min_zoom) { zoom = this.canvas_min_zoom; }

        this.canvas_zoom = zoom;
        if (!dont_trigger_change_event) {
            if (this.zoom_change) {
                this.zoom_change(this.canvas_zoom);
            }
        }
        this.fCanvas.setZoom(this.canvas_zoom);

        // 重置为坐标 0,0
        if (set_origin && this.fCanvas.viewportTransform) {
            this.fCanvas.viewportTransform[4] = 0;
            this.fCanvas.viewportTransform[5] = 0;
        }
    }

    /** 判断鼠标是在在图片范围内 */
    check_mouse_is_in_draw_area(x, y) {
        const width = this.fCanvas.getWidth() * this.canvas_zoom;
        const height = this.fCanvas.getHeight() * this.canvas_zoom;

        if (this.fCanvas.viewportTransform) {
            if (x < this.fCanvas.viewportTransform[4] || y < this.fCanvas.viewportTransform[5]
                || x > (this.fCanvas.viewportTransform[4] + width)
                || y > (this.fCanvas.viewportTransform[5] + height)) {
                return false; // 绘制在图片范围外
            }
        }

        return true;
    }
    /* 导出 */
    exportCanvas() {
        const dataURL = this.fCanvas.toDataURL({
            width: this.fCanvas.width,
            height: this.fCanvas.height,
            left: 0,
            top: 0,
            format: 'png',
        });
        return new Promise((resolve) => {
            resolve(dataURL);
        }).catch()
    }
    // 导出的Json
    exportToJson() {
        const currState = this.fCanvas.toJSON(); // 导出的Json如下图
        return new Promise((resolve) => {
            resolve(currState);
        }).catch()
    }

    initJson(data) {
        this.fCanvas.loadFromJSON(data, () => {
            this.fCanvas.renderAll();
        });
    }

}

