//! merchant::merchant_client（商户入驻·前台）DTO / VO。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.param.merchant.MerchantApplyApplyParam`
//!   （`java/tigshop-bean/src/main/java/com/tigshop/bean/param/merchant/MerchantApplyApplyParam.java`）
//! - `com.tigshop.bean.vo.merchant.MerchantApplyDetailVO`
//! - `com.tigshop.bean.vo.merchant.MerchantMyApplyVO`
//!
//! > **注册说明**：本文件由 merchant::merchant_client 独占，`crates/core/src/models/mod.rs`
//! > 属共享文件，本切片**不修改**。主会话需添加一行 `pub mod merchant_client;`
//! > （放在其他 `pub mod sliceNNN;` 之间即可）。
//!
//! > **字段命名口径**：Java 侧这些类的属性都是 camelCase（`shopTitle` /
//! > `baseData` / `contactPhone`），落库时由 `JsonUtil.toJson(...)`
//! > （Jackson，字段名原样）写入 `merchant_apply.base_data` /
//! > `shop_data` / `merchant_data` 三个 `text` 列。
//! > 因此本文件的**入参**与**JSON 列内嵌结构**都必须用
//! > `#[serde(rename_all = "camelCase")]`，否则读到的历史数据字段全空。
//!
//! > **修订记录（merchant::merchant_client 实现期）**：
//! > 1. `status_text_or_err` 原先返回 500；Java
//! >    `new GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)` 的业务码是
//! >    **1001**（`HttpStatus.SERVICE_DATA_ERROR`），已修正为 1001；
//! > 2. `MerchantApplyApplyParam` 原先带结构级 `#[serde(default)]`，
//! >    会让缺失的 `baseData`/`merchantData`/`shopData` 被静默填成空结构体
//! >    （与 Java 三个 `@NotNull` 的 400 行为相反），已移除该 `default`；
//! > 3. 新增 `ApplyDetailQuery`（`applyDetail` 的必填 `id` 查询参数）。

use serde::{Deserialize, Serialize};

/// 入驻申请入参（对应 Java `MerchantApplyApplyParam`）。
///
/// Java 校验注解只有 3 个 `@NotNull`：`baseData` / `merchantData` /
/// `shopData`；`shopTitle` 与 `type` **没有**校验注解（可为 null）。
///
/// ⚠️ **刻意不加结构级 `#[serde(default)]`**：serde 对 `Option<T>` 字段
/// 天然「缺省 = None」，而 `base_data` / `merchant_data` / `shop_data`
/// 是**非 Option** 字段，缺省即反序列化失败 —— 恰好复刻 Java
/// `@Validated` + `@NotNull` 的 400 语义（真正把「申请资料为空」挡在写库前）。
/// 若加 `default`，缺 `baseData` 会被静默填成空结构体，落库一份脏申请。
/// （框架差异：axum `Json` 解析失败返回 HTTP 422，Java 返回 400，
/// 业务码同为参数校验类错误。）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantApplyApplyParam {
    /// 店铺名称
    pub shop_title: Option<String>,
    /// 类型：1 个人，2 企业（Java 侧无 `@NotNull`；服务层按 Java
    /// `param.getType() == 1` 的自动拆箱语义要求非空，见 uncertain_points）
    pub r#type: Option<i32>,
    /// 基础数据（Java `@NotNull`）
    pub base_data: ApplyBaseData,
    /// 商户数据（Java `@NotNull`）
    pub merchant_data: ApplyMerchantData,
    /// 店铺数据（Java `@NotNull`）
    pub shop_data: ApplyShopData,
}

/// 图片信息（Java `MerchantApplyApplyParam.PicInfo`，
/// 与 `MerchantApplyDetailVO.PicInfo` 字段完全相同，共用一份）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PicInfo {
    /// 图片缩略图
    pub pic_thumb: Option<String>,
    /// 图片 URL
    pub pic_url: Option<String>,
    /// 图片名称
    pub pic_name: Option<String>,
    /// URL（前端 el-upload 回填字段）
    pub url: Option<String>,
    /// UID
    pub uid: Option<i64>,
    /// 状态
    pub status: Option<String>,
}

