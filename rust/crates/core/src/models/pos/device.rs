//! 收银台设备（`/adminapi/pos/device`）DTO。
//!
//! 契约来源：`java/view/admin/src/api/setting/cashier.ts`
//! （`pos/device/list`、`pos/device/all`、`pos/device/detail`、
//! `pos/device/{create|update|del}`、`pos/device/updateField`）
//! + 表 `pos_device`（`java/database/pure.sql`）。
//!
//! 注意：参考 Java 工程（overseas / b2b2b-pro）均未提供该控制器实现，
//! 字段命名对齐前端类型与数据库列的 camelCase 转换。

use serde::{Deserialize, Serialize};

/// `GET /adminapi/pos/device/list` 查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDeviceListQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_size", alias = "pageSize")]
    pub size: u64,
    /// 1启用 2停用（<=0 / 缺省不筛）。
    pub status: Option<i32>,
    /// 关键字：设备名称 / 设备码 模糊。
    pub keyword: Option<String>,
}

fn default_page() -> u64 {
    1
}

fn default_size() -> u64 {
    20
}

impl PosDeviceListQuery {
    /// 分页 LIMIT/OFFSET。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let size = self.size.clamp(1, 200);
        let page = self.page.max(1);
        (size, (page - 1) * size)
    }
}

/// 设备行 VO（`pos_device` 行的 camelCase 形态）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDeviceVO {
    pub id: i32,
    pub shop_id: i32,
    pub device_name: Option<String>,
    pub device_code: Option<String>,
    /// 1启用 2停用。
    pub status: Option<i32>,
    pub last_used_time: Option<i64>,
    pub add_time: Option<i64>,
    pub update_time: Option<i64>,
}

/// 设备创建 / 编辑入参（`POST pos/device/create`、`POST pos/device/update`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDeviceWritePayload {
    /// 编辑时必填。
    pub id: Option<i32>,
    /// 创建时可指定（店铺账号登录时强制为自己的 shop_id）。
    pub shop_id: Option<i32>,
    pub device_name: Option<String>,
    pub device_code: Option<String>,
    pub status: Option<i32>,
}

/// `POST pos/device/updateField` 入参（对齐项目既有 `UpdateFieldDTO` 形态：
/// `{id, field, val}`，val 兼容数字/字符串）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDeviceUpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 可通过 updateField 修改的白名单字段（蛇形列名）。
pub const POS_DEVICE_UPDATE_FIELDS: [&str; 4] =
    ["status", "device_name", "device_code", "last_used_time"];

/// `POST pos/device/del` 入参（`id` 或 `ids` 逗号分隔二选一）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDeviceDelDTO {
    pub id: Option<i32>,
    pub ids: Option<String>,
}

impl PosDeviceDelDTO {
    /// 解析待删除 id 集合。
    #[must_use]
    pub fn id_list(&self) -> Vec<i32> {
        let mut out: Vec<i32> = Vec::new();
        if let Some(id) = self.id.filter(|x| *x > 0) {
            out.push(id);
        }
        if let Some(ids) = self.ids.as_deref() {
            out.extend(
                ids.split(',')
                    .filter_map(|x| x.trim().parse::<i32>().ok())
                    .filter(|x| *x > 0),
            );
        }
        out.sort_unstable();
        out.dedup();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn del_dto_parses_id_and_ids() {
        let d: PosDeviceDelDTO = serde_json::from_str(r#"{"ids":"1,2,2,3","id":5}"#).unwrap();
        assert_eq!(d.id_list(), vec![1, 2, 3, 5]);
    }

    #[test]
    fn update_field_accepts_numeric_val() {
        let d: PosDeviceUpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"status","val":2}"#).unwrap();
        assert_eq!(d.val.as_deref(), Some("2"));
    }
}
