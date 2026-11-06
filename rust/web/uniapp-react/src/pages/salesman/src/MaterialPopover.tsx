import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "@tarojs/components";

import "./MaterialPopover.scss";

interface Props {
    /** 旧默认插槽：触发按钮 */
    children?: ReactNode;
    /** 旧 #content 具名插槽：弹出内容 */
    content?: ReactNode;
}

/**
 * 素材操作弹出菜单组件（自旧 pages/salesman/src/materialPopover.vue 移植）
 * - 提供素材的更多操作选项
 * - 旧 show 状态 + 遮罩/内容进出场动画原样保留
 */
export default function MaterialPopover({ children, content }: Props) {
    const [show, setShow] = useState(false);

    const handleClick = () => {
        setShow((value) => !value);
    };

    return (
        <View className="material-popover">
            <View className={`popover-masking${show ? " show" : ""}`} onClick={handleClick} />
            {show ? (
                <View className={`popover-content-box${show ? " show" : ""}`}>
                    <View className={`popover-content${show ? " enter" : " leave"}`} onClick={handleClick}>
                        <View className="triangle" />
                        {content}
                    </View>
                </View>
            ) : null}

            <View onClick={() => setShow((value) => !value)}>{children}</View>
        </View>
    );
}