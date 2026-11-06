import path from "path";

import { defineConfig, type UserConfigExport } from "@tarojs/cli";

import devConfig from "./dev";
import prodConfig from "./prod";

// https://taro-docs.jd.com/docs/next/config
export default defineConfig(async (merge) => {
    const baseConfig: UserConfigExport = {
        projectName: "uniapp-react",
        date: "2026-11-4",
        designWidth: 750,
        deviceRatio: {
            640: 2.34 / 2,
            750: 1,
            375: 2,
            828: 1.81 / 2
        },
        sourceRoot: "src",
        // 默认 dist。TARO_OUTPUT_ROOT 可覆盖（实测：weapp 构建能正确重定向；h5 构建
        // 仍会清空并写入 dist，因此 h5 验证后必须重跑一次 build:weapp 才能给微信开发者工具用）。
        outputRoot: process.env.TARO_OUTPUT_ROOT || "dist",
        // 与旧 uniapp 保持一致的路径别名，让 utils/api/store 迁移时 import 语句零改动
        alias: {
            "@": path.resolve(__dirname, "..", "src")
        },
        plugins: [],
        defineConstants: {},
        copy: {
            patterns: [],
            options: {}
        },
        framework: "react",
        compiler: "webpack5",
        cache: {
            enable: false
        },
        mini: {
            postcss: {
                pxtransform: {
                    enable: true,
                    config: {}
                },
                cssModules: {
                    enable: false,
                    config: {
                        namingPattern: "module",
                        generateScopedName: "[name]__[local]___[hash:base64:5]"
                    }
                }
            }
        },
        h5: {
            publicPath: "/",
            staticDirectory: "static",
            output: {
                filename: "js/[name].[hash:8].js",
                chunkFilename: "js/[name].[chunkhash:8].js"
            },
            miniCssExtractPluginOption: {
                ignoreOrder: true,
                filename: "css/[name].[hash].css",
                chunkFilename: "css/[name].[chunkhash].css"
            },
            postcss: {
                autoprefixer: {
                    enable: true,
                    config: {}
                },
                cssModules: {
                    enable: false,
                    config: {
                        namingPattern: "module_[hash:base64:5]",
                        generateScopedName: "module_[hash:base64:5]"
                    }
                }
            }
        }
    };

    if (process.env.NODE_ENV === "development") {
        // 本地开发构建配置
        return merge({}, baseConfig, devConfig);
    }
    // 生产构建配置
    return merge({}, baseConfig, prodConfig);
});
