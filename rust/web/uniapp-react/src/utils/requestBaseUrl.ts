export const resolveBaseUrl = (envUrl?: string, h5Origin?: string): string => envUrl || h5Origin || "";

let h5Origin: string | undefined = undefined;

// Taro 的 TARO_ENV 由 DefinePlugin 编译期替换，非 H5 端该分支会被摇树剔除
if (process.env.TARO_ENV === "h5") {
    h5Origin = window.location.origin;
}

export const baseUrl = resolveBaseUrl(process.env.TARO_APP_API_URL, h5Origin);
