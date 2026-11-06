import { View, Text } from "@tarojs/components";

import ImageSearchEntry from "@/components/imageSearchEntry";
import { t } from "@/utils/i18n";

import "./Search.scss";

interface Props {
    placeholder?: string;
    needMenu?: boolean;
    /** 对应旧 @menu / @search */
    onMenu?: () => void;
    onSearch?: () => void;
}

/**
 * 分类页顶部搜索入口（自旧 pages/productCate/src/search.vue 移植）
 * - 点击跳转搜索页
 */
export default function SearchBox({ placeholder = "搜索商品", needMenu = false, onMenu, onSearch }: Props) {
    return (
        <View className="search-box">
            {needMenu && (
                <View
                    className="btn-box"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMenu?.();
                    }}
                >
                    <Text className="iconfont-h5 icon-shouye" />
                </View>
            )}
            <View
                className="search-content"
                onClick={(e) => {
                    e.stopPropagation();
                    onSearch?.();
                }}
            >
                <Text className="iconfont-h5 icon-sousuo1" />
                <Text className="placeholder-text">{t(placeholder)}</Text>
                <ImageSearchEntry flushRight />
            </View>
        </View>
    );
}
