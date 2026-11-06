import request from "@/utils/request";

/**
 * @description 发送旧手机号验证码（用于验证身份）
 * @param data 包含手机号
 * @returns 发送结果
 */
export const sendMobileCodeByMobileValidate = (data: object) => {
    return request({
        url: "user/user/sendMobileCodeByMobileValidate",
        method: "post",
        data
    });
};

/**
 * @description 验证旧手机号验证码
 * @param data 包含验证码
 * @returns 验证结果
 */
export const mobileValidate = (data: object) => {
    return request({
        url: "user/user/mobileValidate",
        method: "post",
        data
    });
};

/**
 * @description 发送新手机号验证码
 * @param data 包含新手机号
 * @returns 发送结果
 */
export const sendMobileCodeByMobileMobile = (data: object) => {
    return request({
        url: "user/user/sendMobileCodeByModifyMobile",
        method: "post",
        data
    });
};

/**
 * @description 绑定新手机号
 * @param data 包含新手机号、验证码
 * @returns 操作结果
 */
export const mobileMobile = (data: object) => {
    return request({
        url: "user/user/modifyMobile",
        method: "post",
        data
    });
};

/**
 * @description 发送修改密码验证码
 * @param data 包含手机号
 * @returns 发送结果
 */
export const sendMobileCodeByMobilePassword = (data: object) => {
    return request({
        url: "user/user/sendMobileCodeByModifyPassword",
        method: "post",
        data
    });
};

/**
 * @description 验证修改密码验证码
 * @param data 包含验证码
 * @returns 验证结果
 */
export const checkModifyPasswordMobileCode = (data: object) => {
    return request({
        url: "user/user/checkModifyPasswordMobileCode",
        method: "post",
        data
    });
};

/**
 * @description 发送旧邮箱验证码（用于验证身份）
 * @param data 包含邮箱
 * @returns 发送结果
 */
export const sendEmailCodeByEmailValidate = (data: object) => {
    return request({
        url: "user/user/sendEmailCodeByEmailValidate",
        method: "post",
        data
    });
};

/**
 * @description 验证旧邮箱验证码
 * @param data 包含验证码
 * @returns 验证结果
 */
export const emailValidate = (data: object) => {
    return request({
        url: "user/user/emailValidateNew",
        method: "post",
        data
    });
};

/**
 * @description 发送新邮箱验证码
 * @param data 包含新邮箱
 * @returns 发送结果
 */
export const sendEmailCodeByModifyEmail = (data: object) => {
    return request({
        url: "user/user/sendEmailCodeByModifyEmail",
        method: "post",
        data
    });
};

/**
 * @description 绑定新邮箱
 * @param data 包含新邮箱、验证码
 * @returns 操作结果
 */
export const emailEmailValidate = (data: object) => {
    return request({
        url: "user/user/modifyEmail",
        method: "post",
        data
    });
};
