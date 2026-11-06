import request from "@/utils/request";

/**
 * @description 忘记密码/重置密码
 * @param data 包含手机号、验证码、新密码
 * @returns 操作结果
 */
export const forgetPassword = (data: AnyObject) => {
    return request({
        url: "user/login/forgetPassword",
        method: "post",
        data
    });
};
