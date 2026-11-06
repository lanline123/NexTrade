import { Image, View } from "@tarojs/components";

import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";

import "./index.scss";

/** 历史协议兜底广告位（bannerList）（自旧 pages/member/components/decorate/advertising/index.vue 移植） */
export default function MemberAdvertising({ data = {} }: { data: any }) {
    const handleClick = (item: any) => {
        if (item?.picLink) {
            redirect({ url: urlFormat(item.picLink) });
        }
    };

    return (
        <View className="advertising-box">
            <View className="advertising-content">
                <Image className="advertising-image" src={imageFormat(data.picUrl)} mode="widthFix" onClick={() => handleClick(data)} />
            </View>
        </View>
    );
}