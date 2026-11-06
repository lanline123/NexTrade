import type { CSSProperties, ReactNode } from "react";
import { Button } from "@tarojs/components";

import "./TigButton2.scss";

interface Props {
    /** 主题色实底按钮（旧 theme） */
    theme?: boolean;
    /** 描边/透明按钮（旧 plain） */
    plain?: boolean;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    style?: CSSProperties | string;
    children?: ReactNode;
    onClick?: (event: any) => void;
}

/**
 * 通用按钮（自旧 components/tig/tig-button2/tig-button2.vue 移植）
 * - 保留旧 class 组合与 theme/plain/disabled 视觉
 * - 旧版水波纹动画（ripple）为纯装饰，这里用 :active 高亮等价替代；
 *   TODO(MIGRATION)：如需逐帧水波纹还原，再补 canvas/DOM 级动画
 */
export default function TigButton2({
    theme = false,
    plain = false,
    disabled = false,
    loading = false,
    className = "",
    style,
    children,
    onClick
}: Props) {
    const classNames = [
        "tig-button2",
        "reset-button",
        "flex",
        "justify-center",
        "align-center",
        disabled || loading ? "disabled" : "",
        theme ? "theme" : "",
        plain ? "plain" : "",
        className
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Button
            className={classNames}
            style={style as any}
            disabled={disabled || loading}
            hoverClass="none"
            onClick={(event) => {
                if (disabled || loading) return;
                onClick?.(event);
            }}
        >
            {children}
        </Button>
    );
}