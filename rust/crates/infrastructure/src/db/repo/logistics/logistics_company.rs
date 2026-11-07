//! 配送方式配置信息域（logistics::logistics_company）仓储：`logistics_company`
//! （依赖只读引用：`logistics_company_config`、`config`）。
//!
//! 对应原 Java `com.tigshop.mapper.setting.LogisticsCompanyMapper`
//! （`BaseMapper<LogisticsCompany>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table logistics_company`）：
//!
//! `logistics_company`（25 列，主键 `logistics_id`）：
//! `logistics_id` / `logistics_code` / `logistics_name` / `logistics_desc` /
//! `sort_order` / `is_show` / `shop_id` / `customer_name` / `customer_pwd` /
//! `month_code` / `send_site` / `send_staff` / `exp_type` / `api_logistics_code` /
//! `kuaidi100_code` / `kuaidi100_partner_id` / `kuaidi100_partner_key` /
//! `kuaidi100_partner_secret` / `kuaidi100_net` / `kuaidi100_check_man` /
//! `kuaidi100_exp_type` / `kuaidi100_temp_id` / `kuaidi100_child_temp_id` /
//! `kuaidi100_back_temp_id` / `is_enabled`
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::LogisticsCompany;
use tigshop_core::models::logistics::logistics_company::LogisticsCompanyListQuery;
use tigshop_core::{Error, Result};

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
            $sep.push_bind_unseparated(v);
        }
    };
}

/// 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合；
/// 与 `entities::LogisticsCompany` 的 25 个字段一一对应，顺序也一致）。
const LOGISTICS_COMPANY_SELECT: &str = "SELECT logistics_id, logistics_code, logistics_name, \
     logistics_desc, sort_order, is_show, shop_id, customer_name, customer_pwd, month_code, \
     send_site, send_staff, exp_type, api_logistics_code, kuaidi100_code, kuaidi100_partner_id, \
     kuaidi100_partner_key, kuaidi100_partner_secret, kuaidi100_net, kuaidi100_check_man, \
     kuaidi100_exp_type, kuaidi100_temp_id, kuaidi100_child_temp_id, kuaidi100_back_temp_id, \
     is_enabled FROM logistics_company";

/// 已由 `Kuaidi100CodeMapping` 受控映射到快递100 的快递鸟编码集合
/// （Java `applyMappedLogisticsCodeFilter` 的 `IN (...)` 参数）。
///
/// 在编译期固化为常量数组，避免每次查询重新构造。
const MAPPED_LOGISTICS_CODES: [&str; 20] = [
    "SF",
    "SF_EXPRESS",
    "YTO",
    "ZTO",
    "STO",
    "STO_EXPRESS",
    "YD",
    "YUNDA",
    "EMS",
    "YZPY",
    "HTKY",
    "JD",
    "DBL",
    "JTSD",
    "UC",
    "ZJS",
    "ANE",
    "HHTT",
    "KYSY",
    "CNSD",
];

#[derive(Clone)]
pub struct LogisticsCompanyRepository {
    pool: MySqlPool,
}

