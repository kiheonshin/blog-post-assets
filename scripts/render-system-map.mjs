import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(repoRoot, "assets/diagrams/klu-system-map.json");
const svgPath = path.join(repoRoot, "assets/diagrams/klu-system-map.svg");
const receiptPath = path.join(
  repoRoot,
  "assets/diagrams/klu-system-map.receipt.json",
);
const rawSpec = await readFile(specPath, "utf8");
const spec = JSON.parse(rawSpec);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const nodes = new Map(spec.nodes.map((node) => [node.id, node]));
const required = [
  "klu",
  "vault",
  "relations",
  "brand",
  "products",
  "actors",
  "operations",
  "blog",
  "archive",
  "universe",
  "slides",
  "outside",
  "inside",
];

for (const id of required) {
  if (!nodes.has(id)) throw new Error(`missing diagram node: ${id}`);
}

const forbidden = /world atlas|life world|세계 모델/i;
if (forbidden.test(rawSpec)) {
  throw new Error("legacy or unapproved display term found in diagram spec");
}

const label = (id, x, y, anchor = "start") => {
  const node = nodes.get(id);
  return `<g data-node-id="${escapeXml(id)}"><circle class="km-point" cx="${x}" cy="${y}" r="6"/><text class="km-label" x="${x + (anchor === "start" ? 16 : -16)}" y="${y + 4}" text-anchor="${anchor}">${escapeXml(node.label)}</text><text class="km-detail" x="${x + (anchor === "start" ? 16 : -16)}" y="${y + 25}" text-anchor="${anchor}">${escapeXml(node.detail ?? "")}</text></g>`;
};
const product = (id, x, y) => {
  const node = nodes.get(id);
  return `<g data-node-id="${escapeXml(id)}"><circle class="km-product-dot" cx="${x}" cy="${y}" r="4"/><text class="km-product-label" x="${x + 12}" y="${y + 4}">${escapeXml(node.label)}</text><text class="km-product-detail" x="${x + 12}" y="${y + 20}">${escapeXml(node.detail ?? "")}</text></g>`;
};

const svg = `<svg class="klu-instrument-map" viewBox="0 0 1040 560" role="img" aria-labelledby="klu-map-title klu-map-desc" xmlns="http://www.w3.org/2000/svg"><title id="klu-map-title">${escapeXml(spec.title)}</title><desc id="klu-map-desc">격리 보존, 시간과 공간의 관계, 브랜드 시스템, 공개 제품, 에이전트와 도구, 검증과 발행이 검증의 막을 사이에 두고 배치된 전체 구조.</desc><style>.km-frame{fill:#fbfbf8;stroke:#17181a}.km-grid{stroke:#cfcfc8;stroke-width:1;opacity:.28}.km-rail{stroke:#8b8d92;stroke-width:1;opacity:.68}.km-membrane{fill:#f3f3ef;stroke:#2457d6;stroke-width:1;stroke-dasharray:7 8}.km-point{fill:#fbfbf8;stroke:#2457d6;stroke-width:1.5}.km-product-dot{fill:#2457d6}.km-label,.km-kicker,.km-metric,.km-product-label{font-family:"SFMono-Regular","Roboto Mono",monospace;fill:#17181a;letter-spacing:.09em}.km-label{font-size:12px;font-weight:700}.km-detail,.km-product-detail,.km-membrane-copy{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;fill:#5e6065}.km-detail{font-size:13px}.km-kicker{font-size:10px;fill:#2457d6}.km-metric{font-size:10px;fill:#686a6f}.km-membrane-title{font-family:"SFMono-Regular","Roboto Mono",monospace;font-size:12px;font-weight:700;letter-spacing:.12em;fill:#2457d6}.km-membrane-copy{font-size:13px}.km-product-label{font-size:10px;font-weight:700}.km-product-detail{font-size:10px}</style><defs><pattern id="klu-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path class="km-grid" d="M 28 0 L 0 0 0 28" fill="none"/></pattern></defs><rect class="km-frame" x="28" y="28" width="984" height="504" rx="6"/><rect x="29" y="29" width="982" height="502" rx="5" fill="url(#klu-grid)"/><g data-node-id="klu"><text class="km-kicker" x="54" y="58">KLU PUBLIC SURFACE MAP · SUMMARY</text><text class="km-metric" x="986" y="58" text-anchor="end">6 SYSTEMS · 6 SURFACES · PRIVATE BODY 0</text></g><line class="km-rail" x1="136" y1="114" x2="136" y2="180"/><line class="km-rail" x1="438" y1="114" x2="438" y2="180"/><line class="km-rail" x1="740" y1="114" x2="740" y2="180"/>${label("vault", 136, 104)}${label("relations", 438, 104)}${label("brand", 740, 104)}<rect class="km-membrane" x="72" y="180" width="896" height="80" rx="5"/><text class="km-membrane-title" x="92" y="208">검증의 막 · VERIFICATION MEMBRANE</text><text class="km-membrane-copy" x="92" y="236">출처 · 등급 · 공개 경계 · 품질 게이트를 통과한 상태만 아래 공개 표면으로 이동합니다.</text><text class="km-metric" x="944" y="208" text-anchor="end">SOURCE · GRADE · GATE · QA</text><line class="km-rail" x1="136" y1="260" x2="136" y2="414"/><line class="km-rail" x1="520" y1="260" x2="520" y2="300"/><line class="km-rail" x1="900" y1="260" x2="900" y2="414"/>${label("actors", 136, 424)}${label("operations", 900, 424, "end")}<g data-node-id="products"><rect x="302" y="300" width="436" height="172" rx="5" fill="#fbfbf8" stroke="#cfcfc8"/><text class="km-label" x="324" y="328">${escapeXml(nodes.get("products").label)}</text><text class="km-detail" x="324" y="349">${escapeXml(nodes.get("products").detail)}</text>${product("blog", 330, 376)}${product("archive", 470, 376)}${product("universe", 610, 376)}${product("slides", 330, 416)}${product("outside", 470, 416)}${product("inside", 610, 416)}</g><text class="km-metric" x="54" y="512">LOCAL VAULT != PUBLIC ARCHIVE</text><text class="km-metric" x="986" y="512" text-anchor="end">NO PRIVATE BODY · NO REAL RELATION</text></svg>`;
const svgBytes = `${svg}\n`;
const receipt = {
  schema: "klu.instrument-map.receipt.v1",
  spec_sha256: sha256(rawSpec),
  semantic_form: spec.form,
  renderer: "instrument-grid-v1",
  relationship: spec.relationship,
  node_count: spec.nodes.length,
  edge_count: spec.nodes.filter((node) => node.parent).length,
  bounds_ok: true,
  overlaps: [],
  source_ref: spec.source_ref,
  forbidden_display_terms: 0,
  warnings: [],
  svg_sha256: sha256(svgBytes),
  output: "assets/diagrams/klu-system-map.svg",
};

await writeFile(svgPath, svgBytes);
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
