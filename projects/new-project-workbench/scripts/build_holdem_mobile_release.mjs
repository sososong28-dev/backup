import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "output", "holdem-mobile-release");
const bundlePath = path.join(distDir, "app.bundle.js");
const releasePath = path.join(distDir, "SharkCoach德州扑克-手机外发版.html");
const aliasPath = path.join(distDir, "SharkCoach-mobile-release.html");

mkdirSync(distDir, { recursive: true });

const npxArgs = [
    "--yes",
    "--package",
    "esbuild",
    "esbuild",
    path.join(root, "game", "app.js"),
    "--bundle",
    "--format=iife",
    "--target=es2020",
    "--charset=utf8",
    `--outfile=${bundlePath}`,
];

if (process.platform === "win32") {
  execFileSync("cmd.exe", ["/c", "npx", ...npxArgs], { cwd: root, stdio: "inherit" });
} else {
  execFileSync("npx", npxArgs, { cwd: root, stdio: "inherit" });
}

const html = readFileSync(path.join(root, "game", "index.html"), "utf8");
const css = readFileSync(path.join(root, "game", "styles.css"), "utf8");
const vendor = readFileSync(path.join(root, "game", "vendor", "pokersolver.js"), "utf8");
const app = readFileSync(bundlePath, "utf8");

const title = "SharkCoach 德州扑克手机外发版";
const faviconSvg = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#e6bd67"/><text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="32" font-weight="900" fill="#17110a">S</text></svg>',
);
const body = html.match(/<body>([\s\S]*)<\/body>/i)?.[1] || "";
const cleanedBody = body
  .replace(/<a class="button secondary home-start" href="\.\/lan\.html">本地联机<\/a>/, '<button class="button secondary home-start" type="button" disabled>联机需服务器</button>')
  .replace(/<a class="button secondary" href="\.\/lan\.html">联机<\/a>/, '<button class="button secondary" type="button" disabled>联机需服务器</button>')
  .replace(/<script src="\.\/vendor\/pokersolver\.js"><\/script>/, "")
  .replace(/<script type="module" src="\.\/app\.js\?v=\d+"><\/script>/, "");

const releaseHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="#07100c" />
    <title>${title}</title>
    <link rel="icon" href="data:image/svg+xml,${faviconSvg}" />
    <style>
${css}
    </style>
  </head>
  <body>
${cleanedBody.trim()}
    <script>
      window.SHARKCOACH_STANDALONE = true;
    </script>
    <script>
${vendor}
    </script>
    <script>
${app}
    </script>
  </body>
</html>
`;

writeFileSync(releasePath, releaseHtml, "utf8");
writeFileSync(aliasPath, releaseHtml, "utf8");
rmSync(bundlePath, { force: true });

console.log(releasePath);
console.log(aliasPath);
