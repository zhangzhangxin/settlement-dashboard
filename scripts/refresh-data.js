import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { queryApi } from "./query-api.js";

const ROOT = resolve(".");
const SOURCE_SQL = process.env.SOURCE_SQL || join(ROOT, "data", "source.sql");
const CACHE_FILE = join(ROOT, "data", "settlement-cache.json");
const TABLE_NAME = process.env.SETTLEMENT_TABLE || "vdm_operation.selfmall_market_jiesuan";

const columns = [
  "bus_date",
  "company_name",
  "daily_settlement_ratio",
  "daily_settle_amt",
  "net_gmv",
  "mall_pay_suc_order_cnt",
  "mall_pay_suc_sale_price_amt",
  "mall_pay_suc_deal_price_amt",
  "mall_pay_suc_specs",
  "mall_pay_suc_sku_price_amt",
  "mall_pay_suc_coupon_amount",
  "mall_afs_refunded_order_cnt",
  "mall_afs_refunded_sale_price_amt",
  "mall_afs_refunded_deal_price_amt",
  "mall_afs_refunded_specs",
  "mall_afs_refunded_sku_price_amt",
  "mall_afs_refunded_coupon_amount",
  "mall_afs_returned_refunded_order_cnt",
  "mall_afs_returned_refunded_sale_price_amt",
  "mall_afs_returned_refunded_deal_price_amt",
  "mall_afs_returned_refunded_specs",
  "mall_afs_returned_refunded_sku_price_amt",
  "mall_afs_returned_refunded_coupon_amount",
  "mall_afs_schd_refund_interest_cnt",
  "mall_afs_schd_refund_interest_amt",
  "ds"
];

const aliases = {
  businessDate: "bus_date",
  merchantName: "company_name",
  settlementRate: "daily_settlement_ratio",
  settlementAmount: "daily_settle_amt",
  netGmv: "net_gmv",
  paidOrderCount: "mall_pay_suc_order_cnt",
  paidGrossSales: "mall_pay_suc_sale_price_amt",
  paidCost: "mall_pay_suc_deal_price_amt",
  couponAmount: "mall_pay_suc_coupon_amount",
  paidQuantity: "mall_pay_suc_specs",
  refundAmount: "mall_afs_refunded_sale_price_amt"
};

function sampleRows() {
  const merchant = "深圳市南美数字文化科技有限公司";
  const rates = [9266.05, 18649.05, 16732.97, 24828.4, 23306.39, 20752.17, 26451.7, 14269.11, 31754.22, 42439.6, 22777.26, 39459.99, 33227.43, 19944.99, 23796.62, 30089.36];
  return rates.map((settlementAmount, index) => {
    const day = 12 + index;
    const netGmv = Math.round((settlementAmount / 0.2701) * 100) / 100;
    const couponAmount = index % 4 === 3 ? 140 : index === 15 ? 1951.5 : 0;
    return {
      bus_date: `2026-07-${String(day).padStart(2, "0")}`,
      company_name: merchant,
      daily_settlement_ratio: 0.2701,
      daily_settle_amt: settlementAmount,
      net_gmv: netGmv,
      mall_pay_suc_order_cnt: Math.max(9, Math.round(netGmv / 3900)),
      mall_pay_suc_sale_price_amt: Math.round((netGmv + couponAmount) * 100) / 100,
      mall_pay_suc_deal_price_amt: Math.round(netGmv * 100) / 100,
      mall_pay_suc_specs: Math.max(26, Math.round(netGmv / 1250)),
      mall_pay_suc_sku_price_amt: Math.round(netGmv * 0.962 * 100) / 100,
      mall_pay_suc_coupon_amount: couponAmount,
      mall_afs_refunded_order_cnt: index % 5 === 0 ? 0 : 1,
      mall_afs_refunded_sale_price_amt: index % 5 === 0 ? 0 : Math.round((index + 1) * 13.7 * 100) / 100,
      mall_afs_refunded_deal_price_amt: index % 5 === 0 ? 0 : Math.round((index + 1) * 12.8 * 100) / 100,
      mall_afs_refunded_specs: index % 5 === 0 ? 0 : 1,
      mall_afs_refunded_sku_price_amt: index % 5 === 0 ? 0 : Math.round((index + 1) * 11.2 * 100) / 100,
      mall_afs_refunded_coupon_amount: 0,
      mall_afs_returned_refunded_order_cnt: index % 7 === 0 ? 1 : 0,
      mall_afs_returned_refunded_sale_price_amt: index % 7 === 0 ? 168 : 0,
      mall_afs_returned_refunded_deal_price_amt: index % 7 === 0 ? 158 : 0,
      mall_afs_returned_refunded_specs: index % 7 === 0 ? 1 : 0,
      mall_afs_returned_refunded_sku_price_amt: index % 7 === 0 ? 151 : 0,
      mall_afs_returned_refunded_coupon_amount: 0,
      mall_afs_schd_refund_interest_cnt: index % 6 === 0 ? 1 : 0,
      mall_afs_schd_refund_interest_amt: index % 6 === 0 ? 8.88 : 0,
      ds: `202607${String(day).padStart(2, "0")}`
    };
  });
}

