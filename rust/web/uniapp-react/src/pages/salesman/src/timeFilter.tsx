import { useRef, useState } from "react";
import { Text, View } from "@tarojs/components";

import { useSaveTopBoxHeight } from "@/hooks";
import { formatDate } from "@/utils/format";
import { t } from "@/utils/i18n";

import SearchInput from "./SearchInput";
import SelectDate from "./selectDate";

import "./timeFilter.scss";

export interface TimeFilterParams {
    keyword?: string;
    orderTimeStart?: string;
    orderTimeEnd?: string;
    [key: string]: any;
}

interface Props {
    /** 对应旧 v-model:params */
    params?: TimeFilterParams;
    placeholder?: string;
    showBack?: boolean;
    /** 对应旧 update:params */
    onParamsChange?: (params: TimeFilterParams) => void;
    /** 对应旧 @change */
    onChange?: () => void;
    /** 对应旧 @back */
    onBack?: () => void;
}

/**
 * 时间筛选组件（自旧 pages/salesman/src/timeFilter.vue 逐行移植）
 * - 搜索框和日期选择组合
 * - 用于订单、业绩等列表筛选
 * - 旧 up-icon arrow-down → iconfont-h5 图标
 */
export default function TimeFilter({ params = {}, placeholder = "", showBack = false, onParamsChange, onChange, onBack }: Props) {
    const { height, contentHeight, contentWidth, statusBarHeight } = useSaveTopBoxHeight(60);

    const [filterParams, setFilterParams] = useState<TimeFilterParams>({ ...params });
    const [dateTabActive, setDateTabActive] = useState(0);
    const [showSelectDate, setShowSelectDate] = useState(false);
    const [timeDates, setTimeDates] = useState<string[]>([]);

    // 同步镜像，保证 onChange 回调里父级读到的是最新筛选条件（旧版直接改 props 上的对象）
    const paramsRef = useRef<TimeFilterParams>({ ...params });

    const displayPlaceholder = placeholder || t("输入用户手机号、订单号或商品名");

    /** 旧 filterParams 为 props 上的 computed 对象，改动即回写父级 */
    const patchParams = (patch: TimeFilterParams) => {
        paramsRef.current = { ...paramsRef.current, ...patch };
        setFilterParams(paramsRef.current);
        onParamsChange?.(paramsRef.current);
    };

    const dateTab = (val: number) => {
        switch (val) {
            case 0:
                patchParams({ orderTimeStart: "", orderTimeEnd: "" });
                break;
            case 1:
                patchParams({ orderTimeStart: formatDate(new Date()), orderTimeEnd: formatDate(new Date()) });
                break;
            case 2:
                patchParams({
                    orderTimeStart: formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000)),
                    orderTimeEnd: formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000))
                });
                break;
            case 3:
                patchParams({
                    orderTimeStart: formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 6)),
                    orderTimeEnd: formatDate(new Date())
                });
                break;
        }
        onChange?.();
        setDateTabActive(val);
        setTimeDates([]);
    };

    const confirm = (e: string[]) => {
        setTimeDates(e);
        patchParams({ orderTimeStart: e[0], orderTimeEnd: e[1] });
        setDateTabActive(-1);
        onChange?.();
    };

    return (
        <View>
            <View className="time-filter">
                <View className="search-box" style={{ height: `${height}px` }}>
                    <View className="status-bar" style={{ height: `${statusBarHeight}px` }} />
                    <View
                        className={`search-input-box${showBack ? " search-input-box--with-back" : ""}`}
                        style={{ height: `${contentHeight}px`, width: contentWidth }}
                    >
                        {showBack && (
                            <View className="search-back" onClick={() => onBack?.()}>
                                <View className="iconfont-h5 icon-houtui" />
                            </View>
                        )}
                        <View className="input">
                            <SearchInput
                                value={filterParams.keyword || ""}
                                placeholder={displayPlaceholder}
                                customStyle={{ width: "100%" }}
                                onChange={(value) => patchParams({ keyword: value })}
                                onConfirm={() => onChange?.()}
                                onClear={() => onChange?.()}
                            />
                        </View>
                    </View>
                </View>
                <View className="time-filter__inner">
                    <View className="time-filter-tags">
                        <View className={`time-filter-tags__item${dateTabActive === 0 ? " time-filter-tags__item--active" : ""}`} onClick={() => dateTab(0)}>
                            {t("全部")}
                        </View>
                        <View className={`time-filter-tags__item${dateTabActive === 1 ? " time-filter-tags__item--active" : ""}`} onClick={() => dateTab(1)}>
                            {t("今日")}
                        </View>
                        <View className={`time-filter-tags__item${dateTabActive === 2 ? " time-filter-tags__item--active" : ""}`} onClick={() => dateTab(2)}>
                            {t("昨日")}
                        </View>
                        <View className={`time-filter-tags__item${dateTabActive === 3 ? " time-filter-tags__item--active" : ""}`} onClick={() => dateTab(3)}>
                            {t("近七日")}
                        </View>
                    </View>
                    <View className="time-filter-custom" onClick={() => setShowSelectDate(true)}>
                        {timeDates.length ? (
                            <View className="time-filter__txt">
                                <View>{timeDates[0]}~</View>
                                {timeDates[1] ? <View>{timeDates[1]}</View> : null}
                            </View>
                        ) : (
                            t("自定义时间")
                        )}
                        <Text className="iconfont-h5 icon-xiajiantou1-copy time-filter-custom__arrow" />
                    </View>
                </View>
            </View>
            <SelectDate modelValue={showSelectDate} onChange={setShowSelectDate} onConfirm={confirm} />
        </View>
    );
}