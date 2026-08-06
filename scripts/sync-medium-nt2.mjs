import { readFile, writeFile } from "node:fs/promises";

const origin = "https://kiheonshin.github.io/blog-post-assets";
const postPath = "/series/newtype-ip-dialogue/posts/02-engine-as-ip/";
const sourcePath = "series/newtype-ip-dialogue/posts/02-engine-as-ip/index.html";
const outputPath = "import-nt2.html";

const source = await readFile(sourcePath, "utf8");
const currentImport = await readFile(outputPath, "utf8");

function required(pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`${label}을(를) 찾지 못했습니다.`);
  return match[1].trim();
}

const prefix = currentImport.match(/^([\s\S]*?<body>)/)?.[1];
if (!prefix) throw new Error("미디엄 문서의 <body> 시작점을 찾지 못했습니다.");

const title = required(/<header class="head">[\s\S]*?<h1>([\s\S]*?)<\/h1>/, "제목");
const hero = required(/(<figure class="hero">[\s\S]*?<\/figure>)/, "대표 이미지")
  .replace('<figure class="hero">', "<figure>")
  .replace('src="../../assets/', `src="${origin}/series/newtype-ip-dialogue/assets/`)
  .replace(/\s+decoding="async"\s+fetchpriority="high"/, "");
const lead = required(/<p class="lead">([\s\S]*?)<\/p>/, "도입문");
const seriesGuide = required(/<p class="series">([\s\S]*?)<\/p>/, "시리즈 안내");
const prose = required(/<div class="prose">([\s\S]*?)<\/div>/, "본문")
  .replace(
    /<h2[^>]*><span class="secnum">0?(\d+)<\/span><span>([\s\S]*?)<\/span><\/h2>/g,
    "<h2>$1. $2</h2>",
  )
  .replace(/src="\.\.\/\.\.\/assets\//g, `src="${origin}/series/newtype-ip-dialogue/assets/`);

const seriesLinks = [
  ["1", "잠재력을 믿는 데서 협업이 시작된다", "01-not-blocking-potential"],
  ["2", "남는 IP는 취향을 재현하는 엔진이다", "02-engine-as-ip"],
  ["3", "다르게 보는 눈은 창작자가 가진 능력이다", "03-already-have-the-eye"],
]
  .map(([number, label, slug]) => `<a href="${origin}/series/newtype-ip-dialogue/posts/${slug}/">(${number}) ${label}</a>`)
  .join(" · ");

const body = `
<h1>${title}</h1>
${hero}
<p>${lead}</p>
<p><em>${seriesGuide}</em></p>
<hr>
${prose}
<hr>
<p><em>시리즈 : ${seriesLinks}</em></p>
<p>이 글은 신기헌의 디지털 트윈 프로젝트를 바탕으로 AI 에이전트가 100% 작성하고 편집했다. 원문 포스팅은 <a href="${origin}${postPath}">${origin}</a>에 있다.</p>
<p>Written and edited 100% by an AI agent from the Kiheon Shin Digital Twin project.</p>
</body>
</html>
`;

await writeFile(outputPath, `${prefix}${body}`, "utf8");
