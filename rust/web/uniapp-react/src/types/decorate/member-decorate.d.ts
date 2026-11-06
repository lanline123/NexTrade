/**
 * 会员中心装修模块（H5 会员页 moduleList）
 */
export interface MemberDecorateModule {
    type: string;
    isShow?: boolean;
    fixed?: boolean;
    module?: Record<string, any>;
}

/** 会员装修广告位（兼容老 advertising 组件） */
export interface AdModuleData {
    picUrl?: string;
    picLink?: string;
    [key: string]: unknown;
}
