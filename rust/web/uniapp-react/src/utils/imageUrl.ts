/**
 * 使用静态资源域名补全相对图片地址。
 */
export const resolveImageUrl = (imagePath: string, storageUrl = "") => {
    if (!imagePath) {
        return "";
    }
    return imagePath.includes("http") ? imagePath : storageUrl + imagePath;
};
