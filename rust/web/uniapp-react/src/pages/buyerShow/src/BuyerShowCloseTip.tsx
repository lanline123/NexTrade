import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./BuyerShowCloseTip.scss";

export interface BuyerShowCloseTipRef {
    open: () => void;
    close: () => void;
}

interface Props {
    /** 旧 v-model:buyer-show-enabled */
    buyerShowEnabled?: number;
    onBuyerShowEnabledChange?: (value: number) => void;
}

/**
 * 买家秀关闭提示组件（自旧 src/buyerShowCloseTip.vue 移植）
 * - 买家秀功能关闭时的提示
 * - 旧 tig-popup（center / 透明背景 / 无关闭按钮 / 点击遮罩不关闭）→ NutUI Popup
 */
const BuyerShowCloseTip = forwardRef<BuyerShowCloseTipRef, Props>(function BuyerShowCloseTip(
    { buyerShowEnabled = 1, onBuyerShowEnabledChange: _onBuyerShowEnabledChange },
    ref
) {
    const [show, setShow] = useState(false);

    const open = () => {
        setShow(true);
    };

    const close = () => {
        setShow(false);
    };

    useImperativeHandle(ref, () => ({ open, close }));

    const handleLink = (type: string) => {
        if (type === "home") {
            redirect({ url: "/pages/index/index" });
        } else if (process.env.TARO_ENV === "h5") {
            history.back();
        } else {
            Taro.navigateBack();
        }
    };

    // 旧 onLoad：功能未开启时延迟 100ms 弹层
    useEffect(() => {
        if (buyerShowEnabled !== 1) {
            const timer = setTimeout(() => {
                open();
            }, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buyerShowEnabled]);

    return (
        <Popup
            visible={show}
            position="center"
            closeable={false}
            onClose={() => {
                // 旧 mask-click=false：点击遮罩不关闭
            }}
            style={{ backgroundColor: "transparent" }}
        >
            <View className="popupBox">
                <View className="title">{t("提醒")}</View>
                <View className="tip">{t("买家秀功能已暂停使用，您仍可通过商品评价功能查看真实反馈")}</View>
                <View className="btn" onClick={() => handleLink("home")}>
                    {t("返回首页")}
                </View>
            </View>
        </Popup>
    );
});

export default BuyerShowCloseTip;