function splitSqlValues(row) {
  const values = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    const next = row[i + 1];
    if (char === "'" && next === "'") {
      current += "'";
      i += 1;
      continue;
    }
    if (char === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (char === "," && !inQuote) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values.map((value) => {
    if (/^null$/i.test(value)) return null;
    if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
    return value;
  });
}

function parseSqlDump(sql) {
  const rows = [];
  const insertPattern = /insert\s+(?:overwrite\s+table|into)\s+[\w.`]+\s*(?:partition\s*\([^)]+\))?\s*\(([^)]+)\)\s*values\s*([\s\S]*?);/gi;
  let match;

  while ((match = insertPattern.exec(sql))) {
    const sourceColumns = match[1].split(",").map((item) => {
      const column = item.replace(/[`"']/g, "").trim();
      return aliases[column] || column;
    });
    const valuesBlock = match[2];
    const tuplePattern = /\(([^()]*)\)/g;
    let tuple;

    while ((tuple = tuplePattern.exec(valuesBlock))) {
      const values = splitSqlValues(tuple[1]);
      const record = {};
      sourceColumns.forEach((column, index) => {
        if (columns.includes(column)) record[column] = values[index];
      });
      if (record.bus_date && record.company_name) rows.push(record);
    }
  }

  return rows;
}

function normalizeApiRow(row) {
  const normalized = {};
  columns.forEach((column) => {
    normalized[column] = row[column] ?? row[column.toUpperCase()] ?? row[column.toLowerCase()] ?? null;
  });
  return normalized;
}

async function fetchRowsFromApi() {
  const partitionResult = await queryApi(`SELECT max(ds) AS ds FROM ${TABLE_NAME}`);
  const latestDs = partitionResult.rows?.[0]?.ds;
  if (!latestDs) {
    throw new Error(`没有从 ${TABLE_NAME} 查询到最新分区`);
  }

  const sql = `
SELECT
  bus_date,
  company_name,
  daily_settlement_ratio,
  daily_settle_amt,
  net_gmv,
  mall_pay_suc_order_cnt,
  mall_pay_suc_sale_price_amt,
  mall_pay_suc_deal_price_amt,
  mall_pay_suc_specs,
  mall_pay_suc_sku_price_amt,
  mall_pay_suc_coupon_amount,
  mall_afs_refunded_order_cnt,
  mall_afs_refunded_sale_price_amt,
  mall_afs_refunded_deal_price_amt,
  mall_afs_refunded_specs,
  mall_afs_refunded_sku_price_amt,
  mall_afs_refunded_coupon_amount,
  mall_afs_returned_refunded_order_cnt,
  mall_afs_returned_refunded_sale_price_amt,
  mall_afs_returned_refunded_deal_price_amt,
  mall_afs_returned_refunded_specs,
  mall_afs_returned_refunded_sku_price_amt,
  mall_afs_returned_refunded_coupon_amount,
  mall_afs_schd_refund_interest_cnt,
  mall_afs_schd_refund_interest_amt,
  ds
FROM ${TABLE_NAME}
WHERE ds = '${latestDs}'
ORDER BY bus_date, company_name
LIMIT 1000
`;
  const result = await queryApi(sql);
  return (result.rows || []).map(normalizeApiRow).filter((row) => row.bus_date && row.company_name);
}

function summarize(rows) {
  return rows.reduce(
    (total, row) => ({
      daily_settle_amt: total.daily_settle_amt + Number(row.daily_settle_amt || 0),
      net_gmv: total.net_gmv + Number(row.net_gmv || 0),
      mall_pay_suc_order_cnt: total.mall_pay_suc_order_cnt + Number(row.mall_pay_suc_order_cnt || 0),
      mall_pay_suc_specs: total.mall_pay_suc_specs + Number(row.mall_pay_suc_specs || 0)
    }),
    { daily_settle_amt: 0, net_gmv: 0, mall_pay_suc_order_cnt: 0, mall_pay_suc_specs: 0 }
  );
}

export async function refreshData() {
  await mkdir(dirname(CACHE_FILE), { recursive: true });

  let rows = [];
  let source = `${TABLE_NAME}:latest_partition`;
  if (existsSync("/Users/zhangxin/Desktop/test_api.ps1")) {
    try {
      rows = await fetchRowsFromApi();
    } catch (error) {
      throw new Error(`真实数据查询失败，已停止更新，避免发布错误数据：${error.message}`);
    }
  }

  if (rows.length === 0 && existsSync(SOURCE_SQL)) {
    const sql = await readFile(SOURCE_SQL, "utf8");
    const parsed = parseSqlDump(sql);
    if (parsed.length > 0) {
      rows = parsed;
      source = SOURCE_SQL;
    }
  }

  if (rows.length === 0) {
    throw new Error("没有查询到真实结算数据，已停止更新，避免使用示例数据覆盖看板");
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source,
    rows,
    totals: summarize(rows)
  };

  await writeFile(CACHE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] || "")) {
  refreshData()
    .then((data) => console.log(`已更新 ${data.rows.length} 行数据，来源：${data.source}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
