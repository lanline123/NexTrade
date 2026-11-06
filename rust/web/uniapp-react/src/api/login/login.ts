import request from "@/utils/request";

/**
 * @description 用户登录
 * @param data 登录凭证
 * @param header 可选请求头
 * @returns 用户信息及token
 */
export const userSignin = (data: any, header = {}) => {
    return request({
        url: "user/login/signin",
        method: "post",
        data,
        header
    });
};

/**
 * @description 获取CSRF令牌
 * @returns CSRF token
 */
export const csrfCreate = () => {
    return request({
        url: "common/csrf/create",
        method: "get"
    });
};

/**
 * @description 用户退出登录
 * @returns 操作结果
 */
export const userLogout = () => {
    return request({
        url: "user/user/logout",
        method: "post"
    });
};

/**
 * @description 发送手机验证码
 * @param data 包含手机号、场景类型
 * @returns 发送结果
 */
export const sendMobileCode = (data: object) => {
    return request({
        url: "user/login/sendMobileCode",
        method: "post",
        data
    });
};

/**
 * @description 发送邮箱验证码
 * @param data 包含邮箱地址、场景类型
 * @returns 发送结果
 */
export const sendEmailCode = (data: object) => {
    return request({
        url: "user/login/sendEmailCode",
        method: "post",
        data
    });
};

/**
 * @description 微信小程序获取手机号
 * @param data 包含加密数据
 * @returns 手机号
 */
export const getWechartMobile = (data: any) => {
    return request({
        url: "user/login/getMobile",
        method: "post",
        data
    });
};

/**
 * @description 更新用户微信OpenID
 * @param data 包含微信登录code
 * @returns 更新结果
 */
export const setMiniProgramOpenid = (data: any) => {
    return request({
        url: "user/login/updateUserOpenid",
        method: "post",
        data
    });
};

/**
 * @description 获取微信授权登录URL
 * @param params 包含回调地址
 * @returns 授权URL
 */
export const getOauthUrl = (params: any) => {
    return request({
        url: "user/login/getWxLoginUrl",
        method: "get",
        params
    });
};

/**
 * @description 通过授权code获取微信用户信息
 * @param params 包含code
 * @returns 微信用户信息
 */
export const getOauthInfo = (params: any) => {
    return request({
        url: "user/login/getWxLoginInfoByCode",
        method: "get",
        params
    });
};

/**
 * @description 绑定微信账号
 * @param data 微信授权信息
 * @returns 绑定结果
 */
export const bindWechat = (data: any) => {
    return request({
        url: "user/login/bindWechat",
        method: "post",
        data
    });
};

/**
 * @description 解绑微信账号
 * @returns 解绑结果
 */
export const unbindWechat = () => {
    return request({
        url: "user/login/unbindWechat",
        method: "get"
    });
};

/**
 * @description 检查手机号是否已注册
 * @param data 包含手机号
 * @returns 是否已注册
 */
export const checkMobile = (data: AnyObject) => {
    return request({
        url: "user/login/checkMobile",
        method: "post",
        data
    });
};

/**
 * @description 检查邮箱是否已注册
 * @param data 包含邮箱
 * @returns 是否已注册
 */
export const checkEmail = (data: AnyObject) => {
    return request({
        url: "user/login/checkEmail",
        method: "post",
        data
    });
};

/**
 * @description 获取第三方OAuth授权URL
 * @param path OAuth类型
 * @param returnUrl 登录成功后的站内回跳地址，可为空
 * @returns 授权URL
 */
export const getOauth = (path: string, returnUrl?: string) => {
    const query = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : "";
    return request({
        url: `user/oauth/render/${path}${query}`,
        method: "get"
    });
};

/**
 * @description 第三方OAuth授权回调处理
 * @param path OAuth类型
 * @param data 授权信息（包含 code、state）
 * @returns 登录结果
 */
export const getOauthCallback = (path: string, data: object) => {
    return request({
        url: `user/oauth/callback/${path}`,
        method: "post",
        data
    });
};
