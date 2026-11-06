import { Popup } from "@nutui/nutui-react-taro";
import { View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./AddressPop.scss";

interface Props {
    /** 旧 v-model（defineModel）→ show + onShowChange */
    show?: boolean;
    onShowChange?: (val: boolean) => void;
    /** 旧 @link：去修改地址 */
    onLink?: () => void;
}

/**
 * 地址选择弹窗组件（自旧 pages/order/src/addressPop.vue 移植）
 * - 同城配送地址缺经纬度时提示去补全地址
 * - 取消关闭弹层，去修改由父级跳转地址编辑页
 * - 旧 tig-popup（center、60vh、透明底、round 0、无关闭按钮）→ NutUI Popup center 透明底
 */
export default function AddressPop({ show = false, onShowChange, onLink }: Props) {
    return (
        <Popup
            visible={show}
            position="center"
            onClose={() => onShowChange?.(false)}
            style={{ backgroundColor: "transparent" } as any}
        >
            <View className="address-pop">
                <View className="pop-center">{t("您的地址未关联具体定位信息，请重新修改地址信息")}</View>
                <View className="pop-btns">
                    {/* 旧 tig-button plain → 描边按钮；tig-button → 主题色实底按钮（TODO(MIGRATION)：随公共 tig-button 统一替换） */}
                    <View className="btn btn--plain" onClick={() => onShowChange?.(false)}>
                        {t("取消")}
                    </View>
                    <View className="btn" onClick={() => onLink?.()}>
                        {" "}
                        {t("去修改")}{" "}
                    </View>
                </View>
            </View>
        </Popup>
    );
}
