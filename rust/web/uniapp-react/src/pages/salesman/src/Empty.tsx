import type { CSSProperties } from "react";
import { Image, View } from "@tarojs/components";

import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./Empty.scss";

interface Props {
    emptyImgUrl?: string;
    emptyTxt?: string;
    styles?: CSSProperties;
}

/**
 * 空状态组件（自旧 pages/salesman/src/empty.vue 移植）
 * - 展示列表为空时的占位图
 * - 可自定义图片和文案
 * - 旧 van-empty 结构原样保留
 */
export default function Empty({
    emptyImgUrl = staticResource("salesman/no_order.png"),
    emptyTxt = "暂无数据",
    styles = {}
}: Props) {
    return (
        <View>
            <View className="van-empty">
                {emptyImgUrl ? (
                    <View className="van-empty__image" style={styles}>
                        <Image src={emptyImgUrl} mode="aspectFit" style={{ height: "100%", width: "100%" }} />
                    </View>
                ) : null}
                <View className="van-empty__description">{t(emptyTxt)}</View>
            </View>
        </View>
    );
}