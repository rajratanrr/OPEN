import QRCode from "qrcode";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputs = resolve(root, "..");
const metadata = JSON.parse(await readFile(resolve(outputs, "RoadSaathi-APK-build.json"), "utf8"));
const apk = resolve(outputs, "RoadSaathi-WiFi-debug.apk");
const bytes = await readFile(apk);
if (createHash("sha256").update(bytes).digest("hex") !== metadata.sha256) throw Error("APK differs from its build record. Rebuild before preparing the download.");
const pageUrl = new URL("/download/", metadata.server).href;
const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
let html = await readFile(resolve(root, "scripts/download-template.html"), "utf8");
const qr = await QRCode.toBuffer(pageUrl, { type:"png", width:360, margin:4, errorCorrectionLevel:"M", color:{dark:"#173a32",light:"#ffffff"} });
const values = {SIZE:(bytes.length / 1024 / 1024).toFixed(1), VERSION:metadata.version, PAGE_URL:pageUrl, SHA256:metadata.sha256, BYTES:bytes.length, QR_DATA_URL:`data:image/png;base64,${qr.toString("base64")}`};
for (const [key, value] of Object.entries(values)) html = html.replaceAll(`{{${key}}}`, escape(value));
for (const location of ["frontend/public/download", "frontend/dist/download"]) {
  const directory = resolve(root, location);
  await mkdir(directory, { recursive:true });
  await writeFile(resolve(directory, "index.html"), html);
  await writeFile(resolve(directory, "install-qr.png"), qr);
  await writeFile(resolve(directory, "build.json"), JSON.stringify({...metadata,pageUrl}) + "\n");
}
await mkdir(resolve(root, "frontend/dist/downloads"), {recursive:true});
await copyFile(apk, resolve(root, "frontend/dist/downloads/RoadSaathi-WiFi-debug.apk"));
await writeFile(resolve(outputs, "RoadSaathi-Install-QR.png"), qr);
console.log(`Download page ready: ${pageUrl}`);
