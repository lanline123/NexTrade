import { useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { View, Text, Textarea } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./Remark.scss";

interface Props {
    /** 买家备注（旧 v-model → value + onValueChange） */
    value?: string;
    onValueChange?: (val: string) => void;
}

/**
 * 买家备注卡片（自旧 pages/order/src/remark.vue 移植）
 * - 结算页平铺展示备注摘要，点击弹层内编辑
 * - 旧 up-textarea（maxlength 250 + count）→ Taro Textarea 等价 props
 */
export default function Remark({ value = "", onValueChange }: Props) {
    const [showPopup, setShowPopup] = useState(false);

    return (
        // 单根包裹：避免多根时 popup 被拍平进结算页流式布局
        <View>
            <View className="remark">
                <View className="remark-title">{t("备注")}</View>
                <View className="remark-content" onClick={() => setShowPopup(true)}>
                    {value ? (
                        <Text className="remark-text">{value}</Text>
                    ) : (
                        <Text className="remark-placeholder">{t("备注建议提前协商（250字以内）")}</Text>
                    )}
                    <View className="iconfont-h5 icon-fanhui" />
                </View>
            </View>

            {/* 旧 tig-popup（默认 bottom、白底）→ NutUI Popup */}
            <Popup visible={showPopup} onClose={() => setShowPopup(false)} style={{ backgroundColor: "#fff" } as any}>
                <View className="popup-content">
                    <View className="popup-content-title">{t("备注")}</View>
                    <View>
                        {/* 旧 up-textarea（maxlength 250 + count）→ Taro Textarea + 等价字数统计
                            （本版 Taro Textarea 无 count prop，统计按 uview「n/250」样式补齐） */}
                        <Textarea
                            className="remark-textarea"
                            value={value}
                            maxlength={250}
                            placeholder={t("备注建议提前协商（250字以内）")}
                            placeholderStyle="background-color:#FAFAFA;padding:0;color:#9A9A9A;font-size:24rpx"
                            onInput={(e) => onValueChange?.(e.detail.value)}
                        />
                        <Text className="textarea-count">
                            {value.length}/250
                        </Text>
                    </View>
                    {/* 旧 tig-fixed-placeholder → 固定底栏（安全区由 --safe-bottom 提供） */}
                    <View className="fixed-placeholder">
                        <View className="footer" style={{ padding: "15rpx 30rpx" }} onClick={() => setShowPopup(false)}>
                            {/* 旧 tig-button（height 70rpx，theme）→ 主题色实底按钮（TODO(MIGRATION)：随公共 tig-button 统一替换） */}
                            <Text className="submit-btn-text">{t("确定")}</Text>
                        </View>
                    </View>
                </View>
            </Popup>
        </View>
    );
}
