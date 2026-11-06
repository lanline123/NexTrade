import { View } from "@tarojs/components";

import TermPayCard from "../../termPay/termPayCard";
import { useCreditInfo } from "@/hooks/useCreditInfo";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";

import "./index.scss";

/** 固定功能区（自旧 pages/member/components/decorate/fixedFunctionalArea/index.vue 移植） */
export default function FixedFunctionalArea({ data = {} }: { data: ModuleDataWithFrame }) {
    // 账期卡显示条件与 termPayCard 同源，两处共用 useCreditInfo 的判断（含授信信息补偿请求），
    // 否则外壳判不出来时整块不渲染，卡片挂不上、补偿请求也就永远发不出去。
    const { showTermPay: showTermPayCard } = useCreditInfo();

    // 所有子卡片都不显示时整块不渲染，避免留下带内边距的空节点
    const hasContent = Boolean(showTermPayCard);

    const cssVars = useFrameVars(data, {
        backgroundColor: "transparent",
        boxRadius: 0,
        innerPadding: 0,
        boxPadding: 5,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    if (!hasContent) return null;

    return (
        <View className="dec-fixed-area" style={cssVars}>
            <View className="dec-fixed-area__container">
                <TermPayCard />
            </View>
        </View>
    );
}