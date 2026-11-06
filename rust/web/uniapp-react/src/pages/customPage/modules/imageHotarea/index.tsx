import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import TigImage from "@/components/tig/tig-image/TigImage";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { redirect } from "@/utils";
import { urlFormat } from "@/utils/format";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageHotarea({ module }: Props) {
    const frameFormat = useMemo(() => {
        return formatFrame(module.frame ?? {});
    }, [module.frame]);

    const format = useMemo(() => {
        return {
            imgPadding: "padding:" + designPxToRpx(module?.imgPadding) + ";"
        };
    }, [module?.imgPadding]);

    function convertPxToRpx(position: string): string {
        return position.replace(/(\d+\.?\d*)px/g, (match, num) => {
            return parseFloat(num) * 2 + "rpx";
        });
    }

    return (
        <View
            className={`module-ad-con module-ad-con- ad-radio_style__${module.radioStyle}`}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                {module.title.showTitle == 1 && <CommonTitle module={module.title} />}
                {module.picList && (
                    <View className="image-ad-warp image-hotarea-warp" style={frameFormat.innerPadding}>
                        <View className="image-ad-con">
                            {module.picList.map((item: any, itemIndex: number) => (
                                <View className="image-ad-item" key={item.picId ?? itemIndex}>
                                    <View className="item-content" style={format.imgPadding}>
                                        <View className="item-content-hotatrea">
                                            {/* TigImage 不接收 className，旧 <tig-image class="item-img-bg"> 的样式由外层 View 承接 */}
                                            <View className="item-img-bg">
                                                <TigImage src={item.picUrl} mode="widthFix" />
                                            </View>
                                            {item.hotarea &&
                                                item.hotarea.map((subItem: any, index: number) => (
                                                    <View
                                                        key={index}
                                                        className="image-hotarea-link"
                                                        style={convertPxToRpx(subItem.position)}
                                                        onClick={() => {
                                                            subItem.link && redirect({ url: urlFormat(subItem.link) });
                                                        }}
                                                    >
                                                        <Text className="area_box_con_text">{subItem.link?.name ?? ""}</Text>
                                                    </View>
                                                ))}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
