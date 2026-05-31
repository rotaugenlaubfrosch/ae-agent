import { mkdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const source = resolve("apps/panel");

const targetDirByPlatform = {
  darwin: resolve(homedir(), "Library/Application Support/Adobe/CEP/extensions"),
  win32: resolve(process.env.APPDATA || homedir(), "Adobe/CEP/extensions"),
  linux: resolve(homedir(), ".cep/extensions"),
};

const targetDir = targetDirByPlatform[process.platform] || targetDirByPlatform.linux;
const target = resolve(targetDir, "ae-agent");

await mkdir(targetDir, { recursive: true });
await rm(target, { force: true, recursive: true });
await symlink(source, target, "dir");

console.log(`Linked ${source} -> ${target}`);
console.log("Run `npm --workspace apps/panel run build`, then restart After Effects.");
