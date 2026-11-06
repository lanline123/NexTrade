/** 高德安全代理路径，演示站由 Nginx 在服务端追加 jscode */
const AMAP_SERVICE_PATH = "/_AMapService";

/**
 * H5 改用后台配置的高德 JS Key 与安全配置。
 *
 * 旧方案依赖 uni-h5 在 __uniConfig 中的 aMapKey 注入；Taro H5 端没有该配置点，
 * 这里保持同签名，改为写入 window._AMapSecurityConfig（安全密钥走 securityJsCode，
 * 为空走本站 /_AMapService 代理），供自研地图组件在首次加载高德 SDK 前读取。
 * TODO(MIGRATION)：Taro H5 <Map> 组件的地图服务商与 Key 注入方式需在装修地图模块迁移时实测。
 */
export const applyAmapH5Config = (jsKey?: string | null, jsSecret?: string | null): void => {
    if (process.env.TARO_ENV !== "h5") return;
    if (!jsKey) return;
    const w = window as any;
    w.__TIG_AMAP_KEY__ = jsKey;
    w._AMapSecurityConfig = jsSecret
        ? { securityJsCode: jsSecret }
        : { serviceHost: `${window.location.origin}${AMAP_SERVICE_PATH}` };
};
