import { useEffect, useState } from "react";
import { ScrollView, View, Text } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { getCategoryList } from "@/api/productCate/productCate";
import type { filterSeleted } from "@/types/productCate/productCate";
import type { CateCenterV2Data } from "@/components/modules/cate-center/cate-center-v2/types";
import { t } from "@/utils/i18n";

import "./SelectCate.scss";

interface Props {
    currentCateId?: number;
    type?: string;
    /** 装修配置（用于获取 subTabStyle 等配置） */
    module?: CateCenterV2Data;
    /** 对应旧 v-model:sub-current-cate-id */
    subCurrentCateId?: number;
    onSubCurrentCateIdChange?: (id: number) => void;
    /** 对应旧 v-model:menu-list */
    menuList?: filterSeleted[];
    onMenuListChange?: (list: filterSeleted[]) => void;
    /** 对应旧 @change */
    onChange?: () => void;
}

/**
 * 分类选择弹窗组件（自旧 pages/productCate/src/selectCate.vue 移植）
 * - 横向二级分类标签 + 全部展开弹窗
 * - 支持多级分类选择
 */
export default function SelectCate({
    currentCateId,
    type = "",
    module = {},
    subCurrentCateId = 0,
    onSubCurrentCateIdChange,
    menuList = [],
    onMenuListChange,
    onChange
}: Props) {
    const [scrollLeft, setScrollLeft] = useState(0);
    const [show, setShow] = useState(false);

    const getMenuList = async (id: number) => {
        try {
            const result: any = await getCategoryList({ id });
            onMenuListChange?.([{ categoryId: 0, categoryName: t("全部商品") }, ...(result || [])]);
            onChange?.();
            setScrollLeft(0);
        } catch (error) {
            console.error(error);
        }
    };

    const handleClick = (id: number) => {
        if (id === subCurrentCateId) return;
        onSubCurrentCateIdChange?.(id);
        onChange?.();
    };

    const handleScroll = (e: any) => {
        setScrollLeft(e.detail.scrollLeft);
    };

    /**
     * 二级分类标签样式：1=实心高亮，2=描边高亮
     */
    const subTabStyle = module?.subTabStyle ?? 1;

    /**
     * 拼出激活态 class，按 subTabStyle 区分 solid / outline
     */
    const getActiveClass = (categoryId: number) => {
        const isActive = categoryId === subCurrentCateId;
        const isMain = type === "main";

        if (!isActive) {
            return isMain ? "main" : "";
        }

        if (isMain) {
            return subTabStyle === 1 ? "active main solid" : "active main outline";
        }

        return subTabStyle === 1 ? "active solid" : "active outline";
    };

    const handleShowPopup = () => {
        if (menuList.length) {
            setShow(true);
        }
    };

    const catePopupTitle = menuList.find((item) => item.categoryId === subCurrentCateId)?.categoryName;

    // 对应旧 watch(() => props.currentCateId)
    useEffect(() => {
        if (currentCateId && currentCateId > 0) {
            void getMenuList(currentCateId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentCateId]);

    return (
        <View className="cate-box">
            <ScrollView scrollX className="cate-scroll" scrollWithAnimation scrollLeft={scrollLeft} onScroll={handleScroll}>
                {menuList.map(
                    (item, index) =>
                        item.categoryName && (
                            <View
                                key={item.categoryId ?? index}
                                className="cate-item"
                                onClick={() => handleClick(item.categoryId)}
                            >
                                <View className={`item-text ${getActiveClass(item.categoryId)}`}>{item.categoryName}</View>
                            </View>
                        )
                )}
            </ScrollView>
            <View className="cate-btn" onClick={handleShowPopup}>
                <Text className="iconfont-h5 icon-arrowdown cate-btn-arrow" />
            </View>
            {/* 旧 <tig-popup position="top" :z-index="999" :show-close="false" background-color="#fff"> → NutUI Popup */}
            <Popup
                visible={show}
                position="top"
                zIndex={999}
                closeable={false}
                onClose={() => setShow(false)}
                style={{ backgroundColor: "#fff" }}
            >
                <View className="cate-popup">
                    <View className="cate-popup-title">{catePopupTitle}</View>
                    <View className="cate-popup-list-box">
                        <View className="cate-popup-list">
                            {menuList.map((item, index) => (
                                <View key={item.categoryId ?? index} className="list-item popup-item" onClick={() => handleClick(item.categoryId)}>
                                    <View className={`item-text popup-text line1 ${getActiveClass(item.categoryId)}`}>{item.categoryName}</View>
                                </View>
                            ))}
                        </View>
                    </View>
                    <View className="cate-popup-close" onClick={() => setShow(false)}>
                        {t("点击收起")}
                        <Text className="iconfont-h5 icon-xiajiantou1-copy" />
                    </View>
                </View>
            </Popup>
        </View>
    );
}
