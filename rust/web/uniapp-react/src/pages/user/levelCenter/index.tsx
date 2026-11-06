import { useEffect, useState } from "react";
import { View } from "@tarojs/components";

import Recommend from "@/components/recommend";
import TigCopyright from "@/components/tig/tig-copyright/TigCopyright";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getUserLevelList } from "@/api/user/levelCenter";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import type { Rank } from "@/types/user/level";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import LevelDesc from "./src/levelDesc";
import TaskCard from "./src/taskCard";
import TopCard from "./src/topCard";

import "./index.scss";

/**
 * 会员等级中心（自旧 pages/user/levelCenter/index.vue 逐行移植）
 * - 展示当前会员等级及升级进度
 * - rankType=2 时显示任务升级模式（完成任务获得成长值）
 * - 展示各等级权益说明
 */
export default function LevelCenter() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const userInfo = useUserStore((s) => s.userInfo);

    const [cardList, setCardList] = useState<Rank[]>([]);
    const [allList, setAllList] = useState<Rank[]>([]);
    const [userLevel] = useState({
        rankLevel: "1"
    });
    // 旧模板将 userLevel 透传给 topCard（该组件未声明同名 prop，实际不生效）
    void userLevel;
    const [rankConfig, setRankConfig] = useState<any>({});

    const __getUserLevelList = async () => {
        try {
            const result: any = await getUserLevelList();
            // 过滤出大于等于当前等级会员列表
            const list = result?.item?.filter((item: Rank) => {
                return parseInt(item?.rankLevel) >= parseInt(userInfo.rankLevel);
            });
            setRankConfig(result.rankConfig);
            setCardList(list || []);
            setAllList(result?.item || []);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 setup 顶层直接调用 __getUserLevelList()
    useEffect(() => {
        void __getUserLevelList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("会员中心")}>
            <View className="level_container">
                {/* 旧 topCard 未声明 user-level prop（透传无实际作用），此处仅保留卡片列表 */}
                <TopCard list={cardList} />
                <View className={`bottom_wapper${userInfo.rankType === 2 ? " task_mode" : ""}`}>
                    {/* 任务卡片 */}
                    {userInfo.rankType === 2 && <TaskCard />}
                    {/* 权益说明 */}
                    <LevelDesc rankConfig={rankConfig} list={allList} />
                </View>
            </View>
            <Recommend />
            <TigCopyright />
        </TigLayout>
    );
}