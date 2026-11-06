import { useEffect, useState } from "react";
import { ScrollView, View, Text, Image } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { getCategoryList } from "@/api/productCate/productCate";
import type { filterSeleted } from "@/types/productCate/productCate";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./MainCategory.scss";

interface Props {
    shopId?: number;
    /** 对应旧 v-model:current-main-cate-id */
    currentMainCateId?: number;
    onCurrentMainCateIdChange?: (id: number) => void;
    /** 对应旧 @change（handleClick 时触发，携带新分类 id） */
    onChange?: (id: number) => void;
}

/**
 * 主分类导航组件（自旧 pages/productCate/src/mainCategory.vue 移植）
 * - 横向展示一级商品分类列表
 * - 点击切换分类
 */
export default function MainCategory({ shopId = 0, currentMainCateId, onCurrentMainCateIdChange, onChange }: Props) {
    const [menuList, setMenuList] = useState<filterSeleted[]>([]);
    const [scrollIntoView, setScrollIntoView] = useState("");
    const [show, setShow] = useState(false);

    const getMenuList = async () => {
        try {
            const result: any = await getCategoryList({ id: 0, shopId });
            setMenuList(result || []);
            if (result && result.length > 0) {
                onCurrentMainCateIdChange?.(result[0].categoryId);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 setup 阶段的 getMenuList()
    useEffect(() => {
        void getMenuList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClick = (id: number, intoView = "") => {
        if (id === currentMainCateId) return;
        onCurrentMainCateIdChange?.(id);
        setScrollIntoView(intoView);
        onChange?.(id);
    };

    const renderItem = (item: filterSeleted, index: number) => (
        <View key={item.categoryId ?? index} className="category-item-box">
            <View
                className={`category-item ${currentMainCateId === item.categoryId ? "active" : ""}`}
                onClick={() => handleClick(item.categoryId)}
            >
                <View className="item-img-box">
                    <Image className="cate-img" src={imageFormat(item.categoryPic || "")} />
                </View>
                <View className="item-text line1">{item.categoryName}</View>
            </View>
        </View>
    );

    return (
        <>
            <View className="category-content">
                <ScrollView scrollX scrollIntoView={scrollIntoView} className="category-scroll">
                    {menuList.map((item, index) => renderItem(item, index))}
                </ScrollView>
                <View
                    className="all-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShow(true);
                    }}
                >
                    <View>
                        <View className="btn-text">{t("全")}</View>
                        <View className="btn-text">{t("部")}</View>
                    </View>
                    <Text className="iconfont-h5 icon-quanbufenleizhankai" />
                </View>
            </View>

            {/* 旧 <tig-popup position="top" :z-index="999" :show-close="false" background-color="#f4f4f4"> → NutUI Popup */}
            <Popup visible={show} position="top" zIndex={999} closeable={false} onClose={() => setShow(false)} style={{ backgroundColor: "#f4f4f4" }}>
                <View className="category-popup">
                    <View className="category-list">
                        {menuList.map((item, index) => (
                            <View
                                key={item.categoryId ?? index}
                                className={`category-item ${currentMainCateId === item.categoryId ? "active" : ""}`}
                                onClick={() => handleClick(item.categoryId, `category-${item.categoryId}`)}
                            >
                                <View className="item-img-box">
                                    <Image className="cate-img" src={imageFormat(item.categoryPic || "")} />
                                </View>
                                <View className="item-text line1">{item.categoryName}</View>
                            </View>
                        ))}
                    </View>
                    <View className="cate-popup-close" onClick={() => setShow(false)}>
                        {t("点击收起")}
                        <Text className="iconfont-h5 icon-xiajiantou1-copy" />
                    </View>
                </View>
            </Popup>
        </>
    );
}
