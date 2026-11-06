/** 1 个人、2 企业、3 个体工商户。 */
export type MerchantSubjectType = 1 | 2 | 3;

export interface MyMerchantResponse {
    data: ApplyDetailItem | null;
    code: number;
    message: string;
}

export interface ApplyDetailResponse {
    data: ApplyDetailItem;
    code: number;
    message: string;
}

export interface ApplyDetailItem {
    statusText: string;
    merchantApplyId: number;
    userId: number;
    addTime: string;
    shopName: string;
    status: number;
    type: MerchantSubjectType;
    contactName: null;
    contactMobile: null;
    auditTime: null;
    shopData: ShopData;
    baseData: BaseData;
    merchantData: MerchantData;
    companyName: string;
    corporateName: string;
    initialUserInfo: AnyObject;
    auditRemark: null;
}

export interface BaseData {
    companyName?: string;
    licenseAddrProvince?: number[];
    licenseAddrProvinceName?: string;
    businessLicenseAddress?: string;
    businessScope?: string;
    businessLicenseId?: string;
    operatingTermType?: number;
    operatingTermTypeDate?: string[];
    operatingTermTypeEnd?: string;
    supplementaryInformation?: BackOfPhoto[];
    type: MerchantSubjectType;
    certificateValidityPeriod: number;
    certificateValidityPeriodDate: string[];
    certificateValidityPeriodEnd: string;
    frontOfPhoto: BackOfPhoto;
    backOfPhoto: BackOfPhoto;
    documentType: number;
    corporateName: string;
    documentNumber: string;
    birthday: string;
    sex: number;
    residentialAddress: string;
}

export interface BackOfPhoto {
    picName: string;
    picThumb: string;
    picUrl: string;
}

export interface MerchantData {
    businessLicenseImg?: BackOfPhoto[];
    contactName: string;
    contactPhone: string;
    commonEmail: string;
    bankDeposit: string;
    bankBranch: string;
    /** 银行卡号；企业填写对公银行账户，兼容未填写卡号的历史资料。 */
    bankCard?: string;
    /** 个体工商户请求省略开户许可证。 */
    accountOpeningPermit?: BackOfPhoto[] | null;
    accountOpeningPermitTemp?: BackOfPhoto[] | null;
    merchantName: string;
    customerServicePhone: string;
    businessAddress: string;
    detailedAddress: string;
    businessAddressName: string;
    contactEmail: string;
}

export interface ShopData {
    shopName: string;
    customerServicePhone: string;
    businessAddress: number[];
    detailedAddress: string;
    shopLogo: BackOfPhoto[];
    supplementaryInformation: BackOfPhoto[];
    businessAddressName: string;
    shopTitle: string;
    contactMobile: string;
    description: string;
}
