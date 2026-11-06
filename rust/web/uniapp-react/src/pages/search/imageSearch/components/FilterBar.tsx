import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from "react";
import { Input, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getAttrOptionText } from "@/pages/search/composables";
import type { attrsData, attrsListData, Brand, filterSeleted } from "@/types/search/search";
import { t } from "@/utils/i18n";

import { cloneFilter, type ImageFilterState } from "../utils/searchRequest";

import "./FilterBar.scss";

interface Option {
    key: string | number;
    label: string;
    selected: boolean;
    toggle: () => void;
}

interface Props {
    modelValue: ImageFilterState;
    categoryList: filterSeleted[];
    brandList: Brand[];
    attrList: attrsListData[];
    /** 对应旧 @update:modelValue */
    onChange: (value: ImageFilterState) => void;
    /** 面板打开或关闭 */
    onToggle: (open: boolean) => void;
}

export interface FilterBarRef {
    close: () => void;
    isOpen: () => boolean;
}

const ATTR_PREFIX = "attr:";
const PLACEHOLDER_STYLE = "color: #bbb";

/**
 * 图搜结果的筛选栏：分类 / 品牌 / 价格 / 属性，各自一个下拉面板（自旧 filterBar.vue 移植）
 * 分类、品牌、每个属性都是单选，再点一次取消；选中后标签显示选中的值
 * 面板里改的是草稿，点「确定」才生效；点遮罩或再点一次标签则放弃改动
 */
