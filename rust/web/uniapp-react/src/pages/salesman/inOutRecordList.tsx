import { View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import TimeFilter from "./src/timeFilter";

import "./inOutRecordList.scss";

/**
 * 收支记录列表页（自旧 pages/salesman/inOutRecordList.vue 逐行移植）
 * - 展示佣金收入和提现记录
 * - 支持按时间筛选
 */
export default function SalesmanInOutRecordList() {
    usePageGuards();

    return (
        <TigLayout title={t("收支明细")}>
            <View className="in-out-record-page">
                <TimeFilter />
            </View>
        </TigLayout>
    );
}