import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getBaseConfig } from "@/api/common";
import { useI18nStore } from "@/store/i18n";
import type { GrowUpSetting } from "@/types/common";
import { isOverseas, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./taskCard.scss";

/**
 * 成长任务卡片（自旧 pages/user/levelCenter/src/taskCard.vue 逐行移植）
 * - 拉取后台成长值配置，按开关展示完善信息/绑定手机号/购买商品/完成下单四项任务
 * - 点击「去完成」按任务类型跳转对应页面
 */
export default function TaskCard() {
    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const [taskData, setTaskData] = useState<Partial<GrowUpSetting>>({});

    const __getBaseConfig = async () => {
        try {
            const result: any = await getBaseConfig();
            setTaskData((prev) => ({ ...prev, ...result?.growUpSetting }));
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 setup 顶层直接调用 __getBaseConfig()
    useEffect(() => {
        void __getBaseConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toProfile = () => {
        Taro.navigateTo({ url: "/pages/user/profile/index" });
    };

    return (
        <View className="task_container" style={{ "--taskBg": `url(${staticResource("user/task_bg.png")})` } as any}>
            <View className="task_head">
                <View className="title">{t("成长任务")}</View>
            </View>
            <View className="task_list">
                {taskData?.evpi === 1 && (
                    <View className="task_item">
                        <View className="img" style={`background-image: url(${staticResource("user/evpi.png")});`} />
                        <View className="task_info">
                            <View className="name">{t("完善信息")}</View>
                            <View className="growth_value">
                                {isOverseas() ? t("+{0}成长值", { 0: taskData?.evpiGrowth }) : `+${taskData?.evpiGrowth}成长值`}
                            </View>
                        </View>
                        <View className="do_task_btn" onClick={toProfile}>
                            {t("去完成")}
                        </View>
                    </View>
                )}
                {taskData?.bindPhone === 1 && (
                    <View className="task_item">
                        <View className="img" style={`background-image: url(${staticResource("user/bind_phone.png")});`} />
                        <View className="task_info">
                            <View className="name">{t("绑定手机号")}</View>
                            <View className="growth_value">
                                {isOverseas() ? t("+{0}成长值", { 0: taskData?.bindPhoneGrowth }) : `+${taskData?.bindPhoneGrowth}成长值`}
                            </View>
                        </View>
                        <View className="do_task_btn" onClick={toProfile}>
                            {t("去完成")}
                        </View>
                    </View>
                )}
                {taskData?.buyGoods === 1 && (
                    <View className="task_item">
                        <View className="img" style={`background-image: url(${staticResource("user/buy_goods.png")});`} />
                        <View className="task_info">
                            <View className="name">{t("购买商品")}</View>
                            <View className="growth_value">
                                {isOverseas()
                                    ? t("每消费{0}元，获得{1}点成长值", {
                                          0: taskData?.buyGoodsMoney,
                                          1: taskData?.buyGoodsGrowth
                                      })
                                    : `每消费${taskData?.buyGoodsMoney}元，获得${taskData?.buyGoodsGrowth}点成长值`}
                            </View>
                        </View>
                        <View className="do_task_btn" onClick={() => Taro.switchTab({ url: "/pages/index/index" })}>
                            {t("去完成")}
                        </View>
                    </View>
                )}
                {taskData?.buyOrder === 1 && (
                    <View className="task_item">
                        <View className="img" style={`background-image: url(${staticResource("user/buy_order.png")});`} />
                        <View className="task_info">
                            <View className="name">{t("完成下单")}</View>
                            <View className="growth_value">
                                {isOverseas()
                                    ? t("每完成{0}笔订单，获得{1}点成长值", {
                                          0: taskData?.buyOrderNumber,
                                          1: taskData?.buyOrderGrowth
                                      })
                                    : `每完成${taskData?.buyOrderNumber}笔订单，获得${taskData?.buyOrderGrowth}点成长值`}
                            </View>
                        </View>
                        <View className="do_task_btn" onClick={() => Taro.switchTab({ url: "/pages/cart/index" })}>
                            {t("去完成")}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}