import { View } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { redirect } from "@/utils";
import { pickPic, productImage, urlFormat } from "@/utils/format";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";

import "./index.scss";

interface PicItem {
    picUrl?: string;
    picThumb?: string;
}

interface PicLink {
    link?: string;
    name?: string;
}

interface AdImageData extends ModuleDataWithFrame {
    pic?: PicItem;
    picLink?: PicLink;
}

/** 广告图模块（自旧 pages/member/components/decorate/adImage/index.vue 移植） */
export default function MemberAdImage({ data = {} }: { data: AdImageData }) {
    const cssVars = useFrameVars(data, {
        backgroundColor: "",
        boxRadius: 12,
        innerPadding: 0,
        boxPadding: 5,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    const handleClick = () => {
        const link = (data.picLink?.link as string | undefined)?.trim() || "";
        if (link) {
            redirect({ url: urlFormat(data.picLink as any) });
        }
    };

    if (!pickPic(data.pic)) return null;

    return (
        <View className="dec-ad-image" style={cssVars}>
            <View className="dec-ad-image__wrapper" onClick={handleClick}>
                <View className="dec-ad-image__img">
                    <TigImage src={productImage(data.pic)} mode="widthFix" />
                </View>
            </View>
        </View>
    );
}