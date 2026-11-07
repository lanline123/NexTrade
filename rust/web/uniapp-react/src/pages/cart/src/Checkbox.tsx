import TigCheckbox from "@/components/tig/tig-checkbox/TigCheckbox";

import "./Checkbox.scss";

interface Props {
    checked: boolean;
    disabled?: boolean;
    /** 对齐旧 tig-checkbox 的 shape（u-checkbox：circle/square），购物车只用 circle */
    shape?: "circle" | "square";
    /** 整体尺寸，单位 px（对应旧 size="19"） */
    size?: number | string;
    /** 勾选图标尺寸，单位 px（对应旧 icon-size="18"） */
    iconSize?: number | string;
    /** 选中色；留空取主题色 --general（对齐旧 tig-checkbox active-color） */
    activeColor?: string;
    onChange?: () => void;
}

/**
 * 复选框（对应旧 <tig-checkbox>）。
 * 已收敛到公共组件 TigCheckbox（components/tig/tig-checkbox），此处为购物车调用点的
 * props 适配层（size/iconSize 为 px 数值）；类名沿用 check / u-checkbox__icon-wrap，
 * 便于旧页面的 `.u-checkbox__icon-wrap` 局部覆盖样式（如购物车页描边加粗）继续生效。
 */
export default function Checkbox({ checked, disabled = false, shape = "circle", size = 20, iconSize, activeColor, onChange }: Props) {
    return (
        <TigCheckbox
            checked={checked}
            disabled={disabled}
            shape={shape}
            size={String(size)}
            iconSize={iconSize != null ? `${iconSize}px` : ""}
            activeColor={activeColor}
            className="cart-checkbox"
            onChange={onChange}
        />
    );
}
