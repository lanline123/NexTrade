export interface getProductListFilterState {
    data: Item;
    code: number;
    message: string;
}

export interface Item {
    imgPadding: number;
    frame: Frame;
    title: Title;
    products: Products;
    style: number;
    goodsStyle: number;
    goodsRadioStyle: number;
    textAlign: number;
    textWeight: number;
    goodsNameRow: number;
    goodsNamePadding: number;
    showName: number;
    showBrief: number;
    showPrice: number;
    goodsPadding: number;
    buyBtnStyle: number;
    backgroundColor: string;
    boxRadius: number;
    innerPadding: number;
    boxPadding: number;
    boxPaddingTop: number;
    boxPaddingBottom: number;
    picType: number;
    waterfall: number;
}

export interface Frame {
    textColor: string;
    itemBackgroundColor: string;
    backgroundColor: string;
    innerPadding: number;
    itemHeight: number;
    itemRadius: number;
    boxRadius: number;
    boxPadding: number;
    boxPaddingTop: number;
    boxPaddingBottom: number;
}

export interface Products {
    productSelectType: number;
    productIds: number[];
    productCategoryId: number;
    productNumber: number;
    productTag: string;
    productList: ProductList[];
}

export interface ProductList {
    productId: number;
    picThumb: string;
    picUrl: string;
    productName: string;
    checkStatus: number;
    shopId: number;
    suppliersId: number;
    productType: number;
    productSn: string;
    productPrice: string;
    marketPrice: string;
    productStatus: number;
    isBest: number;
    isNew: number;
    isHot: number;
    productStock: number;
    sortOrder: number;
    seckillPrice: null;
    productSku: any[];
}

export interface Title {
    showTitle: number;
    titleStyle: number;
    titleAlign: number;
    titleBackground: string;
    titleBackground2: string;
    titleBackgroundPic: TitleBackgroundPic;
    titleRadius: number;
    titleText: string;
    titleColor: string;
    descText: string;
    descColor: string;
    showMore: number;
    moreLink: any[];
    moreColor: string;
    format: Format;
}

export interface Format {
    titleBackground: string;
    titleRadius: string;
}

export interface TitleBackgroundPic {
    picUrl: string;
    picThumb: string;
}