const FilterBar = forwardRef<FilterBarRef, Props>(function FilterBar(
    { modelValue, categoryList, brandList, attrList, onChange, onToggle },
    ref
) {
    // 价格输入框聚焦时隐藏占位文字
    const [focusedInput, setFocusedInput] = useState<"" | "min" | "max">("");
    const [activeKey, setActiveKey] = useState("");

    // 旧 draft 为 reactive 对象、被就地修改；React 里用 ref 持有并强制重渲染（逐行保留原逻辑）
    const draftRef = useRef<ImageFilterState>(cloneFilter(modelValue));
    const [, bumpDraft] = useReducer((v: number) => v + 1, 0);

    // 旧 watch(() => !!activeKey) 只关心真假值变化
    const open = !!activeKey;
    useEffect(() => {
        onToggle(open);
    }, [open, onToggle]);

    // 已选但不在本次建议里的属性也要保留标签，否则用户没有地方取消它
    const names = attrList.map((item) => item.name);
    const missing = modelValue.attrs
        .filter((item) => !names.includes(item.attrName))
        .map((item) => ({ name: item.attrName, values: item.attrValue.map((value) => ({ value, count: 0 })) }));
    const attrGroups: attrsListData[] = [...attrList, ...missing];

    const selectedAttrValue = (attrs: attrsData[], name: string) => attrs.find((item) => item.attrName === name)?.attrValue[0] ?? "";

    const chips: { key: string; label: string; selected: boolean }[] = [];
    {
        const value = modelValue;
        if (categoryList.length || value.cat) {
            chips.push({ key: "cat", label: value.catName || t("分类"), selected: !!value.cat });
        }
        if (brandList.length || value.brand) {
            chips.push({ key: "brand", label: value.brandName || t("品牌"), selected: !!value.brand });
        }
        const hasPrice = value.min !== "" || value.max !== "";
        chips.push({ key: "price", label: hasPrice ? `${value.min || 0}-${value.max || t("不限")}` : t("价格区间"), selected: hasPrice });
        attrGroups.forEach((attr) => {
            const selected = selectedAttrValue(value.attrs, attr.name);
            chips.push({ key: ATTR_PREFIX + attr.name, label: selected || attr.name, selected: !!selected });
        });
    }

    const buildOptions = (): Option[] => {
        const state = draftRef.current;
        if (activeKey === "cat") {
            return categoryList.map((item) => ({
                key: item.categoryId ?? 0,
                label: item.categoryName || "",
                selected: state.cat === item.categoryId,
                toggle: () => {
                    const selected = state.cat === item.categoryId;
                    state.cat = selected ? 0 : item.categoryId || 0;
                    state.catName = selected ? "" : item.categoryName || "";
                    bumpDraft();
                }
            }));
        }
        if (activeKey === "brand") {
            return brandList.map((item) => ({
                key: item.brandId,
                label: item.brandName || "",
                selected: state.brand === item.brandId,
                toggle: () => {
                    const selected = state.brand === item.brandId;
                    state.brand = selected ? 0 : item.brandId;
                    state.brandName = selected ? "" : item.brandName || "";
                    bumpDraft();
                }
            }));
        }
        const name = activeKey.slice(ATTR_PREFIX.length);
        const group = attrGroups.find((item) => item.name === name);
        const selectedValue = selectedAttrValue(state.attrs, name);
        return (group?.values ?? []).map((item) => {
            const text = getAttrOptionText(item);
            return {
                key: text,
                label: text,
                selected: selectedValue === text,
                toggle: () => {
                    const others = state.attrs.filter((attr) => attr.attrName !== name);
                    state.attrs = selectedValue === text ? others : [...others, { attrName: name, attrValue: [text] }];
                    bumpDraft();
                }
            };
        });
    };
    const options = buildOptions();

    const close = () => {
        setActiveKey("");
        Taro.hideKeyboard();
    };

    const toggle = (key: string) => {
        if (activeKey === key) return close();
        // 每次打开都从已生效的条件开始
        draftRef.current = cloneFilter(modelValue);
        setActiveKey(key);
        bumpDraft();
    };

    // 只清当前面板这一项，其余筛选不动
    const reset = () => {
        const state = draftRef.current;
        if (activeKey === "cat") {
            state.cat = 0;
            state.catName = "";
        } else if (activeKey === "brand") {
            state.brand = 0;
            state.brandName = "";
        } else if (activeKey === "price") {
            state.min = "";
            state.max = "";
        } else {
            const name = activeKey.slice(ATTR_PREFIX.length);
            state.attrs = state.attrs.filter((item) => item.attrName !== name);
        }
        bumpDraft();
    };

    const confirm = () => {
        const state = draftRef.current;
        // 最低价高于最高价时对调，避免查出空结果
        if (state.min !== "" && state.max !== "" && Number(state.min) > Number(state.max)) {
            [state.min, state.max] = [state.max, state.min];
        }
        onChange(cloneFilter(state));
        close();
    };

    useImperativeHandle(ref, () => ({ close, isOpen: () => !!activeKey }));

    return (
        <View className="filter-bar">
            <ScrollView className="filter-bar__chips" scrollX showScrollbar={false}>
                <View className="filter-bar__chips-inner">
                    {chips.map((chip) => (
                        <View
                            key={chip.key}
                            className={`filter-bar__chip${chip.selected ? " filter-bar__chip--on" : ""}${
                                activeKey === chip.key ? " filter-bar__chip--open" : ""
                            }`}
                            onClick={() => toggle(chip.key)}
                        >
                            <Text className="filter-bar__chip-text">{chip.label}</Text>
                            <Text className={`iconfont-h5 ${activeKey === chip.key ? "icon-up" : "icon-arrowdown"}`} />
                        </View>
                    ))}
                </View>
            </ScrollView>

            {activeKey && (
                <>
                    {/* 遮罩从筛选栏下方铺到屏幕底部，点击放弃本次未确定的改动 */}
                    <View
                        className="filter-bar__mask"
                        onClick={close}
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                    />
                    <View
                        className="filter-bar__panel"
                        onTouchMove={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        {activeKey === "price" ? (
                            <View className="filter-bar__price">
                                <Input
                                    className="filter-bar__price-input"
                                    type="digit"
                                    value={draftRef.current.min}
                                    placeholder={focusedInput === "min" ? "" : t("最低价")}
                                    placeholderStyle={PLACEHOLDER_STYLE}
                                    onFocus={() => setFocusedInput("min")}
                                    onBlur={() => setFocusedInput("")}
                                    onInput={(e) => {
                                        draftRef.current.min = e.detail.value;
                                        bumpDraft();
                                    }}
                                />
                                <View className="filter-bar__price-line" />
                                <Input
                                    className="filter-bar__price-input"
                                    type="digit"
                                    value={draftRef.current.max}
                                    placeholder={focusedInput === "max" ? "" : t("最高价")}
                                    placeholderStyle={PLACEHOLDER_STYLE}
                                    onFocus={() => setFocusedInput("max")}
                                    onBlur={() => setFocusedInput("")}
                                    onInput={(e) => {
                                        draftRef.current.max = e.detail.value;
                                        bumpDraft();
                                    }}
                                />
                            </View>
                        ) : (
                            <ScrollView className="filter-bar__options" scrollY>
                                <View className="filter-bar__options-inner">
                                    {options.map((option) => (
                                        <View
                                            key={option.key}
                                            className={`filter-bar__option${option.selected ? " filter-bar__option--on" : ""}`}
                                            onClick={option.toggle}
                                        >
                                            <Text className="filter-bar__option-text">{option.label}</Text>
                                            {option.selected && <Text className="iconfont-h5 icon-gouxuan" />}
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                        <View className="filter-bar__actions">
                            <View className="filter-bar__btn filter-bar__btn--reset" onClick={reset}>
                                {t("重置")}
                            </View>
                            <View className="filter-bar__btn filter-bar__btn--confirm" onClick={confirm}>
                                {t("确定")}
                            </View>
                        </View>
                    </View>
                </>
            )}
        </View>
    );
});

export default FilterBar;