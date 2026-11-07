/**
 * 商品2 预览（移植自 view/admin editor/modules/mobile/product2/Preview.vue，跨境版样式）
 *
 * 类名与 Vue 版逐一致（ad-style__2 / item-image-bg / lyecs-buyBtn），
 * 样式由移植的全局 module.css 提供；商品列表按来源实时拉取。
 */
import { useMemo } from "react";
import { cssText, productImage, priceFormat } from "../../../shared/format";
import { useDecorateProductList } from "../../../shared/useDecorateProductList";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { product2Defaults } from "./index";

import { useI18n } from '../../../../../i18n';

export default function Product2Preview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, product2Defaults);
        return merged;
    }, [data]);

    const productList = useDecorateProductList(module.products);
    const frameFormat = formatFrame(module.frame ?? {});
    const boxMargin = cssText(
        `margin-left:${module.boxPadding ?? 10}px;margin-right:${module.boxPadding ?? 10}px;` +
        `margin-top:${module.boxPaddingTop ?? 5}px;margin-bottom:${module.boxPaddingBottom ?? 5}px;`,
    );
    const boxRadius = cssText(`border-radius:${module.boxRadius ?? 0}px;`);
    const innerPadding = cssText(`padding:${module.innerPadding ?? 0}px;`);
    const goodsPadding = cssText(`padding:${module.goodsPadding ?? 5}px;`);
    const goodsRadius = cssText(`border-radius:${module.goodsRadius ?? 0}px;`);

    return (
        <div
            className={
                "module-ad-con module-goods_ad ad-style__2 " +
                " ad-buy_btn_style__" + module.buyBtnStyle +
                " ad-goods_style__" + module.goodsStyle +
                " ad-goods_radio_style__" + module.goodsRadioStyle +
                " ad-text_align__" + module.textAlign +
                " ad-text_weight__" + module.textWeight +
                " ad-goods_name_row__" + module.goodsNameRow +
                " ad-goods_name_padding__" + module.goodsNamePadding +
                " ad-goods-title_style__" + module.title?.titleStyle
            }
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}
        >
            <div className="module-ad-content" style={{ ...boxRadius, ...innerPadding }}>
                {!productList || productList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">{t('点击添加图片广告')}</div>
                    </div>
                ) : null}
                <div className="goods-ad-warp">
                    <div className="goods-ad-con" style={boxMargin}>
                        {productList.map((item) => (
                            <div className="goods-ad-item" key={item.productId}>
                                <div className="item-content" style={{ ...goodsPadding, ...goodsRadius }}>
                                    <div className="item-con">
                                        <div className="item-photo">
                                            <a className="item-image-a">
                                                <div className="item-image-bg" style={{ backgroundColor: module.imageBackgroundColor }} />
                                                <img src={productImage(item)} alt="" />
                                            </a>
                                        </div>
                                        <div className="item-info">
                                            <div className="item-name">
                                                <a className="item-name-a">{item.productName}</a>
                                            </div>
                                            <div className="item-action">
                                                <div className="item-price">
                                                    <b className="price_format">{priceFormat(Number(item.productPrice))}</b>
                                                </div>
                                                <a className="buy-btn lyecs-buyBtn">
                                                    <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="#f23030" style={{ color: "#f23030", fontSize: 18, marginRight: 5, display: "block" }}>
                                                        <path d="M401.3 829.9c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m400.4 0c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m211.9-622.1c-11-12.7-27.2-19.9-44.1-19.9H238.9l-17.4-96.8C217.4 55.4 185.5 29 149.5 29H63.4C37.8 29 17 49.8 17 75.4s20.8 46.4 46.4 46.4h86.1c3.2 0 5.9 2.3 6.5 5.4l76.7 425.7c8.5 47.6 49.8 82.1 98.2 82.1h438.3c46.4 0 86.9-33 96.2-78.5l54.7-270.4c3.4-18.1-1.3-36.6-13.5-50.3z" />
                                                    </svg>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
