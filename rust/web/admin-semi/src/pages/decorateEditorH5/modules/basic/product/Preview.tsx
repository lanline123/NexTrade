/**
 * 商品 预览（移植自 view/admin editor/modules/mobile/product/Preview.vue）
 *
 * 类名与 Vue 版逐一致（module-goods_ad / goods-ad-warp / goods-ad-item），
 * 样式由移植的全局 module.css 提供；商品列表按来源实时拉取。
 * 样式 7（轮播滑动）按每页 3 个切片轮播，指示器颜色可配。
 */
import { useMemo, useState } from "react";
import { Swiper, SwiperItem } from "@nutui/nutui-react";
import CommonTitle from "../../../shared/CommonTitle";
import { cssText, productImage, priceFormat } from "../../../shared/format";
import { useDecorateProductList } from "../../../shared/useDecorateProductList";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { productDefaults } from "./index";

import { useI18n } from '../../../../../i18n';
import "./Preview.css";

/** 旧版数字 buyBtnStyle（1-4 内置图标 / 5-6 购买 / 7-8 马上抢），与 Vue 版 lyecs-buyBtn 模板逐一致。 */
function LegacyBuyButton({ style }: { style: number }) {
    const iconColor = "#f23030";
    const cartPath = "M401.3 829.9c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m400.4 0c-35.8 0-64.9 29.1-64.9 64.9s29.1 64.9 64.9 64.9 64.9-29.1 64.9-64.9-29.1-64.9-64.9-64.9z m211.9-622.1c-11-12.7-27.2-19.9-44.1-19.9H238.9l-17.4-96.8C217.4 55.4 185.5 29 149.5 29H63.4C37.8 29 17 49.8 17 75.4s20.8 46.4 46.4 46.4h86.1c3.2 0 5.9 2.3 6.5 5.4l76.7 425.7c8.5 47.6 49.8 82.1 98.2 82.1h438.3c46.4 0 86.9-33 96.2-78.5l54.7-270.4c3.4-18.1-1.3-36.6-13.5-50.3z";
    const plusPath = "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m213.3 480H544v181.3c0 17.6-14.4 32-32 32s-32-14.4-32-32V544H298.7c-17.6 0-32-14.4-32-32s14.4-32 32-32H480V298.7c0-17.6 14.4-32 32-32s32 14.4 32 32V480h181.3c17.6 0 32 14.4 32 32s-14.4 32-32 32z";
    const iconStyle: React.CSSProperties = { color: "#f23030", fontSize: 18, marginRight: 5, display: "block" };
    const render = () => {
        if (style === 5 || style === 6) return <span style={iconStyle}>购买</span>;
        if (style === 7 || style === 8) return <span style={iconStyle}>马上抢</span>;
        if (style === 1 || style === 2) return <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill={iconColor} style={iconStyle}><path d={cartPath} /></svg>;
        if (style === 3 || style === 4) return <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill={iconColor} style={iconStyle}><path d={plusPath} /></svg>;
        return null;
    };
    return <a className="buy-btn lyecs-buyBtn">{render()}</a>;
}
export default function ProductPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, productDefaults);
        return merged;
    }, [data]);

    const productList = useDecorateProductList(module.products);
    const frameFormat = formatFrame(module.frame ?? {});
    const backgroundColor = module.backgroundColor ? cssText(`background-color:${module.backgroundColor};`) : undefined;
    const boxRadius = module.boxRadius !== undefined && module.boxRadius !== null ? cssText(`border-radius:${module.boxRadius}px;`) : undefined;
    const innerPadding = cssText(`padding:${module.innerPadding ?? 0}px;`);
    const goodsPadding = cssText(`padding:${module.goodsPadding ?? 5}px;`);
    const boxMargin = cssText(
        `margin-left:${module.boxPadding ?? 10}px;margin-right:${module.boxPadding ?? 10}px;` +
        `margin-top:${module.boxPaddingTop ?? 5}px;margin-bottom:${module.boxPaddingBottom ?? 5}px;`,
    );

    // 样式 7：每页 3 个商品切片轮播（与 Vue 版 getSwiperList 一致）
    const swiperList = useMemo(() => {
        const list: any[][] = [];
        if (Number(module.style) === 7) {
            const count = Math.ceil(productList.length / 3);
            for (let index = 0; index < count; index++) {
                list.push(productList.slice(index * 3, (index + 1) * 3));
            }
        }
        return list;
    }, [productList, module.style]);

    const [slideIndex, setSlideIndex] = useState(0);
    const swiperPageColor = module.swiperPageColor || "#333";
    const renderDots = (count: number) => (
        <div className="image-ad-dots">
            {Array.from({ length: count }).map((_, i) => (
                <i key={i} style={{ background: i === slideIndex ? swiperPageColor : "rgba(255,255,255,0.7)" }} />
            ))}
        </div>
    );

    const renderItemInfo = (item: any) => (
        <div className="item-info">
            <div className="item-name">
                {Number(module.showName) === 1 ? <a className="item-name-a">{item.productName}</a> : null}
                {Number(module.showBrief) === 1 && item.productBrief ? <a className="item-brief">{item.productBrief}</a> : null}
            </div>
            {Number(module.showPrice) === 1 ? (
                <div className="item-action">
                    <div className="item-price">
                        <b className="price_format">{priceFormat(Number(item.productPrice))}</b>
                    </div>
                    <div className="item-buy">
                        <LegacyBuyButton style={Number(module.buyBtnStyle)} />
                    </div>
                </div>
            ) : null}
        </div>
    );

    return (
        <div
            className={
                "module-ad-con module-goods_ad ad-style__" + module.style +
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
            <div className="module-ad-content" style={{ ...(backgroundColor || {}), ...(boxRadius || {}), ...innerPadding }}>
                {!productList || productList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-goods-bg" />
                        <div className="desc">{t('点击添加商品')}</div>
                    </div>
                ) : null}
                {module.title?.showTitle ? <CommonTitle data={module.title} /> : null}
                <div className="goods-ad-warp">
                    <div className="goods-ad-con" style={boxMargin}>
                        {Number(module.style) === 7 ? (
                            <Swiper
                                autoplay={3000}
                                loop={swiperList.length > 1}
                                onChange={(i: number) => setSlideIndex(i)}
                                indicator={renderDots(swiperList.length)}
                            >
                                {swiperList.map((group, gi) => (
                                    <SwiperItem key={gi}>
                                        {group.map((item, index) => (
                                            <div className="goods-ad-item" key={index}>
                                                <div className="item-content" style={goodsPadding}>
                                                    <div className="item-con">
                                                        <div className="item-photo">
                                                            <a className="item-image-a"><img src={productImage(item)} alt="" /></a>
                                                        </div>
                                                        {renderItemInfo(item)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </SwiperItem>
                                ))}
                            </Swiper>
                        ) : (
                            productList.map((item) => (
                                <div className="goods-ad-item" key={item.productId}>
                                    <div className="item-content" style={goodsPadding}>
                                        <div className="item-con">
                                            <div className="item-photo">
                                                <a className="item-image-a"><img src={productImage(item)} alt="" /></a>
                                            </div>
                                            {renderItemInfo(item)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
