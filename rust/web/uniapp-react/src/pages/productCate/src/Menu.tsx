import { useEffect, useState } from "react";
import { ScrollView, View } from "@tarojs/components";

import { getCategoryList } from "@/api/productCate/productCate";
import type { filterSeleted } from "@/types/productCate/productCate";

import "./Menu.scss";

interface Props {
    /** 对应旧 v-model:current-cate-id */
    currentCateId?: number;
    onCurrentCateIdChange?: (id: number) => void;
    /** 对应旧 @change（handleClick 时触发，携带新分类 id） */
    onChange?: (id: number) => void;
}

/**
 * 分类菜单组件（自旧 pages/productCate/src/menu.vue 移植）
 * - 左侧一级分类竖向导航
 * - 点击切换分类
 */
export default function MenuBox({ currentCateId, onCurrentCateIdChange, onChange }: Props) {
    const [menuList, setMenuList] = useState<filterSeleted[]>([]);

    const getMenuList = async () => {
        try {
            const result: any = await getCategoryList({ id: 0 });
            setMenuList(result || []);
            onCurrentCateIdChange?.((result?.[0]?.categoryId ?? 0) as number);
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 setup 阶段的 getMenuList()
    useEffect(() => {
        void getMenuList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClick = (id: number) => {
        if (id === currentCateId) return;
        onCurrentCateIdChange?.(id);
        onChange?.(id);
    };

    return (
        <View className="menu-content">
            <ScrollView scrollY className="menu-scroll">
                {menuList.map((item, index) => (
                    <View
                        key={item.categoryId ?? index}
                        className={`menu-item ${currentCateId === item.categoryId ? "active" : ""}`}
                        onClick={() => handleClick(item.categoryId)}
                    >
                        {item.categoryName}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
