import { useEffect, useState } from "react";
import { View } from "@tarojs/components";

import { useI18nStore } from "@/store/i18n";
import type { Rank } from "@/types/user/level";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./levelDesc.scss";

interface Props {
    list?: Rank[];
    rankConfig?: any;
}

/**
 * 等级/保级说明（自旧 pages/user/levelCenter/src/levelDesc.vue 逐行移植）
 * - 两张卡片：等级说明、保级说明
 * - 每行展示等级标识、会员名称、升级/保级条件
 */
export default function LevelDesc({ list = [], rankConfig = {} }: Props) {
    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    // 旧 relegationRule：仅预计算，模板中该分支已被注释（按原样保留计算逻辑）
    const [relegationRule, setRelegationRule] = useState<any[]>([]);

    const handleRelegationRuleData = (level: Rank[], config: any) => {
        const rule: any[] = [];
        level?.forEach((item) => {
            if (config?.data?.type === 1) {
                rule.push({ ...item, condition: t("不降级") });
            } else if (config?.data?.type === 2) {
                rule.push({
                    ...item,
                    condition: config.data?.rankAfterMonth + t("个月后，按近") + config.data?.useMonth + t("个月成长值重新计算")
                });
            }
        });
        setRelegationRule(rule);
    };

    // 旧 watchEffect
    useEffect(() => {
        handleRelegationRuleData(list, rankConfig);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list, rankConfig, langCode]);
    void relegationRule;

    const handelGrowth = (item: Rank) => {
        const growth = item?.minGrowthPoints;
        if (growth === 0) {
            return t("无门槛");
        }
        // rankType === 2 为消费模式，其余为成长值模式
        if (item?.rankType === 2) {
            return t("消费满") + growth;
        }
        return growth + t("成长值");
    };

    return (
        <View className="level_desc_container">
            {/* 等级说明 */}
            <View className="level_card">
                <View className="card_title">{t("等级说明")}</View>
                <View className="card_info_wapper">
                    <View className="list list_head">
                        <View className="level_icon_label">{t("标识")}</View>
                        <View className="level_name_label">{t("会员名称")}</View>
                        <View className="level_condition_label">{t("升级条件")}</View>
                    </View>
                    <View className="list">
                        {list.map((item) => (
                            <View className="list_item" key={item?.rankId}>
                                <View className="level_icon">
                                    <View
                                        className={`icon card${item?.rankLevel}`}
                                        style={{ backgroundImage: `url(${staticResource(`user/level_${item?.rankLevel}.png`)})` }}
                                    />
                                </View>
                                <View className="level_name">{t(item?.rankName)}</View>
                                <View className="level_condition">{handelGrowth(item)}</View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            <View className="level_card">
                <View className="card_title">{t("保级说明")}</View>
                <View className="card_info_wapper">
                    <View className="list list_head">
                        <View className="level_icon_label">{t("标识")}</View>
                        <View className="level_name_label">{t("会员名称")}</View>
                        <View className="level_condition_label">{t("保级条件")}</View>
                    </View>
                    <View className="list">
                        {list.map((item) => (
                            <View className="list_item" key={item?.rankId}>
                                <View className="level_icon">
                                    <View
                                        className={`icon card${item?.rankLevel}`}
                                        style={{ backgroundImage: `url(${staticResource(`user/level_${item?.rankLevel}.png`)})` }}
                                    />
                                </View>
                                <View className="level_name">{t(item?.rankName)}</View>
                                <View className="level_condition line1">{handelGrowth(item)}</View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}