/// 基础数据（Java `MerchantApplyApplyParam.BaseData`）。
///
/// 落库为 `merchant_apply.base_data`（JSON 串，camelCase）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ApplyBaseData {
    /// 类型（1 个人 / 2 企业）—— Java
    /// `merchantApply.setType(this.baseData.getType())` 用的就是这里，
    /// **不是**外层的 `param.type`
    pub r#type: Option<i32>,
    /// 公司名称
    pub company_name: Option<String>,
    /// 营业执照地址省份（region_id 列表）
    pub license_addr_province: Vec<i32>,
    /// 营业执照地址
    pub business_license_address: Option<String>,
    /// 经营范围
    pub business_scope: Option<String>,
    /// 营业执照编号
    pub business_license_id: Option<String>,
    /// 经营期限类型
    pub operating_term_type: Option<i32>,
    /// 经营期限类型日期
    pub operating_term_type_date: Vec<String>,
    /// 经营期限类型结束日期
    pub operating_term_type_end: Option<String>,
    /// 证书有效期类型
    pub certificate_validity_period: Option<i32>,
    /// 证书有效期日期
    pub certificate_validity_period_date: Vec<String>,
    /// 证书有效期结束日期
    pub certificate_validity_period_end: Option<String>,
    /// 营业执照正面照片
    pub front_of_photo: Vec<PicInfo>,
    /// 营业执照背面照片
    pub back_of_photo: Vec<PicInfo>,
    /// 证件类型
    pub document_type: Option<i32>,
    /// 法人名称
    pub corporate_name: Option<String>,
    /// 证件号码
    pub document_number: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 性别
    pub sex: Option<i32>,
    /// 居住地址
    pub residential_address: Option<String>,
    /// 补充信息
    pub supplementary_information: Vec<PicInfo>,
    /// 营业执照地址省份名称（Java 出参回填；入参同样透传落库）
    pub license_addr_province_name: Option<String>,
}

/// 商户数据（Java `MerchantApplyApplyParam.MerchantData`，
/// 与 `MerchantApplyDetailVO.MerchantData` 字段一致，共用一份）。
///
/// ⚠️ Java 侧 `MerchantApplyDetailVO.MerchantData` 的
/// `contactPhone` / `customerServicePhone` 标注了
/// `@Sensitive(type = PHONE)`（手机号脱敏切面），
/// 本仓库 Rust 侧尚未迁移该序列化切面 —— 与既有切片
/// （shop_client / proxy_shopping_pickup_contact / user_company / feedback）同口径：**原样返回**，
/// 差异已记入 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ApplyMerchantData {
    /// 联系人姓名
    pub contact_name: Option<String>,
    /// 联系人电话（Java 里审核链路按它匹配 `admin_user.mobile`，
    /// 并作为短信接收号码）
    pub contact_phone: Option<String>,
    /// 联系人邮箱
    pub contact_email: Option<String>,
    /// 银行存款（开户行名称）
    pub bank_deposit: Option<String>,
    /// 银行支行
    pub bank_branch: Option<String>,
    /// 银行卡号
    pub bank_card: Option<String>,
    /// 商家名称
    pub merchant_name: Option<String>,
    /// 客服电话
    pub customer_service_phone: Option<String>,
    /// 详细地址
    pub detailed_address: Option<String>,
    /// 业务地址（region_id 列表）
    pub business_address: Vec<i32>,
    /// 营业执照图片
    pub business_license_img: Vec<PicInfo>,
    /// 开户许可证
    pub account_opening_permit: Vec<PicInfo>,
    /// 业务地址名称（Java 出参回填）
    pub business_address_name: Option<String>,
}

