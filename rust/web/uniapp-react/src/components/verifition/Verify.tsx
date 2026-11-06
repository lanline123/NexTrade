import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";

import { Popup } from "@nutui/nutui-react-taro";

import VerifySlide from "./Verify/VerifySlide";
import { t } from "@/utils/i18n";

import "./Verify.scss";

interface Props {
    captchaType: string;
    figure?: number;
    arith?: number;
    mode?: string;
    vSpace?: number;
    explain?: string;
    imgSize?: { width: string; height: string };
    blockSize?: { width: number; height: number };
    barSize?: { width: string; height: string };
    onOkCallback?: (res: { verifyToken: string }) => void;
}

/**
 * Verify 验证码组件（自旧 components/verifition/Verify.vue 移植）
 * @description 分发验证码使用（旧 tig-popup 包 VerifySlide → NutUI Popup）
 */
const Verify = forwardRef<{ show: () => void; refresh: () => void }, Props>(function Verify(
    { captchaType, figure, arith, mode = "pop", vSpace, explain, imgSize = { width: "310px", height: "155px" }, blockSize, barSize, onOkCallback },
    ref
) {
    const instanceRef = useRef<{ refresh: () => void } | null>(null);
    const [visible, setVisible] = useState(false);

    /**
     * refresh
     * @description 刷新
     * */
    const refresh = () => {
        if (instanceRef.current?.refresh) {
            instanceRef.current.refresh();
        }
    };
    const closeBox = () => {
        setVisible(false);
        refresh();
    };
    const show = () => {
        setVisible(true);
    };
    const success = (res: any) => {
        onOkCallback?.(res);
    };

    useImperativeHandle(ref, () => ({
        show,
        refresh
    }));

    return (
        // 原 tig-popup v-model:show :mask-click="false" :custom-style="{ width, box-sizing, padding }" position="center" → NutUI Popup
        <Popup
            visible={visible}
            position="center"
            closeOnOverlayClick={false}
            closeable={false}
            style={{ width: imgSize.width, boxSizing: "content-box", padding: "10rpx 30rpx", backgroundColor: "#fff" }}
            onClose={() => {
                setVisible(false);
            }}
        >
            <View className="content">
                <Text className="title">{t("请完成安全验证")}</Text>
                {visible && (
                    // 原 VerifySlide type="2"：旧组件未声明该 prop（走 $attrs），无实际作用，不透传
                    <VerifySlide
                        ref={instanceRef}
                        captchaType={captchaType}
                        figure={figure}
                        arith={arith}
                        mode={mode}
                        vSpace={vSpace}
                        explain={explain}
                        imgSize={imgSize}
                        blockSize={blockSize}
                        barSize={barSize}
                        onClose={closeBox}
                        onSuccess={success}
                    />
                )}
            </View>
        </Popup>
    );
});

export default Verify;
