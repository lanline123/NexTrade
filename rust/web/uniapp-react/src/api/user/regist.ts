import request from "@/utils/request";

/**
 * @description 用户注册
 * @param data 注册信息
 * @returns 注册结果
 */
export const userRegist = (data: {}) => {
    return request({
        url: "user/regist/registAct",
        method: "post",
        data
    });
};
