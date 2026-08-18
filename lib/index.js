// dsh-whale-pet —— 鲸鱼娘桌宠插件（宿主半边，零侵入）。
// 只做一件事：把包内 assets 目录以只读静态路由提供给浏览器
// （鲸鱼娘 *.webp 立绘 + whale-call.mp3 鲸歌），供 client.js 注入桌宠时加载。
// 不修改任何内置包文件、不读业务 DOM、无外部请求。
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Cordis 插件名（loader 诊断用）。 */
export const name = "dsh-whale-pet";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(HERE, "..", "assets");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** 把请求参数 f 解析为 assets 目录内的安全路径；越界返回 null。 */
function safeResolve(rel) {
  const target = path.normalize(path.join(ASSETS_DIR, rel));
  if (target !== ASSETS_DIR && !target.startsWith(ASSETS_DIR + path.sep)) return null;
  return target;
}

export async function apply(ctx) {
  // 走 inject —— apply 运行时刻 webserver 的 fiber 可能尚未创建。
  ctx.inject(["webServer"], (wctx) => {
    const webServer = wctx.get("webServer");
    const dispose = webServer.register({
      kind: "exact",
      path: "/api/dsh-whale-pet/assets",
      handler: async (req, res) => {
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          // f 的值可能带形如 ?v=3 的版本尾巴（表现层拼 URL 时追加），剥掉再解析。
          const rel = (url.searchParams.get("f") ?? "").split("?")[0];
          const file = safeResolve(rel);
          if (file === null || !existsSync(file) || !statSync(file).isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("not found");
            return;
          }
          const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": type,
            "Cache-Control": "public, max-age=3600",
          });
          createReadStream(file).pipe(res);
        } catch (error) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(String(error?.message ?? error));
        }
      },
    });
    wctx.effect(() => dispose, "dsh-whale-pet: 静态资源路由");
  });

  ctx.logger?.info?.("dsh-whale-pet: 已挂载（资源路由 /api/dsh-whale-pet/assets）");
}
