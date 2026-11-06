import { View } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { imageFormat } from "@/utils/format";

import "./imageBox.scss";

interface Props {
    src?: string;
}

export default function ImageBox({ src }: Props) {
    return (
        <View className="item-img-a">
            <View className="item-img-bg" style={`background-image: url(${imageFormat(src ?? "")});`} />
            {/* TigImage 不接收 className，旧 <tig-image class="item-img"> 的样式由外层 View 承接 */}
            <View className="item-img">
                <TigImage mode="widthFix" src={src} />
            </View>
        </View>
    );
}
