import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import type { SortOrder, SortValue } from "../utils/searchRequest";

import "./SortBar.scss";

interface Props {
    sort: SortValue;
    order: SortOrder;
    onChange: (value: SortValue) => void;
}

const TABS: { label: string; value: SortValue }[] = [
    { label: "默认", value: "default" },
    { label: "销量", value: "sale" },
    { label: "上新", value: "time" },
    { label: "价格", value: "price" }
];

/** 以图搜图结果与层内文字结果共用的排序栏：默认 / 销量 / 上新 / 价格（自旧 sortBar.vue 移植） */
export default function SortBar({ sort, order, onChange }: Props) {
    return (
        <View className="sort-bar">
            {TABS.map((item) => (
                <View
                    key={item.value}
                    className={`sort-bar__item${sort === item.value ? " sort-bar__item--on" : ""}`}
                    onClick={() => onChange(item.value)}
                >
                    <Text>{t(item.label)}</Text>
                    {item.value === "price" && (
                        <View className="sort-bar__arrows">
                            <Text
                                className={`iconfont-h5 icon-up${sort === "price" && order === "asc" ? " sort-bar__arrow--on" : ""}`}
                            />
                            <Text
                                className={`iconfont-h5 icon-arrowdown${sort === "price" && order === "desc" ? " sort-bar__arrow--on" : ""}`}
                            />
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}