/// 店铺数据（Java `MerchantApplyApplyParam.ShopData`）。
///
/// 出参侧 Java 把 `shopData` 当作**自由 JSON**
/// （`MerchantApplyDetailVO.shopData` 是 `cn.hutool.json.JSONObject`），
/// 所以 Rust 出参用 `serde_json::Value`；入参这里保留强类型结构，
/// 与 Java `JsonUtil.toJson(this.shopData)` 的落库内容一致。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ApplyShopData {
    /// 店铺标题
    pub shop_title: Option<String>,
    /// 客服电话
    pub customer_service_phone: Option<String>,
    /// 详细地址
    pub detailed_address: Option<String>,
    /// 联系人手机号
    pub contact_mobile: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 店铺 Logo
    pub shop_logo: Vec<PicInfo>,
}

/// 「我的申请」出参（对应 Java `MerchantMyApplyVO`）。
///
/// Java 用 `BeanUtil.copyProperties(merchantApply, MerchantMyApplyVO.class)`
/// 只拷同名属性，再补 `statusText` / `auditAdminName`，因此这里只 6 个字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantMyApplyVO {
    /// 商家入驻申请 ID
    pub merchant_apply_id: i32,
    /// 状态：1 待审核 / 10 审核通过 / 20 审核未通过
    pub status: Option<i32>,
    /// 类型：1 个人 / 2 企业
    pub r#type: Option<i32>,
    /// 状态文案
    pub status_text: String,
    /// 审核时间（秒级时间戳）
    pub audit_time: Option<i64>,
    /// 审核管理员姓名（未审核 / 系统自动通过 / 管理员已删除 → 空串）
    pub audit_admin_name: String,
}

/// 「申请详情」出参（对应 Java `MerchantApplyDetailVO`）。
///
/// ⚠️ Java 侧 `addTime` 是**格式化字符串**（`yyyy-MM-dd HH:mm:ss`），
/// `auditTime` 是 **Long 秒级时间戳** —— 两者类型不同，本结构如实复刻。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyDetailVO {
    /// 入驻申请 ID
    pub merchant_apply_id: i32,
    /// 商户认证日期（**已格式化**为 `yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 基础数据（由 `base_data` JSON 反序列化并回填省份名）
    pub base_data: ApplyBaseData,
    /// 企业名称
    pub company_name: Option<String>,
    /// 联系人名称
    pub contact_name: Option<String>,
    /// 联系人手机（Java 带 `@Sensitive(PHONE)`，Rust 未迁移切面 → 原样）
    pub contact_mobile: Option<String>,
    /// 申请主体信息
    pub corporate_name: Option<String>,
    /// 商户数据（由 `merchant_data` JSON 反序列化并回填业务地址名称）
    pub merchant_data: ApplyMerchantData,
    /// 审核时间（秒级时间戳）
    pub audit_time: Option<i64>,
    /// 审核管理员 ID（0 = 系统自动通过或未审核）
    pub audit_admin_id: Option<i32>,
    /// 审核管理员姓名（0 或管理员已删除 → 空串）
    pub audit_admin_name: String,
    /// 店铺数据（Java 是 `JSONObject`，原样透传）
    pub shop_data: serde_json::Value,
    /// 状态：1 待审核 / 10 审核通过 / 20 审核未通过
    pub status: Option<i32>,
    /// 状态文案
    pub status_text: String,
    /// 类型：1 个人 / 2 企业
    pub r#type: Option<i32>,
    /// 用户 ID
    pub user_id: Option<i32>,
    /// 店铺名称
    pub shop_title: Option<String>,
    /// 审核备注
    pub audit_remark: Option<String>,
    /// 审核通过后下发的初始登录信息（未通过 / 未匹配到管理员 → `null`）
    pub initial_user_info: Option<MerchantApplyInitialVO>,
}

