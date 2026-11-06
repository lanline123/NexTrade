import { View, Image } from "@tarojs/components";

import { staticResource } from "@/utils";

import "./index.scss";

interface Props {
    /** 是否处于触底加载中（对应旧 v-model） */
    modelValue: boolean;
    page: number;
    length: number;
    color?: string;
}

/** 触底加载指示（自旧 components/loading-box/loading-box.vue 移植） */
export default function LoadingBox({ modelValue, page, length, color = "" }: Props) {
    void length;
    void color;
    if (!(page > 1 && modelValue)) return null;
    return (
        <View className="loading-box">
            <View className="bottomLoading">
                <Image lazyLoad className="loading" src={staticResource("common/loading.gif")} />
            </View>
        </View>
    );
}
