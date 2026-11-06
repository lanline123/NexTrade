import { useMemo } from "react";
import { View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import TigImage from "@/components/tig/tig-image/TigImage";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { redirect } from "@/utils";
import { urlFormat } from "@/utils/format";

import ImageBox from "./src/imageBox";
import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageSquareAd({ module }: Props) {
    const { frame } = module;
    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);
    const format = useMemo(() => {
        return {
            imgPadding: "padding:" + designPxToRpx(module.imgPadding) + ";",
            imgRadiusVar: "--img-radius:" + designPxToRpx(module.imgRadius ?? 0) + ";"
        };
    }, [module]);

    return (
        <View
            className={`module-ad-con module-image_ad  ad-pic_type__ ad-pic_page_type__${module.picPageType} ad-radio_style__${module.picRadioStyle} `}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom + format.imgRadiusVar}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                {module.title.showTitle == 1 && <CommonTitle module={module.title} />}
                {module.picList.length > 0 && (
                    <View className="image-ad-warp" style={frameFormat.innerPadding}>
                        <View className="image-ad-con">
                            {module.picList && (
                                <>
                                    {module.picType == 5 ? (
                                        <View className="image-square-layout image-square-layout-height2">
                                            <View className="image-ad-item">
                                                <View
                                                    className="item-content"
                                                    style={format.imgPadding}
                                                    onClick={() => {
                                                        module.picList[0]?.picLink && redirect({ url: urlFormat(module.picList[0].picLink) });
                                                    }}
                                                >
                                                    <ImageBox src={module.picList[0]?.picUrl} />
                                                </View>
                                            </View>
                                            <View className="grid-layout-2">
                                                <View className="image-ad-item">
                                                    <View
                                                        className="item-content"
                                                        style={format.imgPadding}
                                                        onClick={() => {
                                                            module.picList[1]?.picLink && redirect({ url: urlFormat(module.picList[1].picLink) });
                                                        }}
                                                    >
                                                        <ImageBox src={module.picList[1]?.picUrl} />
                                                    </View>
                                                </View>
                                                <View className="image-ad-item">
                                                    <View
                                                        className="item-content"
                                                        style={format.imgPadding}
                                                        onClick={() => {
                                                            module.picList[2]?.picLink && redirect({ url: urlFormat(module.picList[2].picLink) });
                                                        }}
                                                    >
                                                        <ImageBox src={module.picList[2]?.picUrl} />
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ) : module.picType == 7 ? (
                                        <View className="image-square-layout2">
                                            <View className="image-ad-item">
                                                <View
                                                    className="item-content"
                                                    style={format.imgPadding}
                                                    onClick={() => {
                                                        module.picList[0]?.picLink && redirect({ url: urlFormat(module.picList[0].picLink) });
                                                    }}
                                                >
                                                    <ImageBox src={module.picList[0]?.picUrl} />
                                                </View>
                                            </View>
                                            <View className="grid-layout-2">
                                                <View className="image-ad-item">
                                                    <View
                                                        className="item-content"
                                                        style={format.imgPadding}
                                                        onClick={() => {
                                                            module.picList[1]?.picLink && redirect({ url: urlFormat(module.picList[1].picLink) });
                                                        }}
                                                    >
                                                        <ImageBox src={module.picList[1]?.picUrl} />
                                                    </View>
                                                </View>
                                                <View className="image-ad-item">
                                                    <View
                                                        className="item-content"
                                                        style={format.imgPadding}
                                                        onClick={() => {
                                                            module.picList[2]?.picLink && redirect({ url: urlFormat(module.picList[2].picLink) });
                                                        }}
                                                    >
                                                        <ImageBox src={module.picList[2]?.picUrl} />
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ) : module.picType == 6 ? (
                                        <View className="image-square-layout image-square-layout3 image-square-layout-height2">
                                            <View className="image-ad-item">
                                                <View
                                                    className="item-content"
                                                    style={format.imgPadding}
                                                    onClick={() => {
                                                        module.picList[0]?.picLink && redirect({ url: urlFormat(module.picList[0].picLink) });
                                                    }}
                                                >
                                                    <ImageBox src={module.picList[0]?.picUrl} />
                                                </View>
                                            </View>
                                            <View className="grid-layout-2">
                                                <View>
                                                    <View className="image-ad-item">
                                                        <View
                                                            className="item-content"
                                                            style={format.imgPadding}
                                                            onClick={() => {
                                                                module.picList[1]?.picLink && redirect({ url: urlFormat(module.picList[1].picLink) });
                                                            }}
                                                        >
                                                            <ImageBox src={module.picList[1]?.picUrl} />
                                                        </View>
                                                    </View>
                                                </View>
                                                <View className="grid-layout-3">
                                                    <View className="image-ad-item">
                                                        <View
                                                            className="item-content"
                                                            style={format.imgPadding}
                                                            onClick={() => {
                                                                module.picList[2]?.picLink && redirect({ url: urlFormat(module.picList[2].picLink) });
                                                            }}
                                                        >
                                                            <ImageBox src={module.picList[2]?.picUrl} />
                                                        </View>
                                                    </View>
                                                    <View className="image-ad-item">
                                                        <View
                                                            className="item-content"
                                                            style={format.imgPadding}
                                                            onClick={() => {
                                                                module.picList[3]?.picLink && redirect({ url: urlFormat(module.picList[3].picLink) });
                                                            }}
                                                        >
                                                            <ImageBox src={module.picList[3]?.picUrl} />
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className={`image-square-layout-${module.picType} image-square-layout-height1`}>
                                            {module.picList.map((pic: any, key: number) => (
                                                <View className="image-ad-item" key={key}>
                                                    <View
                                                        className="item-content"
                                                        style={format.imgPadding}
                                                        onClick={() => {
                                                            pic.picLink && redirect({ url: urlFormat(pic.picLink) });
                                                        }}
                                                    >
                                                        <View className="item-img-a">
                                                            <View className="item-img">
                                                                <TigImage src={pic.picUrl} mode="widthFix" />
                                                            </View>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