/// 初始登录信息（Java `MerchantApplyDetailVO.initial`）。
///
/// ⚠️ Java 里字段名就是小写开头的 `initial`（内嵌类名），
/// JSON 属性名是 `username` / `mobile` / `initialPassword`，
/// 这里逐字复刻。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyInitialVO {
    /// 管理员用户名
    pub username: Option<String>,
    /// 管理员手机号（Java 带 `@Sensitive(PHONE)`，Rust 未迁移 → 原样）
    pub mobile: Option<String>,
    /// 初始密码（Java 下发 `admin_user.initial_password` 明文）
    pub initial_password: Option<String>,
}

/// 入驻申请状态：待审核（Java `MerchantApplyStatusEnum.PENDING_REVIEW`）。
pub const APPLY_STATUS_PENDING: i32 = 1;
/// 入驻申请状态：审核通过（Java `MerchantApplyStatusEnum.AUDIT_PASS`）。
pub const APPLY_STATUS_PASS: i32 = 10;
/// 入驻申请状态：审核未通过（Java `MerchantApplyStatusEnum.AUDIT_NOT_PASS`）。
pub const APPLY_STATUS_FAIL: i32 = 20;

/// 入驻申请类型：个人（Java `MerchantApplyTypeEnum.PERSONAL`）。
pub const APPLY_TYPE_PERSONAL: i32 = 1;
/// 入驻申请类型：企业（Java `MerchantApplyTypeEnum.ENTERPRISE`）。
pub const APPLY_TYPE_ENTERPRISE: i32 = 2;

/// 后台消息类型：店铺入驻申请
/// （Java `AdminMsgTypeEnum.SHOP_ENTRY_APPLICATION(41, ...)`）。
pub const ADMIN_MSG_TYPE_SHOP_ENTRY: i32 = 41;

/// 配置项：商户申请是否需要审核（Java
/// `SettingsEnum.MERCHANT_APPLY_NEED_CHECK("merchantApplyNeedCheck", ...)`，
/// 值 `1` = 需要审核，其它 = 免审核直接通过）。
pub const CFG_MERCHANT_APPLY_NEED_CHECK: &str = "merchantApplyNeedCheck";

/// 配置项：入驻协议内容（Java
/// `SettingsEnum.SHOP_AGREEMENT("shopAgreement", "店铺协议", ...)`）。
pub const CFG_SHOP_AGREEMENT: &str = "shopAgreement";

/// 状态码 → 文案（Java `MerchantApplyStatusEnum#getStatusName`）。
///
/// Java 对未知 code **抛** `GlobalException(DATA_TYPE_ERROR)`，
/// 本函数返回 `None` 交由调用方决定如何报错，便于单测。
#[must_use]
pub fn resolve_status_text(status: i32) -> Option<&'static str> {
    match status {
        APPLY_STATUS_PENDING => Some("待审核"),
        APPLY_STATUS_PASS => Some("审核通过"),
        APPLY_STATUS_FAIL => Some("审核未通过"),
        _ => None,
    }
}

/// 状态码 → 文案（未知 code 复刻 Java 抛错语义）。
///
/// 返回 `Err(1001, "数据类型异常")`：Java
/// `MerchantApplyStatusEnum#getStatusName` 抛的是
/// `new GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`，
/// 而 `HttpStatus.SERVICE_DATA_ERROR = 1001`（**不是** 500）。
pub fn status_text_or_err(status: Option<i32>) -> Result<String, crate::Error> {
    use crate::Error;
    match status.and_then(resolve_status_text) {
        Some(text) => Ok(text.to_string()),
        // Java `getStatusName` 的入参是 `int`（primitive），
        // status 为 null 时自动拆箱 NPE → HTTP 500；这里统一按业务错误返回
        None => Err(Error::biz(SERVICE_DATA_ERROR, DATA_TYPE_ERROR)),
    }
}

/// Java `HttpStatus.SERVICE_DATA_ERROR`（`GlobalException` 的默认业务码）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// Java `ExceptionConstants.DATA_TYPE_ERROR` 的文案。
pub const DATA_TYPE_ERROR: &str = "数据类型异常";

