//! 运费模板域（logistics::shipping_tpl）仓储：`shipping_tpl` / `shipping_tpl_info` /
//! `shipping_type`。
//!
//! 对应原 Java：
//! - `com.tigshop.mapper.setting.ShippingTplMapper`（`BaseMapper<ShippingTpl>`
//!   + `BaseServiceImpl` 的通用方法）
//! - `com.tigshop.mapper.setting.ShippingTplInfoMapper`
//! - `com.tigshop.mapper.setting.ShippingTypeMapper`
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table <表名>`）：
//!
//! ```text
//! shipping_tpl (7 列, 主键 shipping_tpl_id)
//!   shipping_tpl_id / shipping_time / shipping_tpl_name / is_free /
//!   pricing_type / is_default / shop_id
//!
//! shipping_tpl_info (12 列, 主键 id)
//!   id / shipping_type_id / shipping_tpl_id / is_free / is_default /
//!   region_data / start_number / start_price / add_number / add_price /
//!   free_price / pricing_type
//!
//! shipping_type (8 列, 主键 shipping_type_id)
//!   shipping_type_id / shipping_type_name / shipping_default_id /
//!   shipping_type_desc / shipping_time_desc / is_support_cod /
//!   sort_order / shop_id
//! ```
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! ## 金额
//!
//! `shipping_tpl_info` 的 5 个数值列全部是 `decimal`：
//! `start_number` / `add_number` 是 `decimal(12,5)`，
//! `start_price` / `add_price` 是 `decimal(10,2)`，
//! `free_price` 是 `decimal(8,2)`。
//! 一律用 [`rust_decimal::Decimal`] 绑定与读取，**禁用 f64/f32**。
//!
//! ## shopId（多租户）
//!
//! Java 全程用 `HeaderUtils.getShopId()`（请求头）取店铺 ID，
//! 并把它作为**查询条件**与**写入值**。Rust 侧 JWT 尚未签发 `shop_id`，
//! 因此本切片的所有店铺维度查询都接受一个显式 `shop_id: Option<i32>` 参数：
//! `None` 表示「不过滤 / 不限制」（对应 Java `getShopId() == null` 的场景，
//! 例如平台账号），`Some(id)` 表示按该店铺过滤。
//! 待鉴权中间件补齐后由路由层从 JWT 填充，仓储层无需改动。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::{ShippingTpl, ShippingTplInfo, ShippingType};
use tigshop_core::models::logistics::shipping_tpl::{
    map_order_column, ShippingTplInfoRow, ShippingTplListQuery, KEY_COLUMN, NO, YES,
};
use tigshop_core::{Error, Result};

/// `shipping_tpl` 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合）。
///
/// 顺序与 `entities::ShippingTpl` 的字段声明顺序一致。
const TPL_SELECT: &str = "SELECT shipping_tpl_id, shipping_time, shipping_tpl_name, \
                          is_free, CAST(pricing_type AS SIGNED) AS pricing_type, is_default, shop_id FROM shipping_tpl";

/// `shipping_tpl_info` 固定 SELECT 列清单（顺序同 `entities::ShippingTplInfo`）。
const INFO_SELECT: &str = "SELECT id, shipping_type_id, shipping_tpl_id, is_free, is_default, \
                           region_data, start_number, start_price, add_number, add_price, \
                           free_price, pricing_type FROM shipping_tpl_info";

/// `shipping_type` 固定 SELECT 列清单（顺序同 `entities::ShippingType`）。
const TYPE_SELECT: &str = "SELECT shipping_type_id, shipping_type_name, shipping_default_id, \
                           shipping_type_desc, shipping_time_desc, is_support_cod, sort_order, \
                           shop_id FROM shipping_type";

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<Option<T>>`：
/// - 外层 `None`（调用方明确「不写该列」）与内层 `None`（值为 null）都**不写**
///   —— 对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`
/// - `Some(Some(v))` 才绑定参数
///
/// 用宏而非函数是为了避免 `sqlx::query_builder::Separated` 的多重生命周期
/// 参数在辅助函数签名里难以书写（与 admin_user / pc_cat_floor / area_code 同一思路）。
///
/// 注意：`macro_rules!` 必须**先定义后使用**（按文本顺序展开），故本宏置于
/// 导入区之后、`impl` 之前，不能挪到文件末尾。
macro_rules! push_assign {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(Some(v)) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind(v);
        }
    };
}

