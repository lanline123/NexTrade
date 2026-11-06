import { View, Text } from "@tarojs/components";

import { useThemeStore } from "@/store/theme";

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
 * 复选框（对应旧 <tig-checkbox>，其内部为 uview up-checkbox）。
 * TODO(MIGRATION)：工程内暂无 tig-checkbox 的 React 版，按 u-checkbox 视觉重写：
 * 圆形描边、选中态填充主题色 --general、白色对勾；类名沿用 u-checkbox__icon-wrap，
 * 便于旧页面的 `.u-checkbox__icon-wrap` 局部覆盖样式（如购物车页描边加粗）继续生效。
 */
export default function Checkbox({ checked, disabled = false, shape = "circle", size = 20, iconSize, activeColor, onChange }: Props) {
    const themeStyle = useThemeStore((s) => s.themeStyle);
    const checkedColor = activeColor || themeStyle["--general"] || "#ee0a24";

    const handleClick = (e: any) => {
        if (disabled) return;
        // 选中状态翻转由父级状态机完成（对应旧 emit("update:checked") + emit("change")）
        onChange?.();
    };

    return (
        <View className={`check ${disabled ? "check--disabled" : ""}`} onClick={handleClick}>
            <View
                className="u-checkbox__icon-wrap"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: shape === "circle" ? "50%" : "4px",
                    backgroundColor: checked ? checkedColor : "transparent",
                    borderColor: checked ? checkedColor : "#c8c9cc"
                }}
            >
                {checked && (
                    <Text className="u-checkbox__icon" style={{ fontSize: `${iconSize ? Math.min(Number(iconSize), Number(size)) - 6 : 12}px` }}>
                        ✓
                    </Text>
                )}
            </View>
        </View>
    );
}