/// 「申请详情」查询参数（Java `MerchantApplyController.applyDetail` 的
/// `@RequestParam Integer id`，**必填**）。
///
/// 刻意不加 `default`：缺 `id` 时 axum `Query` 解析失败 → HTTP 400，
/// 与 Java 缺 `@RequestParam` 抛 `MissingServletRequestParameterException`
/// 一致（Java 侧业务码 1001）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDetailQuery {
    /// 入驻申请 ID（必填）
    pub id: i32,
}

/// 入驻申请不存在的文案。
///
/// Java `applyDetail` / `audit` 走的是 i18n：
/// `messageHelper.get("error.merchant.apply.not.exist")`
/// （`messages.properties:218` = 「商户申请信息不存在」）。
pub const MSG_MERCHANT_APPLY_NOT_EXIST: &str = "商户申请信息不存在";

/// 配置不存在的文案（Java `ConfigConstants.CONFIG_NOT_EXIST`）。
pub const MSG_CONFIG_NOT_EXIST: &str = "配置不存在";

/// 上传/开通链路未迁移的明确错误文案。
///
/// 刻意把**缺失的依赖**写进文案，避免前端把「未迁移」误判成业务失败：
/// 原 Java 的这条链路依赖图库上传（`GalleryPicService#uploadImg`，
/// 对象存储 + 水印 `ImageWatermarkUtil.tileText`）、角色初始化
/// （`AdminRoleService#initAdminRole` / `initEmployeeRoles`）、
/// 运费模板 / 装修模板初始化、短信通道等，Rust 侧均未迁移。
pub const MSG_LICENSE_UPLOAD_UNMIGRATED: &str =
    "营业执照上传尚未迁移：依赖图库/对象存储服务与水印字体（原 Java GalleryPicService#uploadImg + ImageWatermarkUtil），本构建无法落盘并返回图片地址";

