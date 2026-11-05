/**
 * 商品卡购买按钮（移植自 view/admin src/modules/src/commonBuyButton/View.vue）
 *
 * 类名 goods-btn/btn-icon/btn-text 与样式表达式逐一致；图标用内联 SVG 替代
 * iconfont-h5（购物车/加号），视觉与 uniapp 端 iconfont 字形对齐。
 */
import { cssText, imageFormat, pickPic } from "./format";

export const gradientMap: Record<string, string> = {
    upDown: "to bottom",
    leftRight: "to right",
    diagonal: "to right bottom"
};

function CartIcon({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill={color} style={{ display: "block" }}>
            <path d="M401.3 829.9c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m400.4 0c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m211.9-622.1c-11-12.7-27.2-19.9-44.1-19.9H238.9l-17.4-96.8C217.4 55.4 185.5 29 149.5 29H63.4C37.8 29 17 49.8 17 75.4s20.8 46.4 46.4 46.4h86.1c3.2 0 5.9 2.3 6.5 5.4l76.7 425.7c8.5 47.6 49.8 82.1 98.2 82.1h438.3c46.4 0 86.9-33 96.2-78.5l54.7-270.4c3.4-18.1-1.3-36.6-13.5-50.3z" />
        </svg>
    );
}

function CartIcon2({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill={color} style={{ display: "block" }}>
            <path d="M896 149.3H725.3l-27.7-55.5c-8.1-16.2-24.6-26.5-42.7-26.5H369.1c-18.1 0-34.6 10.2-42.7 26.5l-27.7 55.5H128c-35.3 0-64 28.7-64 64v618.7c0 35.3 28.7 64 64 64h768c35.3 0 64-28.7 64-64V213.3c0-35.3-28.7-64-64-64z m-64 576H192V320h640v405.3z" />
        </svg>
    );
}

function PlusIcon({ color, plus = true }: { color: string; plus?: boolean }) {
    return (
        <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill={color} style={{ display: "block" }}>
            {plus ? (
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m213.3 480H544v181.3c0 17.6-14.4 32-32 32s-32-14.4-32-32V544H298.7c-17.6 0-32-14.4-32-32s14.4-32 32-32H480V298.7c0-17.6 14.4-32 32-32s32 14.4 32 32V480h181.3c17.6 0 32 14.4 32 32s-14.4 32-32 32z" />
            ) : (
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m192 480H320c-17.6 0-32-14.4-32-32s14.4-32 32-32h384c17.6 0 32 14.4 32 32s-14.4 32-32 32z" />
            )}
        </svg>
    );
}

interface BuyButtonStyle {
    showBtn?: number;
    btnType?: number;
    iconImage?: { picUrl?: string; picThumb?: string };
    iconSize?: number;
    text?: string;
    textColor?: string;
    textSize?: number;
    iconColor?: string;
    gradientType?: string;
    gradientColorA?: string;
    gradientColorB?: string;
    radius?: number;
    paddingTopBottom?: number;
    paddingLeftRight?: number;
    [key: string]: any;
}

export default function BuyButton({ styleOptions }: { styleOptions: BuyButtonStyle }) {
    const options = styleOptions ?? {};
    const iconSizeVal = options.iconSize ?? 14;
    const textSizeVal = options.textSize ?? 12;
    const iconBoxWidth = Math.max(iconSizeVal, 24);
    const iconImageSrc = options.iconImage && typeof options.iconImage === "object" ? pickPic(options.iconImage) : "";

    if (!options.btnType && !options.text) return null;

    let background = "";
    if (options.gradientType !== "purity") {
        background = `background-image: linear-gradient(${gradientMap[options.gradientType ?? "leftRight"]}, ${options.gradientColorA}, ${options.gradientColorB});`;
    } else {
        background = `background-color:${options.gradientColorA};`;
    }

    let paddingLeft = "padding-left:0";
    if (options.text) {
        paddingLeft = `padding-left: ${options.paddingLeftRight}px;`;
        if (!options.btnType) {
            paddingLeft = `padding-left: ${Number(options.paddingLeftRight || 0) + 10}px;`;
        }
    }

    const renderIcon = () => {
        switch (options.btnType) {
            case 1:
                return <CartIcon color={options.iconColor ?? "#ffffff"} />;
            case 2:
                return <CartIcon2 color={options.iconColor ?? "#ffffff"} />;
            case 3:
                return <PlusIcon color={options.iconColor ?? "#ffffff"} />;
            case 4:
                return <PlusIcon color={options.iconColor ?? "#ffffff"} plus={false} />;
            case 5:
                return iconImageSrc ? (
                    <img className="btn-icon-img" src={imageFormat(iconImageSrc)} style={{ width: iconSizeVal, height: iconSizeVal }} alt="" />
                ) : null;
            default:
                return null;
        }
    };

    return (
        <div>
            <div
                className="goods-btn"
                style={cssText(
                    `height: ${Number(options.paddingTopBottom || 0) + 24}px; padding-right: ${
                        options.text ? `${Number(options.paddingLeftRight || 0) + 10}px` : 0
                    }; border-radius: ${options.radius}px; color: ${options.textColor}; font-weight: 400;`,
                    background,
                    paddingLeft
                )}
            >
                {!!options.btnType && (
                    <div
                        className="btn-icon"
                        style={cssText(
                            `margin-left: ${options.text ? "5px" : 0}; margin-right: ${options.text ? "-2px" : "0px"}; width: ${iconBoxWidth}px; background: none; color: ${
                                options.iconColor
                            }; font-weight: 400; font-size: ${iconSizeVal}px;`
                        )}
                    >
                        {renderIcon()}
                    </div>
                )}
                {!!options.text && (
                    <div className="btn-text" style={cssText(`font-size: ${textSizeVal}px;`)}>
                        {options.text}
                    </div>
                )}
            </div>
        </div>
    );
}
