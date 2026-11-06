/**
 * 邮编校验（自旧 pages/address/utils/postcode.ts 整文件移植）
 * @param value 邮编
 * @param required 是否必填（海外模式只要求非空，格式由国家配置的 postcodePattern 校验）
 */
export const isPostcodeValid = (value: string, required: boolean) => {
    return !required || Boolean(value.trim());
};