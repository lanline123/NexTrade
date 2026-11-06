/** request 的泛型参数是完整响应，返回值为 data；code 可选以兼容现有响应声明。 */
export interface ApiEnvelope<T> {
    code?: number;
    message: string;
    data: T;
}
