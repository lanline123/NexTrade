export interface ApplyDetailResponse {
    item: ApplyDetailItem;
    code: number;
    message: string;
}

export interface ApplyDetailItem {
    statusText?: string;
    merchantApplyId?: number;
    userId?: number;
    addTime?: string;
    shopName?: string;
    status?: number;
    type?: number;
    contactName?: null;
    contactMobile?: null;
    auditTime?: null;
    companyData: CompanyData;
    companyName?: string;
    corporateName?: string;
    auditRemark?: null;
}

export interface CompanyData {
    frontOfPhoto: any[];
    backOfPhoto: any[];
    licenseAddrProvince: any[];
    supplementaryInformation: any[];
    businessLicenseImg: any[];
    sex: number;
    operatingTermType: number;
    operatingTermTypeDate: any[];
    operatingTermTypeEnd: string;
    certificateValidityPeriod: number;
    certificateValidityPeriodDate: any[];
    certificateValidityPeriodEnd: string;
    documentType?: number;
    businessLicenseId?: string;
    businessScope?: string;
    licenseAddrProvinceName?: string;
    businessLicenseAddress?: string;
    companyName?: string;
    residentialAddress?: string;
    contactPhone?: number;
    documentNumber?: number;
    corporateName?: string;
}
