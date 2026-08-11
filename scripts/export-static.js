import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(".");
const CACHE_FILE = join(ROOT, "data", "settlement-cache.json");
const ROOT_INDEX_FILE = join(ROOT, "index.html");
const OUTPUT_FILE = join(ROOT, "dist", "settlement-dashboard.html");
const PAGES_FILE = join(ROOT, "pages", "index.html");

const [html, css, app, payload] = await Promise.all([
  readFile(join(ROOT, "public", "index.html"), "utf8"),
  readFile(join(ROOT, "public", "styles.css"), "utf8"),
  readFile(join(ROOT, "public", "app.js"), "utf8"),
  readFile(CACHE_FILE, "utf8")
]);

const staticApp = app
  .replace(
    /async function loadData\(\) \{[\s\S]*?\n\}/,
    `async function loadData() {
  statusText.textContent = "读取中...";
  state.payload = window.__SETTLEMENT_DATA__;
  state.rows = state.payload.rows || [];
  tableHead.innerHTML = columns.map(([, label]) => \`<th>\${label}</th>\`).join("");
  hydrateMerchants(state.rows);
  applyFilters();
  statusText.textContent = \`导出时间：\${new Date(state.payload.updatedAt).toLocaleString("zh-CN")}\`;
}`
  )
  .replace(
    /async function refreshData\(\) \{[\s\S]*?\n\}/,
    `async function refreshData() {
  statusText.textContent = "静态查看版不支持更新数据";
}`
  )
  .replace(
    /document\.querySelector\("#refreshBtn"\)\.addEventListener\([\s\S]*?\n\}\);/,
    `document.querySelector("#refreshBtn")?.remove();`
  );

const staticHtml = html
  .replace('<link rel="stylesheet" href="/styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<button id="refreshBtn" class="refresh-button" title="更新数据">更新数据</button>', "")
  .replace('<script src="/app.js"></script>', `<script>window.__SETTLEMENT_DATA__ = ${payload.trim()};</script>\n<script>\n${staticApp}\n</script>`);

await mkdir(dirname(OUTPUT_FILE), { recursive: true });
await mkdir(dirname(PAGES_FILE), { recursive: true });
await writeFile(ROOT_INDEX_FILE, staticHtml);
await writeFile(OUTPUT_FILE, staticHtml);
await writeFile(PAGES_FILE, staticHtml);

console.log(`已同步 GitHub Pages 根目录首页：${ROOT_INDEX_FILE}`);
console.log(`已导出静态看板：${OUTPUT_FILE}`);
console.log(`已同步 GitHub Pages 首页：${PAGES_FILE}`);
