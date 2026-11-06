import request from "@/utils/request";

/**
 * @description 验证码校验
 * @param data 验证码数据
 * @returns 校验结果
 */
export const verificationCheck = (data: object) => {
    return request({
        url: "common/verification/check",
        method: "POST",
        data
    });
};

/**
 * @description 获取图形验证码
 * @param data 验证码参数
 * @returns 验证码图片数据
 */
export const verificationCaptcha = (data: object) => {
    return request({
        url: "common/verification/captcha",
        method: "POST",
        data
    });
};

/**
 * @description 发送手机验证码
 * @param data 包含手机号、场景类型
 * @returns 发送结果
 */
export const sendMobileCode = (data: object) => {
    return request({
        url: "sys/sms/getCode",
        method: "POST",
        data
    });
};
