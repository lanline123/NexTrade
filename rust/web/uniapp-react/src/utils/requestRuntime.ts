// 框架无关的请求运行时（自旧 uniapp 原样平移）
export interface RequestRuntime {
    getClientType: () => string;
    getLocaleCode: () => string;
    handleLogin: () => void;
    initialize: () => void | Promise<void>;
}

let requestRuntime: RequestRuntime | null = null;

export const configureRequestRuntime = (runtime: RequestRuntime) => {
    requestRuntime = runtime;
};

export const getRequestRuntime = (): RequestRuntime => {
    if (!requestRuntime) {
        throw new Error("Request runtime is not configured");
    }
    return requestRuntime;
};
