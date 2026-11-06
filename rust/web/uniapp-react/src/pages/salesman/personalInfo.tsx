import { useState } from "react";
import { Input, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getSalesmanPersonal, updateSalesmanPersonal } from "@/api/salesman/salesmanPersonal";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./personalInfo.scss";

/**
 * 分销员个人信息页（自旧 pages/salesman/personalInfo.vue 逐行移植）
 * - 编辑分销员名片信息
 * - 设置头像、昵称、联系方式
 * - 旧 up-form / up-form-item / up-input → 基础组件自绘（行式表单）
 */
export default function SalesmanPersonalInfo() {
    usePageGuards();

    // 旧 reactive personalData
    const [personalData, setPersonalData] = useState<any>({
        nickname: "",
        cardname: "",
        wechatname: "",
        mobile: ""
    });

    const patchData = (patch: Record<string, any>) => {
        setPersonalData((prev: any) => ({ ...prev, ...patch }));
    };

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

    const goPages = (url: string) => {
        Taro.navigateTo({
            url
        });
    };
    void goPages;

    const save = async () => {
        try {
            await updateSalesmanPersonal({ ...personalData });
            Taro.showToast({ title: t("保存成功"), icon: "none" });
            setTimeout(() => {
                Taro.navigateBack({
                    success: function () {
                        // 旧 uni.$emit("refreshData")
                        Taro.eventCenter.trigger("refreshData");
                    }
                });
            }, 1000);
        } catch (error: any) {
            console.error("表单错误信息：", error);
            Taro.showToast({ title: error.message, icon: "none" });
        }
    };

    const onSubmit = () => {
        // 旧 rules.mobile：required + message 请输入手机号，校验失败 catch → toast 保存失败
        if (!personalData.mobile) {
            Taro.showToast({ title: t("保存失败"), icon: "none" });
            return;
        }
        void save();
    };

    // 旧 onShow
    useDidShow(() => {
        void _getSalesmanPersonal();
    });

    return (
        <TigLayout title={t("个人信息")} safeTopBgColor="#f5f5f5">
            <View className="personal-title">{t("个人信息")}</View>
            <View className="personal-info">
                <View className="form-item form-item--border">
                    <View className="form-item__label">{t("头像")}</View>
                    <View className="form-item__content">
                        <View className="salesman-avatar">
                            <TigImage className="salesman-avatar__img salesman-avatar--round salesman-avatar__img--big" src={personalData.avatar} />
                        </View>
                    </View>
                </View>
                <View className="form-item form-item--border">
                    <View className="form-item__label">{t("昵称")}</View>
                    <View className="form-item__content">
                        <Input
                            className="form-item__input"
                            value={personalData.nickname}
                            placeholder={t("请输入昵称")}
                            placeholderClass="form-item__placeholder"
                            onInput={(e: any) => patchData({ nickname: e.detail.value })}
                        />
                    </View>
                </View>
            </View>
            <View className="personal-title">{t("联系方式")}</View>
            <View className="personal-info">
                <View className="form-item form-item--border">
                    <View className="form-item__label">{t("手机号")}</View>
                    <View className="form-item__content">
                        <Input
                            className="form-item__input"
                            type="number"
                            value={personalData.mobile}
                            placeholder={t("请输入手机号")}
                            placeholderClass="form-item__placeholder"
                            onInput={(e: any) => patchData({ mobile: e.detail.value })}
                        />
                    </View>
                </View>
            </View>
            {/* 旧模板中「销售权益」区块已注释 */}
            <FixedPlaceholder backgroundColor="#fff">
                <View className="btn-box">
                    <TigButton2
                        className="salesman-btn"
                        style={{
                            background: "linear-gradient(45deg, rgb(255, 170, 30), rgb(255, 114, 13))",
                            borderColor: "#fff",
                            color: "#fff"
                        }}
                        onClick={onSubmit}
                    >
                        {t("保存")}
                    </TigButton2>
                </View>
            </FixedPlaceholder>
        </TigLayout>
    );
}