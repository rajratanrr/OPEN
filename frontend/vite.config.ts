import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const outputDirectory = process.env.ROADSAATHI_WEB_OUT_DIR || "dist";

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: "roadsaathi-offline-shell",
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (
            request.url?.split("?")[0] ===
            "/downloads/RoadSaathi-WiFi-debug.apk"
          ) {
            response.setHeader(
              "Content-Type",
              "application/vnd.android.package-archive",
            );
            response.setHeader(
              "Content-Disposition",
              'attachment; filename="RoadSaathi.apk"',
            );
          }
          next();
        });
      },
      async closeBundle() {
        if (outputDirectory !== "dist") return;
        const assets = await readdir(
          resolve(import.meta.dirname, "dist/assets"),
        );
        const files = [
          "/",
          "/index.html",
          "/icon.svg",
          "/manifest.webmanifest",
          ...assets.map((a) => "/assets/" + a),
        ];
        const version = "roadsaathi-" + Date.now();
        await writeFile(
          resolve(import.meta.dirname, "dist/sw.js"),
          `const CACHE=${JSON.stringify(version)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('roadsaathi-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/actuator/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html',{ignoreVary:true})));return;}if(FILES.includes(u.pathname))e.respondWith(caches.match(e.request,{ignoreVary:true}).then(r=>r||fetch(e.request)));});`,
        );
      },
    },
  ],
  server: {
    // API CORS/preflights are handled by Spring and Express behind the proxy.
    cors: false,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/actuator": { target: "http://127.0.0.1:3000" },
    },
  },
  preview: {
    cors: false,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/actuator": { target: "http://127.0.0.1:3000" },
    },
  },
  build: {
    outDir: outputDirectory,
    chunkSizeWarningLimit: 900,
    emptyOutDir: outputDirectory !== "dist",
  },
});
