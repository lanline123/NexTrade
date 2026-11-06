import request from "@/utils/request";

/**
 * @description 绑定手机号
 * @param data 包含手机号、验证码等
 * @returns 绑定结果
 */
export const bindMobilePhone = (data: any) => {
    return request({
        url: "user/login/bindMobile",
        method: "post",
        data
    });
};
