import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(scriptDir);
const [html, css, core, app] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "styles.css"), "utf8"),
  readFile(join(root, "core.mjs"), "utf8"),
  readFile(join(root, "app.js"), "utf8"),
]);

const coreWithoutExports = core
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const appWithoutImport = app.replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/core\.mjs["'];\s*/m, "");
const inlineScript = `${coreWithoutExports}\n${appWithoutImport}`.replaceAll("</script>", "<\\/script>");

const portable = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>\n${inlineScript}\n</script>`)
  .replace("<title>研究指揮中心</title>", "<title>研究指揮中心｜免安裝可攜版</title>");

const output = join(root, "研究證據工作台-直接開啟.html");
await writeFile(output, portable, "utf8");
console.log(`Built ${output}`);

