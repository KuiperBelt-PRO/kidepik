/** Genera tmp/expo-go-qr.png para escanear con Expo Go (móvil físico). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const lanIp = process.argv[2] ?? process.env.EXPO_LAN_IP;
if (!lanIp) {
  console.error("Uso: node scripts/generate-qr.mjs <IP-LAN>");
  process.exit(1);
}

const expUrl = `exp://${lanIp}:8081`;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "tmp");
const outFile = join(outDir, "expo-go-qr.png");

mkdirSync(outDir, { recursive: true });
await QRCode.toFile(outFile, expUrl, { width: 420, margin: 2 });
writeFileSync(join(outDir, "expo-go-url.txt"), expUrl, "utf8");

console.log(outFile);
console.log(expUrl);
