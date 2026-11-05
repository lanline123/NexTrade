//! 用户实名/企业认证客户端域（member::user_company_client）。
//! Java `UserCompanyClientController`（`/api/user/company/apply|detail|myApply`，需登录）。
//! 表 `user_company`；状态：0 待审核 / 1 审核通过 / 2 审核未通过（Java `UserCompanyStatus`）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SERVICE_DATA_ERROR: i32 = 1001;
pub const COMPANY_NAME_REQUIRED: &str = "企业名称不能为空";
pub const CONTACT_NAME_REQUIRED: &str = "联系人不能为空";
pub const CONTACT_MOBILE_REQUIRED: &str = "联系电话不能为空";
pub const ALREADY_PENDING: &str = "已有待审核的实名认证申请";
pub const COMPANY_NOT_EXIST: &str = "实名认证信息不存在";

#[must_use]
pub fn status_text(status: i32) -> &'static str {
    match status {
        0 => "待审核",
        1 => "审核通过",
        2 => "审核未通过",
        _ => "",
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyDTO {
    pub r#type: Option<i32>,
    pub contact_name: Option<String>,
    pub contact_mobile: Option<String>,
    pub company_name: Option<String>,
    pub company_data: Option<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyVO {
    pub id: i32,
    pub user_id: i32,
    pub r#type: i32,
    pub contact_name: String,
    pub contact_mobile: String,
    pub company_name: String,
    pub company_data: Option<Value>,
    pub status: i32,
    pub status_text: String,
    pub audit_remark: String,
    pub audit_time: String,
    pub add_time: String,
}

#[must_use]
pub fn format_time(ts: Option<i32>) -> String {
    let Some(ts) = ts.filter(|t| *t > 0) else {
        return String::new();
    };
    chrono::DateTime::from_timestamp(i64::from(ts), 0)
        .map(|dt| {
            dt.with_timezone(
                &chrono::FixedOffset::east_opt(8 * 3600)
                    .unwrap_or_else(|| chrono::FixedOffset::east_opt(0).expect("utc")),
            )
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_texts() {
        assert_eq!(status_text(0), "待审核");
        assert_eq!(status_text(1), "审核通过");
        assert_eq!(status_text(2), "审核未通过");
        assert_eq!(status_text(9), "");
    }

    #[test]
    fn required_messages() {
        assert_eq!(COMPANY_NAME_REQUIRED, "企业名称不能为空");
        assert_eq!(CONTACT_NAME_REQUIRED, "联系人不能为空");
        assert_eq!(CONTACT_MOBILE_REQUIRED, "联系电话不能为空");
    }

    #[test]
    fn dto_and_time() {
        let dto: UserCompanyDTO =
            serde_json::from_str(r#"{"type":2,"companyName":"A","companyData":{"k":1}}"#).unwrap();
        assert_eq!(dto.r#type, Some(2));
        assert_eq!(dto.company_name.as_deref(), Some("A"));
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }
}