/// 免审核开通链路未迁移的明确错误文案。
pub const MSG_OPEN_SHOP_UNMIGRATED: &str =
    "商户免审核自动开通尚未迁移：依赖角色初始化（AdminRoleService#initAdminRole / initEmployeeRoles）、运费模板初始化（ShippingTplService#initShippingTpl）、店铺装修初始化（DecorateService#initDecorate）与短信通道，本构建无法完成建店；请先把 merchantApplyNeedCheck 置为 1 走人工审核，或在 Java 侧执行";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_text_mapping_matches_java_enum() {
        assert_eq!(resolve_status_text(1), Some("待审核"));
        assert_eq!(resolve_status_text(10), Some("审核通过"));
        assert_eq!(resolve_status_text(20), Some("审核未通过"));
        assert_eq!(resolve_status_text(0), None);
        assert_eq!(resolve_status_text(99), None);
    }

    #[test]
    fn status_text_or_err_rejects_unknown_and_null() {
        assert_eq!(status_text_or_err(Some(10)).unwrap().as_str(), "审核通过");
        let err = status_text_or_err(Some(7)).unwrap_err();
        match &err {
            crate::Error::Biz { code, msg } => {
                // Java `new GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`
                // → HttpStatus.SERVICE_DATA_ERROR = 1001
                assert_eq!(*code, SERVICE_DATA_ERROR);
                assert_eq!(*code, 1001);
                assert_eq!(msg, DATA_TYPE_ERROR);
            }
            other => panic!("应返回业务错误，实际为 {other}"),
        }
        assert!(status_text_or_err(None).is_err());
    }

    #[test]
    fn apply_detail_query_requires_id() {
        // id 存在 → 正常解析
        let q: ApplyDetailQuery = serde_json::from_str(r#"{"id":8}"#).unwrap();
        assert_eq!(q.id, 8);
        // id 缺失 → 反序列化失败（对应 Java 「@RequestParam 必填」）
        assert!(serde_json::from_str::<ApplyDetailQuery>("{}").is_err());
    }

    #[test]
    fn apply_param_requires_not_null_payloads() {
        // Java `@NotNull`：baseData / merchantData / shopData 三者缺一即 400
        assert!(serde_json::from_str::<MerchantApplyApplyParam>(r#"{"shopTitle":"x"}"#).is_err());
        assert!(serde_json::from_str::<MerchantApplyApplyParam>(
            r#"{"baseData":{},"merchantData":{}}"#
        )
        .is_err());
        // 三者齐备、shopTitle/type 缺失 → 合法（Java 侧无 @NotNull）
        let ok: MerchantApplyApplyParam =
            serde_json::from_str(r#"{"baseData":{},"merchantData":{},"shopData":{}}"#).unwrap();
        assert!(ok.shop_title.is_none());
        assert!(ok.r#type.is_none());
    }

    #[test]
    fn constants_match_java_source() {
        assert_eq!(APPLY_STATUS_PENDING, 1);
        assert_eq!(APPLY_STATUS_PASS, 10);
        assert_eq!(APPLY_STATUS_FAIL, 20);
        assert_eq!(APPLY_TYPE_PERSONAL, 1);
        assert_eq!(APPLY_TYPE_ENTERPRISE, 2);
        assert_eq!(ADMIN_MSG_TYPE_SHOP_ENTRY, 41);
        assert_eq!(SERVICE_DATA_ERROR, 1001);
        assert_eq!(CFG_MERCHANT_APPLY_NEED_CHECK, "merchantApplyNeedCheck");
        assert_eq!(CFG_SHOP_AGREEMENT, "shopAgreement");
    }

    #[test]
    fn apply_param_deserializes_camel_case() {
        let raw = r#"{
            "shopTitle":"测试店",
            "type":2,
            "baseData":{"type":2,"companyName":"某某公司","corporateName":"张三",
                        "licenseAddrProvince":[110000,110100]},
            "merchantData":{"contactName":"张三","contactPhone":"13800008000",
                            "businessAddress":[110000],
                            "businessLicenseImg":[{"picUrl":"https://x/y.png","picThumb":"t"}]},
            "shopData":{"shopTitle":"测试店","shopLogo":[{"picUrl":"https://x/logo.png"}]}
        }"#;
        let param: MerchantApplyApplyParam = serde_json::from_str(raw).unwrap();
        assert_eq!(param.shop_title.as_deref(), Some("测试店"));
        assert_eq!(param.r#type, Some(2));
        assert_eq!(param.base_data.company_name.as_deref(), Some("某某公司"));
        assert_eq!(
            param.base_data.license_addr_province,
            vec![110_000, 110_100]
        );
        assert_eq!(
            param.merchant_data.contact_phone.as_deref(),
            Some("13800008000")
        );
        assert_eq!(
            param.merchant_data.business_license_img[0]
                .pic_url
                .as_deref(),
            Some("https://x/y.png")
        );
    }

    #[test]
    fn detail_vo_serializes_camel_case_and_nullable_initial() {
        let vo = MerchantApplyDetailVO {
            merchant_apply_id: 8,
            add_time: "2025-01-02 03:04:05".into(),
            status_text: "待审核".into(),
            shop_data: serde_json::json!({"shopTitle": "x"}),
            ..Default::default()
        };
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains(r#""merchantApplyId":8"#));
        assert!(json.contains(r#""addTime":"2025-01-02 03:04:05""#));
        assert!(json.contains(r#""initialUserInfo":null"#));
        assert!(json.contains(r#""licenseAddrProvince":[]"#));
    }

    #[test]
    fn unmigrated_messages_are_explicit() {
        assert!(MSG_LICENSE_UPLOAD_UNMIGRATED.contains("未迁移"));
        assert!(MSG_OPEN_SHOP_UNMIGRATED.contains("未迁移"));
    }
}
