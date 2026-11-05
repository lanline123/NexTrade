# H5 编辑器模块移植规范（Vue → React/NutUI）

把 `view/admin/src/views/decorate/decorate/editor/modules/**` 下的 Vue 模块移植为
`rust/web/admin-semi/src/pages/decorateEditorH5/modules/**` 下的 React 模块。

## 范本（必须先读）

- 范本模块：`modules/basic/imageAd/{index.tsx,Preview.tsx,Settings.tsx}`
- 契约层：`contract/{types.ts,constants.ts,moduleRegistry.ts,sharedDefaults.ts,normalize.ts}`
- 共享预览件：`shared/{format.ts,CommonTitle.tsx,H5Countdown.tsx,BuyButton.tsx,settingWidgets.tsx}`

## 每个模块 3 个文件

### 1. `index.tsx` — 注册 + 默认值（契约文件，最重要）

- 把 Vue 模块 `index.ts` 里的 `xxxDefaults` **逐字段原样复制**（数值/字符串/数组/嵌套结构一字不差），
  其中 `frame: defaultFrame`、`title: defaultTitle`、`moduleStyle: defaultModuleStyle` 等
  从 `../../../contract/sharedDefaults` 导入（deep 结构用 `cloneDeep()` 包裹）。
- `registerModule({ type, label, icon, url, platform, order, preview, settings, getDefaultValue })`：
  - `type`/`label`/`url`/`order` 与 Vue 版一致；`icon` 用 emoji 占位（如 `'<i class="h5-mod-ico">🖼️</i>'`）。
  - `preview: () => import("./Preview")`、`settings: () => import("./Settings")`。
  - 不进工具栏的模块（Vue 版 `visible: false`）：加 `visible: false`。

### 2. `Preview.tsx` — 画布预览（视觉契约）

- 组件签名：`export default function XxxPreview({ data }: { data: Record<string, any> })`
- 开头合并默认值（与 Vue 版 `mergeDefaultModule` 行为一致）：
  ```tsx
  const module = useMemo(() => {
      const merged = JSON.parse(JSON.stringify(data ?? {}));
      mergeDefaultModule(merged, xxxDefaults);
      return merged;
  }, [data]);
  ```
- **模板结构、类名逐字保留** Vue Preview.vue 的 class（`module-ad-con module-xxx ...`），
  样式来自已移植的全局 `styles/css/module.css`；Vue `<style scoped>` 里的专属样式
  移到 `Preview.css`（rpx→px 换算：1rpx=0.5px；`v-bind(...)` 换成内联 style）。
- Vue 模板 → React 映射：
  - `<view>`→`<div>`、`<image>`→`<img>`、`<block>`→`<Fragment>`/条件渲染、`v-if`→`&&`/三元、
    `v-for`→`.map()`（key 必须加）、`v-model`→受控值。
  - 样式串拼接（`:style="frameFormat.xxx + ..."`）→ `style={cssText(a, b, c)}`（shared/format）。
  - `imageFormat(item.picUrl)` / `productImage(...)` / `pickPic(...)` 从 `shared/format` 导入。
  - `<CommonTitle v-model="title">` → `<CommonTitle data={module.title} />`（仅 `title?.showTitle` 时渲染，
    Vue 版内部判断 showTitle，这里外层判断亦可，保持渲染结果一致）。
  - 购买按钮 → `import BuyButton from "../../../shared/BuyButton"`。
  - 倒计时 → `import H5Countdown from "../../../shared/H5Countdown"`。
  - 轮播 → NutUI：`import { Swiper, SwiperItem } from "@nutui/nutui-react"`，
    props：`autoplay={3000}`、`loop`、`onChange`、`indicator={<自定义圆点>}`（参考 imageAd 范本 renderDots）。
  - 预览不可点击：跳转点击一律不绑（或 onClick 空实现）。
- 空状态（`module-ad-empty` 等）与 Vue 版一致。

### 3. `Settings.tsx` — 设置面板

- 组件签名：`export default function XxxSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void })`
- 用 `shared/settingWidgets` 组装（RadioRowField/NumberField/ColorField/TextField/SwitchField/SelectField/
  PicListField/SinglePicField/TitleSettingsField/FrameSettingsField）。
- **字段集合必须覆盖 Vue Settings.vue 的全部设置项**（含分组标题/文案）；
  复杂交互（选商品/选分类/选链接）先用占位：
  - 选商品：`ProductPicker`（`../../../components/ProductPicker`，admin-semi 已有）
  - 选图：`PicListField`/`SinglePicField`（上传接口 `/adminapi/file/uploadImage`）
  - 选链接：`Input` 填 path（后续统一接链接选择器）
- 顶部 `<div className="h5-editor-settings-body">` 包裹。

## 规则

1. **契约红线**：`index.tsx` 默认值、`type`/`url` 字段必须与 Vue 版逐字段一致；不允许改名/改默认值。
2. 预览 DOM 类名与 Vue/uniapp 端一致——这是三端视觉对齐的锚点。
3. 不引入新 npm 依赖（NutUI/Semi/dnd-kit/lodash-es 已可用；`cloneDeep` 用 `contract/sharedDefaults` 的导出）。
4. 不使用 `any` 以外的类型体操；`import type` 按范本风格。
5. 完成后不要自行改动 `modules/index.ts` 与 `contract/**`（由主线统一接线）。

## 参考源码路径

- Vue 版：`D:\tigshop\java-b2b2b-pro-v5.8.57\java-b2b2c-overseas-v5.8.61\view\admin\src\views\decorate\decorate\editor\modules\<桶>\<模块>\{index.ts,types.ts,Preview.vue,Settings.vue}`
- uniapp 端（行为参照）：`...\view\uniapp\src\pages\customPage\modules\<模块>\index.vue`
- 旧版（字段参照，Settings 字段找不到时看这里）：
  `...\view\admin\src\views\decorate\decorate\src\modules\<桶>\<模块>\{View.vue,Edit.vue}`