/// 运费模板域仓储（挂载于 `Repositories.shipping_tpl`）。
#[derive(Clone)]
pub struct ShippingTplRepository {
    pool: MySqlPool,
}

impl ShippingTplRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— shipping_tpl：查询 —————————————————————

    /// 运费模板分页（对应 Java `ShippingTplServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `shopId != null` 时 `AND shop_id = ?`
    /// - `keyword` 非空时 `AND shipping_tpl_name LIKE %keyword%`
    /// - ORDER BY 由 [`ShippingTplListQuery::order_clause`] 生成
    ///
    /// ⚠️ Java `list` **完全不使用** `listDTO.getIsShow()`（且表无该列）。
    ///
    /// ⚠️ **本方法不对应本切片的 8 条路由**（清单里没有 `/list`），
    /// 保留给后续切片 / 主会话复用。
    pub async fn paginate_tpl(
        &self,
        q: &ShippingTplListQuery,
        shop_id: Option<i32>,
    ) -> Result<(u64, Vec<ShippingTpl>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM shipping_tpl WHERE 1 = 1");
        Self::push_tpl_filters(&mut count_qb, q, shop_id);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{TPL_SELECT} WHERE 1 = 1"));
        Self::push_tpl_filters(&mut row_qb, q, shop_id);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::logistics::shipping_tpl::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<ShippingTpl> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_tpl_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &ShippingTplListQuery,
        shop_id: Option<i32>,
    ) {
        if let Some(shop_id) = shop_id {
            qb.push(" AND shop_id = ");
            qb.push_bind(shop_id);
        }
        if let Some(kw) = q.effective_keyword() {
            qb.push(" AND shipping_tpl_name LIKE ");
            qb.push_bind(format!("%{kw}%"));
        }
    }

    /// 按主键查询运费模板（对应 Java `getById`）。
    pub async fn find_tpl_by_id(&self, id: i32) -> Result<Option<ShippingTpl>> {
        sqlx::query_as::<_, ShippingTpl>(&format!("{TPL_SELECT} WHERE shipping_tpl_id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 查询某店铺的全部运费模板（对应 Java `getShippingTplListByShopId`；
    /// 本切片未直接使用，供后续切片复用）。
    pub async fn find_tpls_by_shop(&self, shop_id: i32) -> Result<Vec<ShippingTpl>> {
        sqlx::query_as::<_, ShippingTpl>(&format!(
            "{TPL_SELECT} WHERE shop_id = ? ORDER BY shipping_tpl_id DESC"
        ))
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 统计同店铺下同名模板数量（对应 Java `create` 的查重：
    /// `eq(shopId, shopId).eq(shippingTplName, name).count()`）。
    ///
    /// ⚠️ Java 用的是 `eq(shopId, shopId)`，`shopId` 为 `null` 时
    /// MyBatis-Plus 的 `eq` **仍然会拼出 `shop_id = null`**
    /// （即恒不匹配 `NULL` 列比较），本实现用 `(? IS NULL AND shop_id IS NULL)`
    /// 表达同一个「平台账号」语义，行为等价且更直观。
    ///
    /// `exclude_id` 用于 `update` 排除自身（Java `.ne(shippingTplId, id)`）。
    pub async fn count_tpl_by_name(
        &self,
        name: &str,
        shop_id: Option<i32>,
        exclude_id: Option<i32>,
    ) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM shipping_tpl
             WHERE shipping_tpl_name = ?
               AND ((? IS NULL AND shop_id IS NULL) OR shop_id = ?)
               AND (? IS NULL OR shipping_tpl_id <> ?)",
        )
        .bind(name)
        .bind(shop_id)
        .bind(shop_id)
        .bind(exclude_id)
        .bind(exclude_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 查询某店铺当前的默认运费模板主键
    /// （对应 Java `getDefaultShippingTplId`：
    /// `eq(shopId).eq(isDefault, 1).last("limit 1")`）。
    ///
    /// 本切片未直接使用，供后续切片（下单/运费计算）复用。
    pub async fn find_default_tpl_id(&self, shop_id: i32) -> Result<Option<i32>> {
        let row: Option<(i32,)> = sqlx::query_as(
            "SELECT shipping_tpl_id FROM shipping_tpl
             WHERE shop_id = ? AND is_default = ? LIMIT 1",
        )
        .bind(shop_id)
        .bind(YES)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|r| r.0))
    }

    // ————————————————————— shipping_tpl：写入 —————————————————————

    /// 新增运费模板，返回自增主键（对应 Java `save`）。
    ///
    /// 7 个业务列全部显式写入
    /// （Java `ShippingTplSaveParam#createShippingTpl` 构造实体时 6 个字段
    /// 全部有值，`shop_id` 来自请求头）。
    pub async fn insert_tpl(&self, v: &ShippingTplInsert) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO shipping_tpl
                (shipping_time, shipping_tpl_name, is_free, pricing_type, is_default, shop_id)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&v.shipping_time)
        .bind(&v.shipping_tpl_name)
        .bind(v.is_free)
        .bind(v.pricing_type)
        .bind(v.is_default)
        .bind(v.shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ Java `update` 里 `BeanUtils.copyProperties(updateDTO, shippingTpl)`
    /// 把 `ShippingTplUpdateDTO` 的同名字段拷进实体，因此为 `null` 的字段
    /// **不参与 `SET`**（原值保持）。这正是 [`ShippingTplPatch`] 的三态语义。
    ///
    /// ⚠️ 关键差异（已核对 mybatis-plus 3.5 的 `NOT_NULL` 策略）：
    /// Java 只跳过 `null`，**空串 `""` 与 `0` 都会照常写入**。
    /// 因此本补丁不能用「值为空就跳过」的简化写法，必须由调用方显式构造
    /// `Some(Some(""))` / `Some(Some(0))`。
    pub async fn update_tpl(&self, id: i32, patch: &ShippingTplPatch) -> Result<u64> {
        if patch.is_empty() {
            // 对应 Java `updateById` 在「全 null 实体」时的行为：
            // MyBatis-Plus 会生成 `UPDATE ... SET ` 空片段并报错，
            // 本实现直接返回 0 行（不产生非法 SQL）。
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE shipping_tpl SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "shipping_time", patch.shipping_time);
        push_assign!(sep, "shipping_tpl_name", patch.shipping_tpl_name);
        push_assign!(sep, "is_free", patch.is_free);
        push_assign!(sep, "pricing_type", patch.pricing_type);
        push_assign!(sep, "is_default", patch.is_default);
        push_assign!(sep, "shop_id", patch.shop_id);
        drop(sep);
        qb.push(" WHERE shipping_tpl_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自
    /// [`tigshop_core::models::logistics::shipping_tpl::SHIPPING_TPL_COLUMNS`] 的白名单映射
    /// （服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_tpl_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::logistics::shipping_tpl::SHIPPING_TPL_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE shipping_tpl SET {column} = ? WHERE shipping_tpl_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 把某店铺（或全平台）的默认标记全部清 0
    /// （对应 Java `create` / `update` / `setDefault` 里的
    /// `lambdaUpdate().eq(shopId, shopId).set(isDefault, 0).update()`）。
    ///
    /// `shop_id = None` 表示不限店铺（Java `getShopId()` 为 `null` 时
    /// `eq` 仍会拼 `shop_id = null`，但那种情况下列比较恒不成立，
    /// 本实现选择「清全部」以便 `setDefault` 在平台账号下仍可用；
    /// 见 `uncertain_points`）。
    ///
    /// ⚠️ **不排除任何记录** —— 这正是 Java 的写法（`setDefault` 先清全部、
    /// 再单独把目标置 1，两步合起来净结果正确）。调用方负责第二步。
    pub async fn clear_default_flag(&self, shop_id: Option<i32>) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE shipping_tpl SET is_default = ");
        qb.push_bind(NO);
        qb.push(" WHERE is_default = ");
        qb.push_bind(YES);
        if let Some(shop_id) = shop_id {
            qb.push(" AND shop_id = ");
            qb.push_bind(shop_id);
        }
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 把指定模板置为默认（对应 Java `setDefault` 的第二步
    /// `lambdaUpdate().eq(shippingTplId, id).set(isDefault, 1).update()`）。
    pub async fn mark_default(&self, id: i32) -> Result<u64> {
        let res = sqlx::query("UPDATE shipping_tpl SET is_default = ? WHERE shipping_tpl_id = ?")
            .bind(YES)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `del` → `removeById`）。
    ///
    /// `shipping_tpl` 表**没有**软删标记列，因此就是 `DELETE`。
    ///
    /// ⚠️ Java `del` 只删 `shipping_tpl` 本身，**不删** `shipping_tpl_info`
    /// 子表记录（无级联、无事务内的显式子表清理），会留下孤儿行。
    /// 本实现逐字复刻该行为（见 `uncertain_points`）。
    pub async fn delete_tpl(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM shipping_tpl WHERE shipping_tpl_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量硬删除（对应 Java `BaseServiceImpl#batch` → `removeByIds`）。
    ///
    /// 返回**实际删除的行数**；Java 的 `removeByIds` 返回
    /// `SqlHelper.retBool(rows)`（`rows >= 1`），调用方据此折算布尔值。
    pub async fn delete_tpl_many(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM shipping_tpl WHERE shipping_tpl_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    // ————————————————————— shipping_tpl_info —————————————————————

    /// 查询某运费模板下的全部内容行
    /// （对应 Java `ShippingTplInfoServiceImpl#getShippingTplInfoByShippingTplId`
    /// 与 `detail` 里的 `eq(shippingTplId, id).list()`）。
    ///
    /// ⚠️ Java **未指定 ORDER BY**，返回顺序由 MySQL 决定（通常是主键序）。
    /// 本实现按 `id ASC` 稳定排序，便于前端展示与测试；
    /// 这是一处**有意偏离**（Java 无保证 → Rust 有保证），已列入
    /// `uncertain_points`。
    pub async fn find_infos_by_tpl(&self, tpl_id: i32) -> Result<Vec<ShippingTplInfo>> {
        sqlx::query_as::<_, ShippingTplInfo>(&format!(
            "{INFO_SELECT} WHERE shipping_tpl_id = ? ORDER BY id ASC"
        ))
        .bind(tpl_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 删除某运费模板下的全部内容行
    /// （对应 Java `ShippingTplInfoServiceImpl#updateShippingTplInfo` 的第一句
    /// `lambdaUpdate().eq(shippingTplId, ...).remove()`）。
    pub async fn delete_infos_by_tpl(&self, tpl_id: i32) -> Result<u64> {
        let res = sqlx::query("DELETE FROM shipping_tpl_info WHERE shipping_tpl_id = ?")
            .bind(tpl_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量插入内容行（对应 Java `saveBatch(shippingTplInfos)`）。
    ///
    /// 11 个业务列全部显式写入（`ShippingTplInfoRow` 的字段全部来自
    /// `ShippingTypeParam#createDefaultShippingTplInfo` /
    /// `#createAreaShippingTplInfos` 的 `builder()`，Java 侧无 null 字段）。
    ///
    /// 返回插入行数。`rows` 为空时**不产生 SQL**（对应 Java
    /// `saveBatch(空集合)` 直接返回 `true`）。
    pub async fn insert_infos(&self, rows: &[ShippingTplInfoRow]) -> Result<u64> {
        if rows.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "INSERT INTO shipping_tpl_info
                (shipping_type_id, shipping_tpl_id, is_free, is_default, region_data,
                 start_number, start_price, add_number, add_price, free_price, pricing_type) ",
        );
        qb.push_values(rows, |mut b, r| {
            b.push_bind(r.shipping_type_id)
                .push_bind(r.shipping_tpl_id)
                .push_bind(r.is_free)
                .push_bind(r.is_default)
                .push_bind(r.region_data.clone())
                .push_bind(r.start_number)
                .push_bind(r.start_price)
                .push_bind(r.add_number)
                .push_bind(r.add_price)
                .push_bind(r.free_price)
                .push_bind(r.pricing_type);
        });
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    // ————————————————————— shipping_type —————————————————————

    /// 按主键查询配送类型（本切片 `config` 链路使用；
    /// Java `ShippingTypeServiceImpl#getShippingTypeListByShopId` 实为硬编码桩）。
    pub async fn find_type_by_id(&self, id: i32) -> Result<Option<ShippingType>> {
        sqlx::query_as::<_, ShippingType>(&format!(
            "{TYPE_SELECT} WHERE shipping_type_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 查询某店铺的全部配送类型（按 `sort_order ASC, shipping_type_id ASC`）。
    ///
    /// ⚠️ 本方法不对应本切片任何路由：Java
    /// `ShippingTypeServiceImpl#getShippingTypeListByShopId` **根本不查库**，
    /// 而是硬编码 `new ShippingType(1L)`。见服务层 `config` 的处理。
    pub async fn find_types_by_shop(&self, shop_id: i32) -> Result<Vec<ShippingType>> {
        sqlx::query_as::<_, ShippingType>(&format!(
            "{TYPE_SELECT} WHERE shop_id = ? ORDER BY sort_order ASC, shipping_type_id ASC"
        ))
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }
}

/// 新增运费模板时待写入的字段（对应 Java `ShippingTplSaveParam` 的 6 个属性）。
#[derive(Debug, Clone, Default)]
pub struct ShippingTplInsert {
    /// `shipping_time`（发货时间；Java 侧可为空串）
    pub shipping_time: String,
    /// `shipping_tpl_name`（服务层已校验非空）
    pub shipping_tpl_name: String,
    /// `is_free`
    pub is_free: i32,
    /// `pricing_type`
    pub pricing_type: i32,
    /// `is_default`
    pub is_default: i32,
    /// `shop_id`（Java 来自 `HeaderUtils.getShopId()`）
    pub shop_id: i32,
}

/// `update` 的部分更新补丁
/// （对应 MyBatis-Plus `updateById` 的 `FieldStrategy.NOT_NULL`：
/// **只写非 null 字段**）。
///
/// 每个字段的三种状态：
/// - `None`：调用方明确该列不参与 `SET`（等价 Java 实体字段为 `null`）
/// - `Some(None)`：值显式为 null ⇒ 同样**不写该列**
/// - `Some(Some(v))`：写该列
///
/// ⚠️ 见 [`ShippingTplRepository::update_tpl`] 的说明：空串与 `0` 都要写。
#[derive(Debug, Clone, Default)]
pub struct ShippingTplPatch {
    /// `shipping_time`
    pub shipping_time: Option<Option<String>>,
    /// `shipping_tpl_name`
    pub shipping_tpl_name: Option<Option<String>>,
    /// `is_free`
    pub is_free: Option<Option<i32>>,
    /// `pricing_type`
    pub pricing_type: Option<Option<i32>>,
    /// `is_default`
    pub is_default: Option<Option<i32>>,
    /// `shop_id`
    pub shop_id: Option<Option<i32>>,
}

impl ShippingTplPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.shipping_time, Some(Some(_)))
            && !matches!(self.shipping_tpl_name, Some(Some(_)))
            && !matches!(self.is_free, Some(Some(_)))
            && !matches!(self.pricing_type, Some(Some(_)))
            && !matches!(self.is_default, Some(Some(_)))
            && !matches!(self.shop_id, Some(Some(_)))
    }
}

/// 排序字段 → 列名（转发到 `models::shipping_tpl`，便于仓储层单测）。
#[must_use]
pub fn order_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// 主键列名（避免调用方硬编码字符串）。
pub const KEY: &str = KEY_COLUMN;

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("运费模板不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = ShippingTplPatch {
            shipping_tpl_name: Some(Some(String::new())),
            is_default: Some(Some(0)),
            ..ShippingTplPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = ShippingTplPatch {
            shipping_tpl_name: None,
            shipping_time: Some(None),
            ..ShippingTplPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 全 `None` 的补丁 `is_empty()` 为真（`update_tpl` 因此不产生 SQL）。
    #[test]
    fn default_patch_is_empty() {
        assert!(ShippingTplPatch::default().is_empty());
    }

    /// `is_free = Some(Some(0))` 必须算「会写」，不能被当成空补丁。
    #[test]
    fn zero_is_default_is_a_real_write() {
        let patch = ShippingTplPatch {
            is_free: Some(Some(0)),
            ..ShippingTplPatch::default()
        };
        assert!(!patch.is_empty(), "0 是合法值，必须写入");
    }

    /// `ShippingTplInsert` 默认值（防误用为空模板名）。
    #[test]
    fn insert_default_is_all_zero_empty() {
        let v = ShippingTplInsert::default();
        assert!(v.shipping_tpl_name.is_empty());
        assert_eq!(v.is_free, 0);
        assert_eq!(v.shop_id, 0);
    }

    /// 仓储层转发的列映射与 models 一致。
    #[test]
    fn order_column_forwards_to_models() {
        assert_eq!(order_column("shippingTplName"), "shipping_tpl_name");
        assert_eq!(order_column("nope"), KEY);
        assert_eq!(KEY, "shipping_tpl_id");
    }
}