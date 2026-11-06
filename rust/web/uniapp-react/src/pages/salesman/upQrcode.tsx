import { useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { getSalesmanPersonal, updateSalesmanPersonal } from "@/api/salesman/salesmanPersonal";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./upQrcode.scss";

/**
 * 上传二维码页（自旧 pages/salesman/upQrcode.vue 逐行移植）
 * - 上传和管理分销员专属二维码
 * - 支持微信、企微等多种二维码
 */
export default function SalesmanUpQrcode() {
    usePageGuards();

    const [personalData, setPersonalData] = useState<any>({
        qrcode: ""
    });
    const [loading, setLoading] = useState(false);

    const _getSalesmanPersonal = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getSalesmanPersonal();
            setPersonalData((prev: any) => ({ ...prev, ...result }));
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const saveQrcode = async () => {
        try {
            await updateSalesmanPersonal({ ...personalData });
            setTimeout(() => {
                setLoading(false);
            }, 1000);
        } catch (error: any) {
            console.error("表单错误信息：", error);
            Taro.showToast({ title: error.message, icon: "none" });
        }
    };

    const onUpload = () => {
        setLoading(true);
        void saveQrcode();
    };

    // 旧 onLoad
    useLoad(() => {
        void _getSalesmanPersonal();
    });

    return (
        <TigLayout title={t("上传二维码")}>
            <View className="qrcode-wrap">
                <View className="desc">{t("请尽快上传微信二维码，方便客户加你微信联系哦")}</View>
                <View className="tips">（温馨提示：建议上传正方形、默认黑白样式二维码，方便客户查看）</View>
                {personalData.avatar ? (
                    <View className="preview">
                        <View
                            className={`preview__overlay${loading ? " preview__overlay_loading" : ""}`}
                            style={{ display: loading ? "flex" : "none" }}
                        >
                            二维码加载中...
                        </View>
                        <View className="preview__overlay">
                            <TigImage src={personalData.avatar} className="van-image__img" />
                        </View>
                        <View className="van-image" style={{ width: "560rpx", height: "688rpx" }}>
                            {/* 旧 <img :src="defaultQrcode" class="van-image__img"> 已注释 */}
                        </View>
                    </View>
                ) : (
                    <View className="preview">
                        <View className="preview__overlay" style={{ display: loading ? "flex" : "none" }}>
                            二维码加载中...
                        </View>
                        <View className="van-image" style={{ width: "560rpx", height: "688rpx" }}>
                            {/* 旧 <img :src="defaultQrcode" class="van-image__img"> 已注释 */}
                        </View>
                    </View>
                )}
                <FixedPlaceholder backgroundColor="#fff">
                    <TigUpload requestUrl="user/user/uploadImg" onChange={onUpload}>
                        <View className="btn-box">
                            <TigButton2
                                className="salesman-btn"
                                style={{
                                    background: "linear-gradient(45deg, rgb(255, 170, 30), rgb(255, 114, 13))",
                                    borderColor: "#fff",
                                    color: "#fff"
                                }}
                            >
                                {t("上传二维码")}
                            </TigButton2>
                        </View>
                    </TigUpload>
                </FixedPlaceholder>
            </View>
        </TigLayout>
    );
}