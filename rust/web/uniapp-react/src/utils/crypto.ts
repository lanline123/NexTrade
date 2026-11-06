import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";
import ECB from "crypto-js/mode-ecb";
import Pkcs7 from "crypto-js/pad-pkcs7";

//接口加密密钥--请自行修改
export const KEY = "TigShopApiSecret";
/**
 * @word 要加密的内容
 * @keyWord String  服务器随机返回的关键字
 *  */
export function aesEncrypt(word: any, keyWord = "XwKsGlMcdPMEhR1B") {
    const key = Utf8.parse(keyWord);
    const srcs = Utf8.parse(word);
    const encrypted = AES.encrypt(srcs, key, { mode: ECB, padding: Pkcs7 });
    return encrypted.toString();
}
