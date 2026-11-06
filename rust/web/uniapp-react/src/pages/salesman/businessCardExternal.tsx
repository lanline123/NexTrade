import { useState } from "react";
import { Image, View } from "@tarojs/components";
import Taro, { useReady, useShareAppMessage, useShareTimeline } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import BusinessCardPoster from "./src/businessCardPoster";
import { createQrcodePath } from "./src/qrcode";

import "./businessCardExternal.scss";

/**
 * 外部名片页（自旧 pages/salesman/businessCardExternal.vue 逐行移植）
 * - 展示分销员名片（外部访问）
 * - 供非分销员用户查看
 * - 支持分享和保存海报
 * - 旧 tig-qrcode（本地 canvas）→ 后端 common/util/qrCode（src/qrcode.ts）
 * - 旧 components/product/guide.vue 分享引导内联在本页
 */
export default function SalesmanBusinessCardExternal() {
    usePageGuards();

    const h5Domain = useConfigStore((s) => s.baseInfo.h5Domain);
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);

    const [userInfo] = useState<any>(Taro.getStorageSync("userInfo") || {});
    const [qrcodeImg, setQrcodeImg] = useState<string>("");
    const [showGuide, setShowGuide] = useState(false);
    const [showPoster, setShowPoster] = useState(false);

    const link = (() => {
        let domain = h5Domain;

        // 旧 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            domain = domain ? domain : `${window.location.origin}/mobile`;
        }

        return `${domain}/pages/salesman/salesmanCard?&salesmanId=${userInfo?.salesman?.salesmanId}`;
    })();

    const menuList = [
        { name: "编辑名片", icon: staticResource("salesman/businessCardEdit.png") },
        { name: "发送给朋友", icon: staticResource("salesman/businessCardWechat.png") },
        { name: "保存到相册", icon: staticResource("salesman/businessCardPic.png") }
    ];

    // 旧 onReady(() => qrcodeRef.value?.drawQrcode())
    useReady(() => {
        void (async () => {
            const path = await createQrcodePath(link);
            setQrcodeImg(path);
        })();
    });

    const handleMenuClick = (index: number) => {
        switch (index) {
            case 0:
                Taro.navigateTo({
                    url: "/pages/salesman/personalInfo"
                });
                break;
            case 1:
                setShowGuide(true);
                break;
            case 2:
                setShowPoster(true);
                break;
        }
    };

    useShareAppMessage(() => {
        return {
            title: `${userInfo.nickname}${t("的名片")}`
        };
    });

    useShareTimeline(() => {
        return {
            title: `${userInfo.nickname}${t("的名片")}`
        };
    });

    // 旧 guide.vue 的 v-bind（仅微信小程序生效）
    const isMpWeixin = process.env.TARO_ENV === "weapp";
    const guideContentStyle = isMpWeixin ? { top: `${menuButtonInfo.bottom + 5}px` } : {};
    const guideImgBoxStyle = isMpWeixin ? { paddingRight: `${menuButtonInfo.width - 15}px` } : {};

    // 旧 v-if="showPoster"：离开时卸载，重新打开会重新绘制

    return (
        <View>
            <TigLayout title={t("名片")} safeTopBgColor="#f5f5f5">
                <View className="businessCard-box">
                    <View className="card-box">
                        <View className="card-img">
                            <TigImage src={userInfo.avatar} />
                        </View>
                        <View className="card-box-content">
                            <View className="card-box-content-text">
                                <View className="card-box-content-text-mobile">{userInfo.mobile}</View>
                                <View className="card-box-content-text-name">{userInfo.nickname}</View>
                            </View>
                            <View className="card-box-content-qrcode">
                                <Image style={{ height: "100%", width: "100%" }} src={qrcodeImg} />
                            </View>
                        </View>
                    </View>
                    <View className="card-menu">
                        {menuList.map((item, index) => (
                            <View className="card-menu-item" key={index} onClick={() => handleMenuClick(index)}>
                                <Image className="card-menu-item-icon" src={item.icon} />
                                <View className="card-menu-item-text">{t(item.name)}</View>
                            </View>
                        ))}
                    </View>
                </View>
            </TigLayout>
            {showGuide ? (
                <View className="guide-box" style={{ zIndex: 201 }} onClick={() => setShowGuide(false)}>
                    <View className="guide-content" style={guideContentStyle}>
                        <View className="guide-img-box" style={guideImgBoxStyle}>
                            <Image className="guide-img" src={staticResource("common/share_arrow.png")} />
                        </View>
                        <View className="guide-text">{t("立即分享给好友吧")}</View>
                        <View>{t("点击屏幕右上角将本页面分享给好友")}</View>
                    </View>
                </View>
            ) : null}
            {showPoster ? (
                <BusinessCardPoster modelValue={showPoster} qrcodeImg={qrcodeImg} userInfo={userInfo} onChange={setShowPoster} />
            ) : null}
        </View>
    );
}