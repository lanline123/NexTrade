import type { ReactNode } from 'react';

export interface OptionItem {
  label: string;
  value: string | number;
}

export type FieldType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'custom';

export interface FieldConfig {
  field: string;
  label: string;
  hideLabel?: boolean;
  type?: FieldType;
  checkedText?: string;
  uncheckedText?: string;
  options?: OptionItem[];
  required?: boolean;
  placeholder?: string;
  extraText?: string;
  width?: number | string;
  inputWidth?: number;
  span?: number;
  rules?: Array<Record<string, unknown>>;
  disabled?: boolean;
  initValue?: unknown;
  /** 按新增/编辑模式控制是否显示 */
  visibleWhen?: (mode: 'create' | 'edit') => boolean;
  /** 按新增/编辑模式控制是否必填 */
  requiredWhen?: (mode: 'create' | 'edit') => boolean;
  /** 远程选项接口，默认取 records 或数组 */
  optionsApi?: string;
  optionsParams?: Record<string, unknown>;
  multiple?: boolean;
  optionLabel?: string;
  optionValue?: string;
  render?: (ctx: { formApi: any; values: Record<string, any>; mode: 'create' | 'edit' }) => ReactNode;
}

export interface FormSectionConfig {
  key: string;
  title: string;
  fields: FieldConfig[];
  description?: string;
}

export interface FormDrawerConfig {
  title?: string;
  addText?: string;
  width?: number;
  labelWidth?: number | string;
  inputWidth?: number;
  labelPosition?: 'left' | 'top';
  sections: FormSectionConfig[];
  createApi: string;
  updateApi?: string;
  detailApi?: string;
  deleteApi?: string;
  idField?: string;
  toPayload?: (values: Record<string, any>, mode: 'create' | 'edit') => Record<string, any>;
}

export interface FilterConfig {
  field: string;
  label: string;
  type?: 'input' | 'select' | 'number' | 'date' | 'tags';
  options?: OptionItem[];
  placeholder?: string;
  width?: number | string;
}

export interface ColumnConfig<T = any> {
  title: ReactNode;
  dataIndex?: string;
  key?: string;
  width?: number;
  render?: (value: any, record: T, index: number) => ReactNode;
}

export interface ListPageProps<T = any> {
  api: string;
  /** 列表请求方式：多数页面走 GET；少数旧版 DTO 是 POST（如 /finance/categoryFeeRule/list）。 */
  listMethod?: 'get' | 'post';
  /** 行唯一键：字段名，或 (row) => string（表格内部会生成 __frameworkKey）。 */
  rowKey: string | ((row: T) => string);
  columns: ColumnConfig<T>[];
  filters?: FilterConfig[];
  query?: Record<string, unknown>;
  pageSize?: number;
  drawer?: FormDrawerConfig;
  showEdit?: boolean;
  actionWidth?: number;
  selectable?: boolean;
  batchActions?: (selectedRows: T[], clear: () => void) => ReactNode;
  filterLayout?: 'inline' | 'popover';
  onDataLoaded?: (info: { total: number; rows: T[] }) => void;
  editRequest?: T | null;
  onEditRequestHandled?: () => void;
  toolbarExtra?: ReactNode;
  cardTitle?: ReactNode;
  onRowClick?: (record: T) => void;
  rowActions?: (record: T) => ReactNode;
}