impl LogisticsCompanyRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 查询 —————————————————————

    /// 物流公司分页（对应 Java `LogisticsCompanyServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `shopId`：**仅当取值是合法 `IsShowType` 码（0/1）时**才
    ///   `shop_id = ?`（Java `IsShowType.fromTypeCode(shopId) != null`），
    ///   其它值静默忽略 —— 见 `models::tigshop_core::models::logistics::logistics_company::LogisticsCompanyListQuery::effective_shop_id`
    /// - `keyword`：`logistics_name LIKE %keyword%`
    /// - `isEnabled`：`is_enabled = ?`
    /// - `providerType`：[`Self::push_provider_filter`] 复刻 Java
    ///   `applyProviderFilter`
    ///
    /// ORDER BY：固定 `is_enabled DESC, logistics_id DESC`，
    /// 之后追加用户排序（由 [`LogisticsCompanyListQuery::order_clause`] 生成）。
    pub async fn paginate(&self, q: &LogisticsCompanyListQuery) -> Result<(u64, Vec<LogisticsCompany>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM logistics_company WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{LOGISTICS_COMPANY_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::logistics::logistics_company::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<LogisticsCompany> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &LogisticsCompanyListQuery) {
        if let Some(shop_id) = q.effective_shop_id() {
            qb.push(" AND shop_id = ");
            qb.push_bind(shop_id);
        }
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND logistics_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
        if let Some(is_enabled) = q.is_enabled {
            qb.push(" AND is_enabled = ");
            qb.push_bind(is_enabled);
        }
        Self::push_provider_filter(qb, q.provider_type);
    }

    /// 复刻 Java `LogisticsCompanyServiceImpl#applyProviderFilter`。
    ///
    /// ```text
    /// if (providerType == 1) {                       // 快递鸟
    ///     isNotNull(logistics_code).apply("TRIM(logistics_code) <> ''");
    /// } else if (providerType == 2) {                // 快递100
    ///     and(w -> {
    ///         w.isNotNull(kuaidi100_code).apply("TRIM(kuaidi100_code) <> ''").or();
    ///         applyMappedLogisticsCodeFilter(w);      // UPPER(TRIM(logistics_code)) IN (...)
    ///         w.or().apply("TRIM(logistics_code) COLLATE utf8mb4_bin REGEXP '^[a-z0-9]+$'");
    ///     });
    /// }
    /// ```
    ///
    /// 其它值（含 `null`）不过滤。
    ///
    /// ⚠️ 用 QueryBuilder 表达时括号语义必须显式写出：
    /// `providerType = 2` 整体是一组 `AND ( ... OR ... OR ... )`。
    fn push_provider_filter(qb: &mut QueryBuilder<'_, sqlx::MySql>, provider_type: Option<i32>) {
        match provider_type {
            Some(1) => {
                // Java `isNotNull` 对 NOT NULL 列是恒真条件，MySQL 侧仍会生成
                // `logistics_code IS NOT NULL`；此处保留以逐条对齐。
                qb.push(" AND (logistics_code IS NOT NULL AND TRIM(logistics_code) <> '')");
            }
            Some(2) => {
                qb.push(" AND ((");
                qb.push("kuaidi100_code IS NOT NULL AND TRIM(kuaidi100_code) <> ''");
                qb.push(") OR UPPER(TRIM(logistics_code)) IN (");
                let mut sep = qb.separated(", ");
                for code in MAPPED_LOGISTICS_CODES {
                    sep.push_bind(code);
                }
                sep.push_unseparated(")");
                drop(sep);
                // Java 结尾的 `.or().apply(REGEXP ...)`，用 `COLLATE utf8mb4_bin`
                // 保证大小写敏感匹配（与 Java 原文逐字符一致）。
                qb.push(
                    " OR TRIM(logistics_code) COLLATE utf8mb4_bin REGEXP '^[a-z0-9]+$')",
                );
            }
            _ => {}
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<LogisticsCompany>> {
        sqlx::query_as::<_, LogisticsCompany>(&format!(
            "{LOGISTICS_COMPANY_SELECT} WHERE logistics_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 当前租户已绑定的物流公司 ID 集合
    /// （对应 Java `list` 里对 `logistics_company_config` 的查询）。
    ///
    /// ```text
    /// logisticsCompanyConfigService.lambdaQuery()
    ///     .eq(LogisticsCompanyConfig::getShopId, realShopId)
    ///     .eq(LogisticsCompanyConfig::getVendorId, realVendorId)
    ///     .list().stream().map(getLogisticsId).collect(toSet())
    /// ```
    ///
    /// `realShopId` / `realVendorId` 由服务层按「null 归 0」计算
    /// （Java `int realShopId = currentShopId != null ? currentShopId : 0`）。
    pub async fn find_bound_logistics_ids(
        &self,
        shop_id: i32,
        vendor_id: i32,
    ) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT logistics_id FROM logistics_company_config
             WHERE shop_id = ? AND vendor_id = ?",
        )
        .bind(shop_id)
        .bind(vendor_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 读取系统配置值（对应 Java `ConfigService#getConfigVal(SettingsEnum)`）。
    ///
    /// 表 `config`（`biz_code` / `biz_val`）。Java 侧 `getConfigVal` 会带
    /// 缓存与默认值回退；本实现直查一行，取不到时由调用方走默认值
    /// （见 `models::tigshop_core::models::logistics::logistics_company::resolve_provider_type`）。
    ///
    /// ⚠️ `config` 表另有 `is_del` 列（软删标记），这里按 Java 的
    /// `getConfigVal` 语义**不过滤** `is_del`（该方法的实现未在本次迁移范围，
    /// 见 `uncertain_points`）；若线上语义要求过滤，需主会话确认。
    pub async fn find_config_val(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT biz_val FROM config WHERE biz_code = ? LIMIT 1")
                .bind(biz_code)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.and_then(|(v,)| v))
    }

    /// 按 `shop_id` 查询全部物流公司（对应 Java `syncKdn*` 里的
    /// `this.list(new LambdaQueryWrapper<LogisticsCompany>().eq(shopId, shopId))`）。
    ///
    /// ⚠️ Java 的 `shopId` 来自 `getShopId()`（可能为 `null`）。
    /// MyBatis-Plus 的 `eq(column, null)` 会生成 `shop_id = null`
    /// （永不命中），因此 `shopId == null` 时结果为空列表。
    /// 本实现用 [`Option<i32>`] 表达：`None` ⇒ 直接返回空列表且不发 SQL。
    pub async fn find_by_shop_id(&self, shop_id: Option<i32>) -> Result<Vec<LogisticsCompany>> {
        let Some(shop_id) = shop_id else {
            return Ok(Vec::new());
        };
        sqlx::query_as::<_, LogisticsCompany>(&format!(
            "{LOGISTICS_COMPANY_SELECT} WHERE shop_id = ? ORDER BY logistics_id ASC"
        ))
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增物流公司，返回自增主键（对应 Java `save` / `saveBatch`）。
    ///
    /// ⚠️ 实体 25 列里 **13 列是 `NOT NULL` 且无显式 DEFAULT**
    /// （`logistics_code` / `logistics_name` / `logistics_desc` /
    /// `sort_order` / `is_show` / `shop_id` / `kuaidi100_code` /
    /// 5 个 `kuaidi100_*` 面单列 / `is_enabled`）。
    ///
    /// MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 只跳过 **Java 对象里为
    /// `null`** 的字段，而 Java 的 `LogisticsCompany` 实体这些字段是
    /// **原始类型 `Integer` / `String`**：`String` 缺省为 `null`（跳过，
    /// 但列 NOT NULL ⇒ **MySQL 报错**）、`Integer` 缺省为 `null`（同样跳过）。
    /// 也就是说 Java 的 `create` 在业务字段不全时会直接插入失败。
    ///
    /// 本实现保持同一行为：`None` 即不写该列，由 MySQL 施加约束/默认值，
    /// **不替调用方补默认值**（补了就是编造业务规则）。
    pub async fn insert(&self, v: &LogisticsCompanyInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(25);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(25);

        macro_rules! push_opt_text {
            ($col:literal, $val:expr) => {
                if let Some(v) = $val.as_deref() {
                    columns.push($col);
                    binds.push(InsertValue::Text(v));
                }
            };
        }
        macro_rules! push_opt_int {
            ($col:literal, $val:expr) => {
                if let Some(v) = $val {
                    columns.push($col);
                    binds.push(InsertValue::Int(v));
                }
            };
        }

        push_opt_text!("logistics_code", v.logistics_code);
        push_opt_text!("logistics_name", v.logistics_name);
        push_opt_text!("logistics_desc", v.logistics_desc);
        push_opt_int!("sort_order", v.sort_order);
        push_opt_int!("is_show", v.is_show);
        push_opt_int!("shop_id", v.shop_id);
        push_opt_text!("customer_name", v.customer_name);
        push_opt_text!("customer_pwd", v.customer_pwd);
        push_opt_text!("month_code", v.month_code);
        push_opt_text!("send_site", v.send_site);
        push_opt_text!("send_staff", v.send_staff);
        push_opt_text!("exp_type", v.exp_type);
        push_opt_text!("api_logistics_code", v.api_logistics_code);
        push_opt_text!("kuaidi100_code", v.kuaidi100_code);
        push_opt_text!("kuaidi100_partner_id", v.kuaidi100_partner_id);
        push_opt_text!("kuaidi100_partner_key", v.kuaidi100_partner_key);
        push_opt_text!("kuaidi100_partner_secret", v.kuaidi100_partner_secret);
        push_opt_text!("kuaidi100_net", v.kuaidi100_net);
        push_opt_text!("kuaidi100_check_man", v.kuaidi100_check_man);
        push_opt_text!("kuaidi100_exp_type", v.kuaidi100_exp_type);
        push_opt_text!("kuaidi100_temp_id", v.kuaidi100_temp_id);
        push_opt_text!("kuaidi100_child_temp_id", v.kuaidi100_child_temp_id);
        push_opt_text!("kuaidi100_back_temp_id", v.kuaidi100_back_temp_id);
        push_opt_int!("is_enabled", v.is_enabled);

        // 防御：没有任何列可写时不发 SQL（否则会生成非法 INSERT）
        if columns.is_empty() {
            return Err(Error::Validation("没有可写入的字段".into()));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO logistics_company ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for b in &binds {
            query = match b {
                InsertValue::Text(t) => query.bind(*t),
                InsertValue::Int(i) => query.bind(*i),
            };
        }
        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ 关键差异（已核对 mybatis-plus 3.5 的 `NOT_NULL` 策略）：
    /// Java 只跳过 `null`，**空串 `""` 与 `0` 都会照常写入**。
    /// 因此本补丁不能用「值为空就跳过」的简化写法，必须由调用方显式构造
    /// `Some(Some(""))` / `Some(Some(0))`。
    ///
    /// 返回受影响行数（Java `updateById` 返回 `rows >= 1`）。
    pub async fn update(&self, id: i32, patch: &LogisticsCompanyPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE logistics_company SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "logistics_code", patch.logistics_code);
        push_assign!(sep, "logistics_name", patch.logistics_name);
        push_assign!(sep, "logistics_desc", patch.logistics_desc);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "is_show", patch.is_show);
        push_assign!(sep, "customer_name", patch.customer_name);
        push_assign!(sep, "customer_pwd", patch.customer_pwd);
        push_assign!(sep, "month_code", patch.month_code);
        push_assign!(sep, "send_site", patch.send_site);
        push_assign!(sep, "send_staff", patch.send_staff);
        push_assign!(sep, "exp_type", patch.exp_type);
        push_assign!(sep, "api_logistics_code", patch.api_logistics_code);
        push_assign!(sep, "kuaidi100_code", patch.kuaidi100_code);
        push_assign!(sep, "kuaidi100_partner_id", patch.kuaidi100_partner_id);
        push_assign!(sep, "kuaidi100_partner_key", patch.kuaidi100_partner_key);
        push_assign!(
            sep,
            "kuaidi100_partner_secret",
            patch.kuaidi100_partner_secret
        );
        push_assign!(sep, "kuaidi100_net", patch.kuaidi100_net);
        push_assign!(sep, "kuaidi100_check_man", patch.kuaidi100_check_man);
        push_assign!(sep, "kuaidi100_exp_type", patch.kuaidi100_exp_type);
        push_assign!(sep, "kuaidi100_temp_id", patch.kuaidi100_temp_id);
        push_assign!(sep, "kuaidi100_child_temp_id", patch.kuaidi100_child_temp_id);
        push_assign!(sep, "kuaidi100_back_temp_id", patch.kuaidi100_back_temp_id);
        push_assign!(sep, "is_enabled", patch.is_enabled);
        drop(sep);
        qb.push(" WHERE logistics_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量更新「名称」字段（对应 Java `updateBatchById(updateBatch)`，
    /// 每条只 set `logistics_name`）。
    ///
    /// 使用 `CASE WHEN logistics_id = ? THEN ? ... END` 单条语句完成，
    /// 避免 N 次往返；`ids` 与 `names` 必须一一对应且等长。
    pub async fn batch_update_name(&self, pairs: &[(i32, String)]) -> Result<u64> {
        if pairs.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE logistics_company SET logistics_name = CASE logistics_id ");
        for (id, name) in pairs {
            qb.push(" WHEN ");
            qb.push_bind(*id);
            qb.push(" THEN ");
            qb.push_bind(name.as_str());
        }
        qb.push(" ELSE logistics_name END WHERE logistics_id IN (");
        let mut sep = qb.separated(", ");
        for (id, _) in pairs {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量更新「快递100 编码（可选）+ 名称（可选）」
    /// （对应 Java `syncKuaidi100` 的 `updateBatchById`，
    /// 每条可能只 set `kuaidi100Code`、只 set `logisticsName`、或两者都 set）。
    ///
    /// 用两条 `CASE` 分别表达，`set_name = false` 的条目不会出现在
    /// `logistics_name` 的 CASE 里（保持原值）。
    pub async fn batch_update_kuaidi100_and_name(
        &self,
        rows: &[Kuaidi100Update],
    ) -> Result<u64> {
        if rows.is_empty() {
            return Ok(0);
        }
        let id_list = || {
            let mut ids = Vec::with_capacity(rows.len());
            for r in rows {
                ids.push(r.logistics_id);
            }
            ids
        };

        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE logistics_company SET ");

        // kuaidi100_code：所有条目都 set（Java 里的 toUpdate 必定 set 该列）
        qb.push("kuaidi100_code = CASE logistics_id ");
        for r in rows {
            qb.push(" WHEN ");
            qb.push_bind(r.logistics_id);
            qb.push(" THEN ");
            qb.push_bind(r.kuaidi100_code.as_str());
        }
        qb.push(" ELSE kuaidi100_code END");

        // logistics_name：只有显式要求改名的条目才进 CASE
        let name_rows: Vec<&Kuaidi100Update> =
            rows.iter().filter(|r| r.new_name.is_some()).collect();
        if !name_rows.is_empty() {
            qb.push(", logistics_name = CASE logistics_id ");
            for r in &name_rows {
                if let Some(name) = r.new_name.as_deref() {
                    qb.push(" WHEN ");
                    qb.push_bind(r.logistics_id);
                    qb.push(" THEN ");
                    qb.push_bind(name);
                }
            }
            qb.push(" ELSE logistics_name END");
        }

        qb.push(" WHERE logistics_id IN (");
        let mut sep = qb.separated(", ");
        for id in id_list() {
            sep.push_bind(id);
        }
        sep.push_unseparated(")");
        drop(sep);

        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自
    /// [`tigshop_core::models::logistics::logistics_company::LOGISTICS_COMPANY_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::logistics::logistics_company::LOGISTICS_COMPANY_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE logistics_company SET {column} = ? WHERE logistics_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `del` → `removeById`）。
    ///
    /// ⚠️ `LogisticsCompany` 实体**没有** `@TableLogic` 注解，
    /// 因此 MyBatis-Plus 的 `removeById` 是**物理 DELETE**（不是软删）。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM logistics_company WHERE logistics_id = ?")
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
    pub async fn delete_many(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM logistics_company WHERE logistics_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }
}

/// 新增时待写入的物流公司（`None` = 不写该列 ⇒ 走 MySQL 列默认值 / 约束）。
///
/// 与 Java `LogisticsCompany` 实体的可写字段一一对应（主键除外）。
/// 派生 `PartialEq` / `Eq` 以便服务层对同步计划（`KdnSyncPlan` / `Kuaidi100SyncPlan`）
/// 做整体断言。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LogisticsCompanyInsert {
    /// `logistics_code`（NOT NULL，无显式 DEFAULT）
    pub logistics_code: Option<String>,
    /// `logistics_name`（NOT NULL，无显式 DEFAULT）
    pub logistics_name: Option<String>,
    /// `logistics_desc`（NOT NULL，无显式 DEFAULT）
    pub logistics_desc: Option<String>,
    /// `sort_order`（NOT NULL，无显式 DEFAULT）
    pub sort_order: Option<i32>,
    /// `is_show`（NOT NULL，无显式 DEFAULT）
    pub is_show: Option<i32>,
    /// `shop_id`（NOT NULL，无显式 DEFAULT）
    pub shop_id: Option<i32>,
    /// `customer_name`
    pub customer_name: Option<String>,
    /// `customer_pwd`
    pub customer_pwd: Option<String>,
    /// `month_code`
    pub month_code: Option<String>,
    /// `send_site`
    pub send_site: Option<String>,
    /// `send_staff`
    pub send_staff: Option<String>,
    /// `exp_type`
    pub exp_type: Option<String>,
    /// `api_logistics_code`
    pub api_logistics_code: Option<String>,
    /// `kuaidi100_code`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_code: Option<String>,
    /// `kuaidi100_partner_id`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_partner_id: Option<String>,
    /// `kuaidi100_partner_key`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_partner_key: Option<String>,
    /// `kuaidi100_partner_secret`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_partner_secret: Option<String>,
    /// `kuaidi100_net`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_net: Option<String>,
    /// `kuaidi100_check_man`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_check_man: Option<String>,
    /// `kuaidi100_exp_type`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_exp_type: Option<String>,
    /// `kuaidi100_temp_id`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_temp_id: Option<String>,
    /// `kuaidi100_child_temp_id`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_child_temp_id: Option<String>,
    /// `kuaidi100_back_temp_id`（NOT NULL，无显式 DEFAULT）
    pub kuaidi100_back_temp_id: Option<String>,
    /// `is_enabled`（NOT NULL，无显式 DEFAULT）
    pub is_enabled: Option<i32>,
}

/// INSERT 的绑定值（避免为文本列与整型列定义平行 `Vec`）。
#[derive(Debug, Clone, Copy)]
enum InsertValue<'a> {
    /// 文本列
    Text(&'a str),
    /// 整型列
    Int(i32),
}

/// `update` 的部分更新补丁（对应 MyBatis-Plus `updateById` 的
/// `FieldStrategy.NOT_NULL`：**只写非 null 字段**）。
///
/// 每个字段的三种状态：
/// - `None`：调用方明确该列不参与 `SET`（等价 Java 实体字段为 `null`）
/// - `Some(None)`：值显式为 null ⇒ 同样**不写该列**
/// - `Some(Some(v))`：写该列
///
/// ⚠️ Java 只跳过 `null`，**空串 `""` 与 `0` 都会照常写入**。
/// 因此本补丁不能用「值为空就跳过」的简化写法，必须由调用方显式构造
/// `Some(Some(""))` / `Some(Some(0))`。
#[derive(Debug, Clone, Default)]
pub struct LogisticsCompanyPatch {
    /// `logistics_code`
    pub logistics_code: Option<Option<String>>,
    /// `logistics_name`
    pub logistics_name: Option<Option<String>>,
    /// `logistics_desc`
    pub logistics_desc: Option<Option<String>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `is_show`
    pub is_show: Option<Option<i32>>,
    /// `customer_name`
    pub customer_name: Option<Option<String>>,
    /// `customer_pwd`
    pub customer_pwd: Option<Option<String>>,
    /// `month_code`
    pub month_code: Option<Option<String>>,
    /// `send_site`
    pub send_site: Option<Option<String>>,
    /// `send_staff`
    pub send_staff: Option<Option<String>>,
    /// `exp_type`
    pub exp_type: Option<Option<String>>,
    /// `api_logistics_code`
    pub api_logistics_code: Option<Option<String>>,
    /// `kuaidi100_code`
    pub kuaidi100_code: Option<Option<String>>,
    /// `kuaidi100_partner_id`
    pub kuaidi100_partner_id: Option<Option<String>>,
    /// `kuaidi100_partner_key`
    pub kuaidi100_partner_key: Option<Option<String>>,
    /// `kuaidi100_partner_secret`
    pub kuaidi100_partner_secret: Option<Option<String>>,
    /// `kuaidi100_net`
    pub kuaidi100_net: Option<Option<String>>,
    /// `kuaidi100_check_man`
    pub kuaidi100_check_man: Option<Option<String>>,
    /// `kuaidi100_exp_type`
    pub kuaidi100_exp_type: Option<Option<String>>,
    /// `kuaidi100_temp_id`
    pub kuaidi100_temp_id: Option<Option<String>>,
    /// `kuaidi100_child_temp_id`
    pub kuaidi100_child_temp_id: Option<Option<String>>,
    /// `kuaidi100_back_temp_id`
    pub kuaidi100_back_temp_id: Option<Option<String>>,
    /// `is_enabled`
    pub is_enabled: Option<Option<i32>>,
}

impl LogisticsCompanyPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.logistics_code, Some(Some(_)))
            && !matches!(self.logistics_name, Some(Some(_)))
            && !matches!(self.logistics_desc, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.is_show, Some(Some(_)))
            && !matches!(self.customer_name, Some(Some(_)))
            && !matches!(self.customer_pwd, Some(Some(_)))
            && !matches!(self.month_code, Some(Some(_)))
            && !matches!(self.send_site, Some(Some(_)))
            && !matches!(self.send_staff, Some(Some(_)))
            && !matches!(self.exp_type, Some(Some(_)))
            && !matches!(self.api_logistics_code, Some(Some(_)))
            && !matches!(self.kuaidi100_code, Some(Some(_)))
            && !matches!(self.kuaidi100_partner_id, Some(Some(_)))
            && !matches!(self.kuaidi100_partner_key, Some(Some(_)))
            && !matches!(self.kuaidi100_partner_secret, Some(Some(_)))
            && !matches!(self.kuaidi100_net, Some(Some(_)))
            && !matches!(self.kuaidi100_check_man, Some(Some(_)))
            && !matches!(self.kuaidi100_exp_type, Some(Some(_)))
            && !matches!(self.kuaidi100_temp_id, Some(Some(_)))
            && !matches!(self.kuaidi100_child_temp_id, Some(Some(_)))
            && !matches!(self.kuaidi100_back_temp_id, Some(Some(_)))
            && !matches!(self.is_enabled, Some(Some(_)))
    }
}

/// 快递100 同步时的一条更新（对应 Java `syncKuaidi100` 的 `toUpdate`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kuaidi100Update {
    /// 主键
    pub logistics_id: i32,
    /// 要写入的快递100 编码（Java 里必定 set）
    pub kuaidi100_code: String,
    /// 要写入的名称（Java 里仅在 `overwriteName && 非空 && 与原值不同` 时 set）
    pub new_name: Option<String>,
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound(tigshop_core::models::logistics::logistics_company::MSG_LOGISTICS_COMPANY_NOT_FOUND.into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = LogisticsCompanyPatch {
            logistics_name: Some(Some(String::new())),
            is_enabled: Some(Some(0)),
            ..LogisticsCompanyPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = LogisticsCompanyPatch {
            logistics_code: None,
            logistics_name: Some(None),
            ..LogisticsCompanyPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// `LogisticsCompanyInsert` 的默认值全都是「不写列」。
    #[test]
    fn insert_default_skips_all_columns() {
        let v = LogisticsCompanyInsert::default();
        assert_eq!(v.logistics_code, None);
        assert_eq!(v.kuaidi100_code, None);
        assert_eq!(v.is_enabled, None);
        assert_eq!(v.shop_id, None);
    }

    /// `MAPPED_LOGISTICS_CODES` 必须与 `models::logistics_company` 的映射表完全一致
    /// （Java `applyMappedLogisticsCodeFilter` 用的是
    /// `Kuaidi100CodeMapping.mappedLogisticsCodes()`，即映射表的全部 key）。
    #[test]
    fn mapped_codes_match_model_mapping_table() {
        let from_model = tigshop_core::models::logistics::logistics_company::mapped_logistics_codes();
        assert_eq!(MAPPED_LOGISTICS_CODES.len(), from_model.len());
        for code in from_model {
            assert!(
                MAPPED_LOGISTICS_CODES.contains(&code),
                "{code} 未固化进 MAPPED_LOGISTICS_CODES"
            );
        }
    }

    /// `Kuaidi100Update` 的 `new_name` 语义：`None` = 不改名。
    #[test]
    fn kuaidi100_update_semantics() {
        let only_code = Kuaidi100Update {
            logistics_id: 1,
            kuaidi100_code: "shunfeng".into(),
            new_name: None,
        };
        assert!(only_code.new_name.is_none());

        let with_name = Kuaidi100Update {
            logistics_id: 1,
            kuaidi100_code: "shunfeng".into(),
            new_name: Some("顺丰速运".into()),
        };
        assert_eq!(with_name.new_name.as_deref(), Some("顺丰速运"));
    }
}