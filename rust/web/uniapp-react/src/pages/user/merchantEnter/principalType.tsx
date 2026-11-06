import { useDidShow, useRouter } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getMyMerchant } from "@/api/user/merchantEnter";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./principalType.scss";

/**
 * 选择主体类型（自旧 pages/user/merchantEnter/principalType.vue 逐行移植）
 * - 个人开关 personApplyEnabled=1 时才展示个人类型
 * - onShow 查询已有申请：未重新申请则直接 redirect 到入驻表单；重新申请则记录 id
 * - 必须勾选协议后才能进入下一步
 */
export default function MerchantPrincipalType() {
    usePageGuards();

    const router = useRouter();
    const personApplyEnabled = useConfigStore((s) => s.personApplyEnabled);

    const [type, setType] = useState(() => (useConfigStore.getState().personApplyEnabled === 1 ? 1 : 2));
    const [isReapply, setIsReapply] = useState(false);
    const isReapplyRef = useRef(false);
    const idRef = useRef(0);
    const [isChecked, setIsChecked] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const getMyMerchantData = async () => {
        try {
            const result: any = await getMyMerchant();
            if (result && Object.keys(result).length > 0) {
                if (!isReapplyRef.current) {
                    Taro.redirectTo({
                        url: `/pages/user/merchantEnter/index?id=${result.merchantApplyId}&type=${result.type}`
                    });
                } else {
                    idRef.current = result.merchantApplyId;
                }
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoaded(true);
        }
    };

    const handleAffirm = () => {
        if (!isChecked) {
            Taro.showToast({
                title: t("请先阅读并同意协议"),
                icon: "none"
            });
            return;
        }

        if (idRef.current > 0 && isReapply) {
            Taro.navigateTo({
                url: `/pages/user/merchantEnter/index?id=${idRef.current}&type=${type}&isReapply=${isReapply}`
            });
            return;
        }
        Taro.navigateTo({
            url: `/pages/user/merchantEnter/index?type=${type}`
        });
    };

    const handleLink = () => {
        Taro.navigateTo({
            url: "/pages/user/merchantEnter/agreement"
        });
    };

    // 旧 onLoad：带 type 参数视为重新申请
    useEffect(() => {
        if (router.params && router.params.type) {
            isReapplyRef.current = true;
            setIsReapply(true);
        }
        // 对应旧 onLoad，仅执行一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow：每次展示都查询已有申请
    useDidShow(() => {
        void getMyMerchantData();
    });

    return (
        <View className="container">
            {loaded && (
                <TigLayout title={t("选择主体类型")}>
                    <View className="type-title">{t("选择主体类型和经营类目")}</View>
                    {personApplyEnabled === 1 && (
                        <View className={`type-box${type === 1 ? " active" : ""}`} onClick={() => setType(1)}>
                            <Text className="iconfont-h5 icon-geren icon-size" /> {t("个人")}
                        </View>
                    )}

                    <View className={`type-box${type === 2 ? " active" : ""}`} onClick={() => setType(2)}>
                        <Text className="iconfont-h5 icon-qiye icon-size" /> {t("企业")}
                    </View>

                    <View className={`type-box${type === 3 ? " active" : ""}`} onClick={() => setType(3)}>
                        <Text className="iconfont-h5 icon-qiye icon-size" /> {t("个体工商户")}
                    </View>

                    <FixedPlaceholder border={false} backgroundColor="#fff">
                        <View className="btn-box">
                            <TigButton2 theme className="btn" onClick={handleAffirm}>
                                {" "}
                                {t("确认")}{" "}
                            </TigButton2>
                            <View className="agreement">
                                {/* 旧 tig-checkbox v-model:checked → 自绘圆形勾选 */}
                                <View
                                    className={`agreement-check${isChecked ? " checked" : ""}`}
                                    onClick={() => setIsChecked((prev) => !prev)}
                                >
                                    <Text className="agreement-check-icon">{isChecked ? "✓" : ""}</Text>
                                </View>
                                <Text className="agreement-text" onClick={() => setIsChecked((prev) => !prev)}>
                                    {t("我已阅读并同意")}
                                </Text>
                                <Text className="agreement-link" onClick={handleLink}>
                                    《{t("商户入驻协议")}》
                                </Text>
                            </View>
                        </View>
                    </FixedPlaceholder>
                </TigLayout>
            )}
        </View>
    );
}