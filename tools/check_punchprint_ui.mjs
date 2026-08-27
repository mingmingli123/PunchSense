import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const constants = fs.readFileSync(path.join(root, "js/core/constants.js"), "utf8");

const controlIdsMatch = constants.match(/export const CONTROL_IDS = \[([\s\S]*?)\];/);
if (!controlIdsMatch) fail("CONTROL_IDS not found");

const controlIds = [...controlIdsMatch[1].matchAll(/\"([A-Za-z0-9_]+)\"/g)].map((match) => match[1]);
const missing = controlIds.filter((id) => !html.includes(`id="${id}"`));
if (missing.length) fail(`Missing control elements: ${missing.join(", ")}`);

const requiredIds = [
  "bedCanvas",
  "readout",
  "workflowMode",
  "downloadGcode",
  "pickTpuSnakeEndpoints",
  "tpuSnakeList",
];
const missingRequired = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingRequired.length) fail(`Missing required UI elements: ${missingRequired.join(", ")}`);

if (!html.includes('type="module" src="./script.js?')) {
  fail("index.html module script is missing a cache-busted script.js import");
}

console.log(`PunchPrint UI static check OK: ${controlIds.length} controls, ${requiredIds.length} required elements.`);

function fail(message) {
  console.error(`PunchPrint UI static check failed: ${message}`);
  process.exit(1);
}
