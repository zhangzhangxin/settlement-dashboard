# 黄金小微结算数据网址

本项目是一个本地可运行的结算数据看板，页面字段对齐公司数仓表：

`ads_mall_not_self_calendar_daily_settlement2_di`

## 数据更新方式

当前网站每天上午 10:00 会执行：

```bash
npm run refresh
```

本机自动更新使用 macOS launchd，配置文件在：

```text
launchd/com.yingxiaohua.settlement-refresh.plist
```

日志写入：

```text
logs/daily-refresh.out.log
logs/daily-refresh.err.log
```

## 外部查看版

每天上午 10:00 刷新后会生成一个静态 HTML：

```text
dist/settlement-dashboard.html
```

这个文件只包含已导出的看板数据和前端筛选能力，不包含数据库 API Key，也不能触发数据库查询。

配置 GitHub Pages 后，可以执行：

```bash
npm run publish:pages
```

把 `pages/index.html` 推送到 GitHub，外部固定链接会随文件更新。

刷新脚本会读取：

```text
data/source.sql
```

如果该文件中包含目标表同字段的 `INSERT ... VALUES` 数据，会解析后生成：

```text
data/settlement-cache.json
```

如果没有放入 `data/source.sql`，页面会使用示例数据，方便先验收页面。

## 公司取数逻辑

你提供的 SQL 是数仓生成逻辑，用来产出每日分区表：

```sql
ads_mall_not_self_calendar_daily_settlement2_di PARTITION (ds = '${d1}')
```

核心口径：

- 支付成功指标：订单数、销售价、成交价、克重、供货价、优惠券金额
- 仅退款成功指标：订单数、销售价、成交价、克重、供货价、优惠券金额
- 退货退款成功指标：订单数、销售价、成交价、克重、供货价、优惠券金额
- 退款贴息指标：订单数、金额
- 日结算金额：

```sql
(支付成功销售价 - 仅退款销售价 - 退货退款销售价) * 0.2701
- (支付成功优惠券 - 仅退款优惠券 - 退货退款优惠券)
```

## 后续接入真实数据库

如果要让网站直接执行公司 SQL，需要补充以下信息：

- 数仓类型：Hive、SparkSQL、Trino、Presto 或其他
- 连接方式：JDBC、HTTP API、命令行客户端或调度平台接口
- 认证方式：账号密码、Kerberos、Token 或内网免密
- 每天中午执行日期参数：`${d1}`、`${yyyy-mm-dd}` 的实际取值规则
