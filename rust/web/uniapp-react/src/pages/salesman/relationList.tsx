import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useReachBottom, useRouter } from "@tarojs/taro";
import { SearchBar } from "@nutui/nutui-react-taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getCustomerList } from "@/api/salesman/salesmanCenter";
import type { CustomerItem, CustomerListParams } from "@/types/salesman/customer";
import { useSaveTopBoxHeight } from "@/hooks";
import { useConfigStore } from "@/store/config";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";

import Empty from "./src/Empty";
import SelectDate from "./src/selectDate";
import { ensureViewCustomerInfo } from "./src/salesmanPrivacy";

import "./relationList.scss";

const dateText = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

/**
 * 有效客户列表页（自旧 pages/salesman/relationList.vue 逐行移植）
 * - 客户列表：搜索 / 全部客户|下单客户 tab / 时间筛选 / 自定义时间
 * - 旧 up-search → NutUI SearchBar；旧 up-tabs → 基础组件自绘
 */
export default function SalesmanRelationList() {
    usePageGuards();

    const router = useRouter();
    const { height: topHeight } = useSaveTopBoxHeight();
    const configStore = useConfigStore();
    const defaultAvatar = useConfigStore((s) => s.defaultAvatar);

    const [filterHeight, setFilterHeight] = useState(300);
    const [filterTopHeight, setFilterTopHeight] = useState(topHeight);
    const [keyword, setKeyword] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [timeType, setTimeType] = useState("all");
    // 同步镜像：旧 ref 在 set 后立即读到新值，React state 需显式保存
    const timeTypeRef = useRef("all");
    const [showSelectDate, setShowSelectDate] = useState(false);
    const [customDates, setCustomDates] = useState<string[]>([]);
    const [list, setList] = useState<CustomerItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    // 旧 reactive params：原地维护分页与筛选字段
    const paramsRef = useRef<CustomerListParams>({ page: 1, size: 15, customerType: "all", keyword: "" });
    const params = paramsRef.current;

    // 镜像 state，供触底闭包读取，避免 React 陈旧闭包
    const listRef = useRef<CustomerItem[]>([]);
    const totalRef = useRef(0);
    const loadingRef = useRef(false);

    const customDateText = customDates.map((date) => date.replace(/-/g, ".")).join("-\n");

    const tabs = [
        { label: t("全部客户"), value: "all" as CustomerListParams["customerType"] },
        { label: t("下单客户"), value: "ordered" as CustomerListParams["customerType"] }
    ];
    const timeTabs = [
        { label: "全部", value: "all" },
        { label: "今日", value: "today" },
        { label: "昨日", value: "yesterday" },
        { label: "近七日", value: "seven" }
    ];

    const applyTime = (type = timeTypeRef.current) => {
        const now = new Date();
        params.startTime = undefined;
        params.endTime = undefined;
        if (type === "today") params.startTime = params.endTime = dateText(now);
        if (type === "yesterday") {
            const day = new Date(now.getTime() - 86400000);
            params.startTime = params.endTime = dateText(day);
        }
        if (type === "seven") {
            params.startTime = dateText(new Date(now.getTime() - 6 * 86400000));
            params.endTime = dateText(now);
        }
    };

    const load = async (reset = false) => {
        if (loadingRef.current || (!reset && listRef.current.length && listRef.current.length >= totalRef.current)) return;
        if (reset) {
            params.page = 1;
            listRef.current = [];
            setList([]);
        }
        loadingRef.current = true;
        setLoading(true);
        try {
            const result = await getCustomerList({ ...params });
            listRef.current = [...listRef.current, ...(result.records || [])];
            setList(listRef.current);
            totalRef.current = result.total || 0;
            setTotal(result.total || 0);
        } catch {
            Taro.showToast({ title: t("加载失败"), icon: "none" });
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    };

    const reload = () => {
        void load(true);
    };

    const changeTab = (item: { value: CustomerListParams["customerType"] }) => {
        setActiveIndex(tabs.findIndex((tab) => tab.value === item.value));
        params.customerType = item.value;
        reload();
    };

    const changeTime = (value: string) => {
        timeTypeRef.current = value;
        setTimeType(value);
        setCustomDates([]);
        applyTime(value);
        reload();
    };

    const confirmCustomDate = (dates: string[]) => {
        setCustomDates(dates);
        setTimeType("custom");
        params.startTime = dates[0];
        params.endTime = dates[1];
        reload();
    };

    const money = (value?: number) => Number(value || 0).toFixed(2);
    const formatMinute = (value?: string | null) => (value ? value.replace(/:\d{2}(?=\s*$)/, "") : "");
    const openDetail = (userId: number) => Taro.navigateTo({ url: `/pages/salesman/customerDetail?userId=${userId}` });
    const hasMore = () => listRef.current.length < totalRef.current;

    // 旧 onMounted：测量筛选头高度 + 计算顶部占位
    useEffect(() => {
        const menu = configStore.menuButtonInfo;
        // 胶囊坐标的 top 已包含状态栏，搜索框与胶囊同一行，只需占位到胶囊顶部
        setFilterTopHeight(menu.top ? Math.max(0, menu.top - (24 * (configStore.windowInfo.screenWidth || 375)) / 750) : topHeight);

        Taro.nextTick(() => {
            Taro.createSelectorQuery()
                .select(".filter-header")
                .boundingClientRect((rect: any) => {
                    if (rect?.height) setFilterHeight(rect.height);
                })
                .exec();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onLoad
    useEffect(() => {
        const init = async () => {
            const allowed = await ensureViewCustomerInfo();
            if (!allowed) return;
            if (router.params?.customerType === "today") {
                timeTypeRef.current = "today";
                setTimeType("today");
            }
            applyTime();
            void load(true);
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onReachBottom
    useReachBottom(() => {
        if (!loadingRef.current && hasMore()) {
            params.page += 1;
            void load();
        }
    });

    // 旧 searchWrapStyle：微信小程序原生胶囊位于右侧，搜索框预留间距后占据胶囊左侧区域
    const searchWrapStyle: any = (() => {
        if (process.env.TARO_ENV !== "weapp") return {};
        const screenWidth = configStore.windowInfo.screenWidth;
        const left = configStore.menuButtonInfo.left;
        if (screenWidth && left) return { paddingRight: `${screenWidth - left + 8}px` };
        return {};
    })();

    // 旧模板 v-if="list.length" 包裹的统计行
    // 旧 .empty-page 仅在微信小程序条件编译下生效
    const emptyPage = !loading && !list.length && process.env.TARO_ENV === "weapp";

    return (
        <TigLayout needSafeBottom={false}>
            <View
                className={`customer-page${emptyPage ? " empty-page" : ""}`}
                style={{ paddingTop: `${filterHeight}px` }}
            >
                <View className="filter-header" style={{ paddingTop: `${filterTopHeight}px` }}>
                    <View className="search-wrap" style={searchWrapStyle}>
                        <View className="search-back" onClick={navigateBack}>
                            <View className="iconfont-h5 icon-houtui" />
                        </View>
                        <View className="relation-search">
                            <SearchBar
                                value={keyword}
                                placeholder={t("请输入手机号或有效客户昵称搜索")}
                                shape="round"
                                onChange={(value) => {
                                    setKeyword(value);
                                    params.keyword = value;
                                }}
                                onSearch={reload}
                                onClear={reload}
                            />
                        </View>
                    </View>
                    <View className="tabs">
                        {tabs.map((item) => (
                            <View
                                className={`tabs__item${activeIndex === tabs.findIndex((tab) => tab.value === item.value) ? " active" : ""}`}
                                key={item.value}
                                onClick={() => changeTab(item)}
                            >
                                {item.label}
                            </View>
                        ))}
                    </View>
                    <View className="time-tabs">
                        {timeTabs.map((item) => (
                            <View className={`time-tab${timeType === item.value ? " active" : ""}`} key={item.value} onClick={() => changeTime(item.value)}>
                                {t(item.label)}
                            </View>
                        ))}
                        <View className="time-tab custom" onClick={() => setShowSelectDate(true)}>
                            <Text className={customDates.length ? "selected" : ""}>{customDateText || t("自定义时间")}</Text>
                            <Text
                                className={`iconfont-h5 icon-xiajiantou1-copy relation-arrow${customDates.length ? " selected" : ""}`}
                                style={{ color: customDates.length ? "var(--general)" : "#969799" }}
                            />
                        </View>
                    </View>
                    <SelectDate modelValue={showSelectDate} onChange={setShowSelectDate} onConfirm={confirmCustomDate} />
                </View>
                {list.length ? (
                    <View className="total">
                        {t("共")}
                        <Text className="total-count">{total}</Text>
                        {t("个有效客户")}
                    </View>
                ) : null}
                {!loading && !list.length ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
                {list.map((item) => (
                    <View className="customer-card" key={item.userId} onClick={() => openDetail(item.userId)}>
                        <View className="avatar">
                            <TigImage src={imageFormat(item.avatar || defaultAvatar)} />
                        </View>
                        <View className="customer-info">
                            <View className="name">{item.nickname || item.username || "-"}</View>
                            <View className="line">
                                {t("成交额")}：<Text>{money(item.orderAmount)}</Text> {t("订单数")}：<Text>{item.orderCount || 0}</Text>
                            </View>
                            <View className="line">
                                {t("最近下单时间")}：{formatMinute(item.lastOrderTime) || t("无")}
                            </View>
                            <View className="line">
                                {t("渠道来源")}：{item.channel || "-"}
                            </View>
                        </View>
                    </View>
                ))}
                {loading ? (
                    <View className="loading">{t("加载中")}</View>
                ) : list.length && !hasMore() ? (
                    <View className="loading">{t("没有更多了")}</View>
                ) : null}
            </View>
        </TigLayout>
    );
}