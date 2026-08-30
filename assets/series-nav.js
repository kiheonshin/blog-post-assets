/* 배포마다 이 버전을 올린다. GitHub Pages가 자산에 max-age=600을 걸어
   HTML만 새로 받고 모듈은 캐시에서 꺼내 쓰는 일이 생긴다. 그러면 새 시리즈가
   목록에서 빠지고 "시리즈 정보를 불러오지 못했습니다"가 뜬다(2026-07-25 실증).
   페이지의 series-nav.js?v= 값과 반드시 같이 올릴 것. */
import { contentLibrary, getSeries } from "./content-manifest.js?v=20260831a";

const siteRoot = new URL("../", import.meta.url);
const SERIES_PAGE_SIZE = 6;
const EXPLORE_PAGE_SIZE = 8;
const EXPLORE_PRIMARY_TOPIC_LIMIT = 8;

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function makePostCard(post, currentPostId) {
  const item = document.createElement("li");
  const isCurrent = post.id === currentPostId;
  const card = isCurrent
    ? makeElement("span", "card")
    : document.createElement("a");

  if (isCurrent) {
    card.setAttribute("aria-current", "page");
  } else {
    card.href = new URL(post.href, siteRoot);
  }

  const row = makeElement("span", "row");
  row.append(makeElement("span", "n", post.label));

  if (isCurrent) {
    row.append(makeElement("span", "cur", "지금 보는 글"));
  } else {
    const action = makeElement("span", "go", "글 읽기 ");
    const arrow = makeElement("span", "", "→");
    arrow.setAttribute("aria-hidden", "true");
    action.append(arrow);
    row.append(action);
  }

  card.append(row, makeElement("span", "t", post.title));
  item.append(card);
  return item;
}

function makeSourceCard(source) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = new URL(source.href, siteRoot);

  const meta = makeElement("span", "k");
  meta.append(
    makeElement("span", "", source.label),
    makeElement("span", "", "→"),
  );

  link.append(
    meta,
    makeElement("span", "t", source.title),
    makeElement("span", "s", source.description),
  );
  item.append(link);
  return item;
}

function makeSeriesContextCard(series) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = new URL(series.href, siteRoot);

  const meta = makeElement("span", "k");
  meta.append(
    makeElement("span", "", `NOTES · 포스팅 ${series.posts.length}개`),
    makeElement("span", "", "→"),
  );

  link.append(
    meta,
    makeElement("span", "t", series.title),
    makeElement("span", "s", "이 자료를 다시 읽고 쓴 글"),
  );
  item.append(link);
  return item;
}

function makeArchiveItems() {
  return contentLibrary.series.flatMap((series) => {
    const posts = series.posts.map((post) => ({
      ...post,
      kind: "post",
      kindLabel: "포스팅",
      seriesTitle: series.title,
      seriesLabel: series.label,
      description: "",
    }));
    const sources = (series.sources ?? []).map((source) => ({
      ...source,
      kind: "source",
      kindLabel: "원자료",
      seriesTitle: series.title,
      seriesLabel: series.label,
    }));
    return [...posts, ...sources];
  });
}

function makeArchiveLink(parameter, value) {
  const url = new URL(siteRoot);
  url.searchParams.set(parameter, value);
  url.hash = "archive";
  return url;
}

function normaliseSearchText(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ko");
}

function keepHyphenatedTermsTogether(value) {
  return value.replace(/(\p{L}|\p{N})-(?=\p{L}|\p{N})/gu, "$1‑");
}

function makeFacetList(className, values, parameter) {
  const facetLabel = {
    year: "관련 연도",
    topic: "주제",
    tag: "키워드",
  }[parameter];
  const list = makeElement("ul", className);
  for (const value of values ?? []) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = makeArchiveLink(parameter, String(value));
    link.textContent = String(value);
    link.setAttribute(
      "aria-label",
      `${facetLabel ?? "항목"} ${value}로 아카이브 필터링`,
    );
    item.append(link);
    list.append(item);
  }
  return list;
}

function makeArchiveResult(item) {
  const listItem = document.createElement("li");
  const article = makeElement("article", "archive-item");
  const meta = makeElement("p", "archive-item__meta");
  meta.append(
    makeElement("span", "archive-item__kind", item.kindLabel),
    makeElement("span", "archive-item__series", item.seriesLabel),
  );

  if (item.published) {
    const time = document.createElement("time");
    time.className = "archive-item__published";
    time.dateTime = item.published;
    time.textContent = `발행 ${item.published.replaceAll("-", ".")}`;
    meta.append(time);
  }

  if (item.sourceYears?.length) {
    meta.append(
      makeElement(
        "span",
        "archive-item__source-years",
        `원자료 ${item.sourceYears.map(String).join("·")}`,
      ),
    );
  }

  const title = makeElement("h3", "archive-item__title");
  const link = document.createElement("a");
  link.href = new URL(item.href, siteRoot);
  link.textContent = item.title;
  title.append(link);

  const facets = makeElement("div", "archive-item__facets");
  const topics = makeElement("div", "archive-item__facet-group");
  topics.append(
    makeElement("span", "archive-item__facet-label", "주제"),
    makeFacetList("archive-item__topics", item.topics, "topic"),
  );
  const keywords = makeElement("div", "archive-item__facet-group");
  keywords.append(
    makeElement("span", "archive-item__facet-label", "키워드"),
    makeFacetList("archive-item__keywords", item.keywords, "tag"),
  );
  facets.append(
    topics,
    keywords,
  );

  article.append(meta, title, facets);
  listItem.append(article);
  return listItem;
}

function splitSentences(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
    return [...segmenter.segment(clean)]
      .map(({ segment }) => segment.trim())
      .filter(Boolean);
  }

  return clean.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function makeTranscriptParagraph(text, corrected = false) {
  const paragraph = makeElement(
    "p",
    corrected ? "tr__p tr__p--normalised corrected" : "tr__p tr__p--normalised",
    text,
  );
  if (corrected) {
    const note = makeElement("span", "tr__note", "정정");
    note.setAttribute("aria-label", "발표 자료로 확인한 단어를 정정함");
    paragraph.append(note);
  }
  return paragraph;
}

function normaliseTranscriptRun(paragraphs) {
  const units = [];

  for (const paragraph of paragraphs) {
    const clone = paragraph.cloneNode(true);
    clone.querySelector(".tr__note")?.remove();
    const sentences = splitSentences(clone.textContent);
    sentences.forEach((text, index) => {
      units.push({
        text,
        corrected:
          paragraph.classList.contains("corrected") &&
          index === sentences.length - 1,
      });
    });
  }

  const chunks = [];
  let text = "";
  let corrected = false;

  const flush = () => {
    if (!text) return;
    chunks.push(makeTranscriptParagraph(text, corrected));
    text = "";
    corrected = false;
  };

  for (const unit of units) {
    const nextLength = text.length + (text ? 1 : 0) + unit.text.length;
    if (text && nextLength > 420 && text.length >= 160) flush();

    text += `${text ? " " : ""}${unit.text}`;
    corrected ||= unit.corrected;

    if (unit.corrected || text.length >= 280) flush();
  }
  flush();

  if (
    chunks.length > 1 &&
    chunks.at(-1).textContent.length < 100 &&
    !chunks.at(-1).classList.contains("corrected") &&
    !chunks.at(-2).classList.contains("corrected")
  ) {
    const tail = chunks.pop();
    chunks.at(-1).firstChild.textContent += ` ${tail.textContent}`;
  }

  const fragment = document.createDocumentFragment();
  fragment.append(...chunks);
  paragraphs[0].before(fragment);
  paragraphs.forEach((paragraph) => paragraph.remove());
}

function normaliseTranscriptSegment(segment) {
  let run = [];
  const flush = () => {
    if (run.length) normaliseTranscriptRun(run);
    run = [];
  };

  for (const child of [...segment.children]) {
    if (child.classList.contains("tr__p")) {
      run.push(child);
    } else {
      flush();
    }
  }
  flush();

  for (const note of [...segment.querySelectorAll(".tr__omit")]) {
    if (!note.textContent.trim().startsWith("교정 근거")) continue;
    const details = makeElement("details", "tr__evidence");
    const summary = makeElement("summary", "", "정정 근거 보기");
    const copy = makeElement("p", "", note.textContent.trim());
    details.append(summary, copy);
    note.replaceWith(details);
  }
}

class SeriesNav extends HTMLElement {
  connectedCallback() {
    const series = getSeries(this.dataset.series);
    if (!series) {
      this.textContent = "시리즈 정보를 불러오지 못했습니다.";
      return;
    }

    const figure = makeElement(
      "figure",
      series.posts.length > 3 ? "banner banner--many" : "banner",
    );
    const image = document.createElement("img");
    image.src = new URL(series.cover, siteRoot);
    image.alt = series.coverAlt;
    image.width = 1600;
    image.height = 800;
    image.decoding = "async";

    const nav = document.createElement("nav");
    nav.className = "series-navigation";
    nav.setAttribute("aria-label", `${series.title} 글 목록`);
    const list = makeElement("ol", "banner__cards");
    for (const post of series.posts) {
      list.append(makePostCard(post, this.dataset.current));
    }
    nav.append(list);
    figure.append(image, nav);
    this.replaceChildren(figure);
  }
}

class SeriesSources extends HTMLElement {
  connectedCallback() {
    const series = getSeries(this.dataset.series);
    if (!series) {
      this.textContent = "자료 정보를 불러오지 못했습니다.";
      return;
    }

    const list = makeElement("ul", "sources");
    for (const source of series.sources ?? []) {
      if (source.id !== this.dataset.current) {
        list.append(makeSourceCard(source));
      }
    }

    if (this.hasAttribute("data-include-series")) {
      list.append(makeSeriesContextCard(series));
    }

    this.replaceChildren(list);
  }
}

class SourceModuleLinks extends HTMLElement {
  connectedCallback() {
    const series = getSeries(this.dataset.series);
    const sourceModules = series?.sourceModuleLinks ?? [];
    if (!series || !sourceModules.length) {
      this.textContent = "원자료 모듈 정보를 불러오지 못했습니다.";
      return;
    }

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", `${series.title} 원자료 모듈 이동`);
    const list = makeElement("ul", "sources");
    for (const source of sourceModules) {
      if (source.id !== this.dataset.current) {
        list.append(makeSourceCard(source));
      }
    }

    this.replaceChildren(nav);
    nav.append(list);
  }
}

class SeriesPostLinks extends HTMLElement {
  connectedCallback() {
    const series = getSeries(this.dataset.series);
    if (!series) {
      this.textContent = "시리즈 글 정보를 불러오지 못했습니다.";
      return;
    }

    const nav = makeElement("nav", "serieslinks");
    nav.setAttribute("aria-label", `${series.title} 글 바로가기`);

    series.posts.forEach((post, index) => {
      const isCurrent = post.id === this.dataset.current;
      const item = isCurrent
        ? makeElement("span", "self")
        : document.createElement("a");

      if (isCurrent) {
        item.setAttribute("aria-current", "page");
      } else {
        item.href = new URL(post.href, siteRoot);
      }

      item.textContent = `(${index + 1}) ${post.title}`;
      nav.append(item);
    });

    this.style.display = "block";
    this.replaceChildren(nav);
  }
}

class SeriesLibrary extends HTMLElement {
  connectedCallback() {
    const total = contentLibrary.series.length;
    const pageCount = Math.max(1, Math.ceil(total / SERIES_PAGE_SIZE));
    this.page = 1;
    const status = makeElement(
      "p",
      "series-library__status",
      `${total}개 시리즈 · 한 페이지에 ${SERIES_PAGE_SIZE}개`,
    );
    const list = makeElement("ol", "library-grid");
    list.id = "series-library-grid";

    const makeSeriesCard = (series, index) => {
      const item = document.createElement("li");
      const article = makeElement("article", "library-card");
      const link = document.createElement("a");
      link.href = new URL(series.href, siteRoot);

      const image = document.createElement("img");
      image.src = new URL(series.cover, siteRoot);
      image.alt = "";
      image.width = 1600;
      image.height = 800;
      image.decoding = "async";
      if (index === 0) image.fetchPriority = "high";

      const copy = makeElement("span", "library-card__copy");
      const meta = makeElement("span", "library-card__meta");
      meta.append(
        makeElement("span", "", series.label),
        makeElement(
          "span",
          "",
          // 바탕 자료가 없는 시리즈에 "자료 0개"를 찍지 않는다
          `${series.period} · 포스팅 ${series.posts.length}개` +
            (series.sources?.length ? ` · 자료 ${series.sources.length}개` : ""),
        ),
      );
      copy.append(
        meta,
        makeElement("span", "library-card__title", series.title),
        makeElement("span", "library-card__description", series.description),
        makeElement("span", "library-card__action", "시리즈 보기 →"),
      );

      link.append(image, copy);
      article.append(link);
      item.append(article);
      return item;
    };

    const pager = makeElement("nav", "series-pager");
    pager.setAttribute("aria-label", "시리즈 페이지");
    const previous = makeElement("button", "series-pager__direction", "←");
    previous.type = "button";
    previous.setAttribute("aria-label", "이전 시리즈 페이지");
    previous.setAttribute("aria-controls", list.id);
    const rail = makeElement("div", "series-pager__rail");
    const pageStatus = makeElement("p", "series-pager__status");
    pageStatus.setAttribute("aria-live", "polite");
    const pageSegments = makeElement("div", "series-pager__segments");
    pageSegments.setAttribute("role", "group");
    pageSegments.setAttribute("aria-label", "시리즈 페이지 선택");
    const pageButtons = Array.from({ length: pageCount }, (_, index) => {
      const button = makeElement("button", "series-pager__segment");
      button.type = "button";
      button.setAttribute("aria-label", `${index + 1}번째 시리즈 페이지`);
      button.addEventListener("click", () => {
        this.page = index + 1;
        render();
      });
      pageSegments.append(button);
      return button;
    });
    const pageHint = makeElement("p", "series-pager__hint");
    rail.append(pageStatus, pageSegments, pageHint);
    const next = makeElement("button", "series-pager__direction", "→");
    next.type = "button";
    next.setAttribute("aria-label", "다음 시리즈 페이지");
    next.setAttribute("aria-controls", list.id);
    pager.append(previous, rail, next);

    const render = () => {
      const start = (this.page - 1) * SERIES_PAGE_SIZE;
      const pageSeries = contentLibrary.series.slice(
        start,
        start + SERIES_PAGE_SIZE,
      );
      list.replaceChildren(
        ...pageSeries.map((series, index) => makeSeriesCard(series, start + index)),
      );
      pageStatus.textContent = `${start + 1}–${start + pageSeries.length} / ${total}`;
      const nextCount = Math.min(
        SERIES_PAGE_SIZE,
        Math.max(0, total - (start + pageSeries.length)),
      );
      pageHint.textContent = nextCount
        ? `다음 화면에 ${nextCount}개 시리즈`
        : "전체 시리즈를 모두 확인했습니다";
      pageButtons.forEach((button, index) => {
        const active = index + 1 === this.page;
        button.setAttribute("aria-current", active ? "page" : "false");
      });
      previous.disabled = this.page === 1;
      next.disabled = this.page === pageCount;
      pager.hidden = pageCount === 1;
    };

    previous.addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      render();
    });
    next.addEventListener("click", () => {
      this.page = Math.min(pageCount, this.page + 1);
      render();
    });

    this.replaceChildren(status, list, pager);
    render();
  }
}

class ArchiveLibrary extends HTMLElement {
  connectedCallback() {
    this.items = makeArchiveItems();
    this.topics = [...new Set(this.items.flatMap((item) => item.topics ?? []))]
      .sort((a, b) => a.localeCompare(b, "ko"));
    this.years = [
      ...new Set(
        this.items.flatMap((item) => [
          ...(item.published ? [item.published.slice(0, 4)] : []),
          ...(item.sourceYears ?? []).map(String),
        ]),
      ),
    ].sort((a, b) => Number(b) - Number(a));
    this.keywords = [
      ...new Set(this.items.flatMap((item) => item.keywords ?? [])),
    ];

    const parameters = new URL(location.href).searchParams;
    const requestedPage = Number.parseInt(parameters.get("page") ?? "1", 10);
    this.page = Number.isFinite(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const selectParameter = (name, values, fallback) => {
      const value = parameters.get(name);
      return value && values.includes(value) ? value : fallback;
    };
    this.state = {
      q: parameters.get("q") ?? "",
      type: selectParameter("type", ["all", "post", "source"], "all"),
      year: selectParameter("year", ["all", ...this.years], "all"),
      topic: selectParameter("topic", ["all", ...this.topics], "all"),
      tag: selectParameter("tag", this.keywords, ""),
      sort: selectParameter(
        "sort",
        ["newest", "oldest", "series"],
        "newest",
      ),
    };

    this.form = makeElement("form", "archive-controls");
    this.form.setAttribute("role", "search");

    const search = makeElement("label", "archive-field archive-field--search");
    search.append(makeElement("span", "", "검색"));
    this.searchInput = document.createElement("input");
    this.searchInput.type = "search";
    this.searchInput.name = "q";
    this.searchInput.value = this.state.q;
    this.searchInput.placeholder = "제목·설명·키워드 검색";
    search.append(this.searchInput);

    const type = this.makeSelect(
      "type",
      "자료 유형",
      [
        ["all", "전체"],
        ["post", "포스팅"],
        ["source", "원자료"],
      ],
      this.state.type,
    );
    const year = this.makeSelect(
      "year",
      "관련 연도",
      [["all", "모든 연도"], ...this.years.map((value) => [value, value])],
      this.state.year,
    );
    const sort = this.makeSelect(
      "sort",
      "정렬",
      [
        ["newest", "최신 발행순"],
        ["oldest", "오래된 발행순"],
        ["series", "시리즈순"],
      ],
      this.state.sort,
    );
    const reset = makeElement("button", "archive-reset", "필터 지우기");
    reset.type = "reset";

    const topicFieldset = makeElement("fieldset", "archive-topics");
    topicFieldset.append(makeElement("legend", "", "주제"));
    this.topicButtons = makeElement("div", "archive-topics__buttons");
    const makeTopicButton = (topic) => {
      const count =
        topic === "all"
          ? this.items.length
          : this.items.filter((item) => item.topics?.includes(topic)).length;
      const button = makeElement(
        "button",
        "archive-topic",
        `${topic === "all" ? "전체" : topic} ${count}`,
      );
      button.type = "button";
      button.dataset.topic = topic;
      return button;
    };
    this.topicButtons.append(
      makeTopicButton("all"),
      ...this.topics
        .slice(0, EXPLORE_PRIMARY_TOPIC_LIMIT)
        .map(makeTopicButton),
    );
    const additionalTopics = this.topics.slice(EXPLORE_PRIMARY_TOPIC_LIMIT);
    if (additionalTopics.length) {
      const moreTopics = makeElement("details", "archive-topics__more");
      const summary = makeElement(
        "summary",
        "",
        `주제 ${additionalTopics.length}개 더 보기`,
      );
      const additionalButtons = makeElement(
        "div",
        "archive-topics__additional",
      );
      additionalButtons.append(...additionalTopics.map(makeTopicButton));
      moreTopics.append(summary, additionalButtons);
      this.topicButtons.append(moreTopics);
    }
    topicFieldset.append(this.topicButtons);

    this.form.append(search, type, year, sort, reset, topicFieldset);
    this.activeFilters = makeElement("div", "archive-active-filters");
    this.activeFilters.setAttribute("aria-live", "polite");
    this.results = makeElement("ol", "archive-results");
    this.results.id = "archive-results";
    this.pagination = makeElement("nav", "archive-pagination");
    this.pagination.setAttribute("aria-label", "검색 결과 페이지");
    this.previousButton = makeElement(
      "button",
      "archive-pagination__button",
      "←",
    );
    this.previousButton.type = "button";
    this.previousButton.setAttribute("aria-label", "이전 검색 결과 페이지");
    this.previousButton.setAttribute("aria-controls", this.results.id);
    this.resultProgress = makeElement("p", "archive-pagination__progress");
    this.resultProgress.setAttribute("aria-live", "polite");
    this.nextButton = makeElement(
      "button",
      "archive-pagination__button",
      "→",
    );
    this.nextButton.type = "button";
    this.nextButton.setAttribute("aria-label", "다음 검색 결과 페이지");
    this.nextButton.setAttribute("aria-controls", this.results.id);
    this.pagination.append(
      this.previousButton,
      this.resultProgress,
      this.nextButton,
    );
    this.empty = makeElement(
      "p",
      "archive-empty",
      "조건에 맞는 기록이 없습니다. 검색어 또는 필터를 바꿔 보세요.",
    );
    this.empty.hidden = true;

    this.replaceChildren(
      this.form,
      this.activeFilters,
      this.results,
      this.pagination,
      this.empty,
    );
    this.form.addEventListener("input", () => this.readForm());
    this.form.addEventListener("change", () => this.readForm());
    this.form.addEventListener("reset", () => {
      requestAnimationFrame(() => {
        this.state = {
          q: "",
          type: "all",
          year: "all",
          topic: "all",
          tag: "",
          sort: "newest",
        };
        this.page = 1;
        this.syncForm();
        this.render();
      });
    });
    this.topicButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-topic]");
      if (!button) return;
      this.state.topic = button.dataset.topic;
      this.page = 1;
      this.render();
    });
    this.results.addEventListener("click", (event) => {
      const link = event.target.closest(
        ".archive-item__topics a, .archive-item__keywords a",
      );
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href);
      this.state.topic = url.searchParams.get("topic") ?? this.state.topic;
      this.state.tag = url.searchParams.get("tag") ?? "";
      this.page = 1;
      this.syncForm();
      this.render();
      this.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    this.activeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-clear]");
      if (!button) return;
      this.state[button.dataset.clear] =
        button.dataset.clear === "topic" ? "all" : "";
      this.page = 1;
      this.syncForm();
      this.render();
    });
    this.previousButton.addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      this.render();
    });
    this.nextButton.addEventListener("click", () => {
      this.page += 1;
      this.render();
    });

    this.syncForm();
    this.render();
  }

  makeSelect(name, labelText, options, value) {
    const label = makeElement("label", "archive-field");
    label.append(makeElement("span", "", labelText));
    const select = document.createElement("select");
    select.name = name;
    for (const [optionValue, optionLabel] of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      select.append(option);
    }
    select.value = value;
    label.append(select);
    return label;
  }

  readForm() {
    const data = new FormData(this.form);
    this.state.q = String(data.get("q") ?? "").trim();
    this.state.type = String(data.get("type") ?? "all");
    this.state.year = String(data.get("year") ?? "all");
    this.state.sort = String(data.get("sort") ?? "newest");
    this.page = 1;
    this.render();
  }

  syncForm() {
    this.form.elements.q.value = this.state.q;
    this.form.elements.type.value = this.state.type;
    this.form.elements.year.value = this.state.year;
    this.form.elements.sort.value = this.state.sort;
  }

  syncUrl() {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(this.state)) {
      if (!value || value === "all" || value === "newest") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    if (this.page > 1) {
      url.searchParams.set("page", String(this.page));
    } else {
      url.searchParams.delete("page");
    }
    history.replaceState(null, "", url);
  }

  render() {
    const query = normaliseSearchText(this.state.q);
    const items = this.items
      .filter((item) => {
        const years = [
          ...(item.published ? [item.published.slice(0, 4)] : []),
          ...(item.sourceYears ?? []).map(String),
        ];
        const searchable = normaliseSearchText(
          [
            item.title,
            item.description,
            item.seriesTitle,
            ...(item.topics ?? []),
            ...(item.keywords ?? []),
          ].join(" "),
        );
        return (
          (!query || searchable.includes(query)) &&
          (this.state.type === "all" || item.kind === this.state.type) &&
          (this.state.year === "all" || years.includes(this.state.year)) &&
          (this.state.topic === "all" ||
            item.topics?.includes(this.state.topic)) &&
          (!this.state.tag || item.keywords?.includes(this.state.tag))
        );
      })
      .sort((a, b) => {
        if (this.state.sort === "series") {
          return (
            a.seriesTitle.localeCompare(b.seriesTitle, "ko") ||
            a.title.localeCompare(b.title, "ko")
          );
        }
        const direction = this.state.sort === "oldest" ? 1 : -1;
        return (
          (a.published ?? "").localeCompare(b.published ?? "") * direction ||
          a.title.localeCompare(b.title, "ko")
        );
      });

    const pageCount = Math.max(1, Math.ceil(items.length / EXPLORE_PAGE_SIZE));
    this.page = Math.min(this.page, pageCount);
    const start = (this.page - 1) * EXPLORE_PAGE_SIZE;
    const visibleItems = items.slice(start, start + EXPLORE_PAGE_SIZE);
    this.results.replaceChildren(...visibleItems.map(makeArchiveResult));
    this.empty.hidden = items.length > 0;
    this.results.hidden = items.length === 0;
    this.pagination.hidden = items.length <= EXPLORE_PAGE_SIZE;
    this.resultProgress.textContent = items.length
      ? `${this.page}/${pageCount} 페이지 · ${start + 1}–${start + visibleItems.length}/${items.length}`
      : "0개 결과";
    this.previousButton.disabled = this.page === 1;
    this.nextButton.disabled = this.page === pageCount;

    for (const button of this.topicButtons.querySelectorAll("[data-topic]")) {
      const active = button.dataset.topic === this.state.topic;
      button.setAttribute("aria-pressed", String(active));
    }

    this.activeFilters.replaceChildren();
    for (const [key, label, value] of [
      ["topic", "주제", this.state.topic === "all" ? "" : this.state.topic],
      ["tag", "키워드", this.state.tag],
    ]) {
      if (!value) continue;
      const button = makeElement(
        "button",
        "archive-active-filter",
        `${label} · ${value} ×`,
      );
      button.type = "button";
      button.dataset.clear = key;
      button.setAttribute("aria-label", `${label} ${value} 필터 지우기`);
      this.activeFilters.append(button);
    }
    this.syncUrl();
  }
}

class ContentFacets extends HTMLElement {
  connectedCallback() {
    const series = getSeries(this.dataset.series);
    const items = [
      ...(series?.posts ?? []),
      ...(series?.sources ?? []),
      ...(series?.sourceModuleLinks ?? []),
    ];
    const content = items.find(
      (item) => item.id === (this.dataset.post ?? this.dataset.source),
    );
    if (!content) return;

    const list = makeElement("dl", "content-facets");
    for (const [label, values, parameter] of [
      ["관련 연도", content.sourceYears, "year"],
      ["주제", content.topics, "topic"],
      ["키워드", content.keywords, "tag"],
    ]) {
      if (!values?.length) continue;
      const wrapper = makeElement("div", "content-facets__group");
      wrapper.append(
        makeElement("dt", "", label),
        makeElement("dd", ""),
      );
      wrapper.lastElementChild.append(
        makeFacetList("content-facets__links", values, parameter),
      );
      list.append(wrapper);
    }
    this.replaceChildren(list);
  }
}

class TranscriptReader extends HTMLElement {
  connectedCallback() {
    const talks = [...this.parentElement.querySelectorAll(":scope > .talk")];
    if (!talks.length) return;
    const sectionCount = talks.reduce(
      (total, talk) =>
        total + talk.querySelectorAll(":scope > .tr__sec").length,
      0,
    );

    const aside = makeElement("aside", "transcript-index");
    const details = document.createElement("details");
    const summary = makeElement(
      "summary",
      "",
      `발표 목차 · ${sectionCount}개 구간`,
    );
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "발화 기록 구간 목차");
    const talkList = makeElement("ol", "transcript-index__talks");
    nav.append(talkList);
    details.append(summary, nav);
    aside.append(details);

    talks.forEach((talk, talkIndex) => {
      talk.id = `talk-${talkIndex + 1}`;
      const markers = [...talk.querySelectorAll(":scope > .tr__sec")];
      const navItem = document.createElement("li");
      const talkLink = document.createElement("a");
      talkLink.href = `#${talk.id}`;
      talkLink.textContent = keepHyphenatedTermsTogether(
        talk.querySelector(".talk__t")?.textContent ??
          `발표 ${talkIndex + 1}`,
      );
      const sectionList = makeElement("ol", "transcript-index__sections");
      navItem.append(talkLink, sectionList);
      talkList.append(navItem);

      const count = makeElement(
        "span",
        "talk__count",
        `${markers.length}개 구간`,
      );
      talk.querySelector(".talk__h")?.append(count);

      markers.forEach((marker, sectionIndex) => {
        const following = [];
        let node = marker.nextElementSibling;
        while (node && !node.classList.contains("tr__sec")) {
          following.push(node);
          node = node.nextElementSibling;
        }

        const segment = makeElement("section", "tr__segment");
        segment.id = `talk-${talkIndex + 1}-section-${sectionIndex + 1}`;
        marker.before(segment);
        const number = makeElement(
          "span",
          "tr__number",
          String(sectionIndex + 1).padStart(2, "0"),
        );
        marker.prepend(number);
        segment.append(marker, ...following);
        normaliseTranscriptSegment(segment);

        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${segment.id}`;
        link.textContent = marker.querySelector("h3")?.textContent ?? "";
        item.append(link);
        sectionList.append(item);
      });
    });

    const body = makeElement("div", "transcript-reader__body");
    const grid = makeElement("div", "transcript-reader");
    talks[0].before(grid);
    body.append(...talks);
    grid.append(aside, body);
    this.replaceWith(grid);

    const desktop = matchMedia("(min-width: 70rem)");
    const updateDisclosure = () => {
      details.open = desktop.matches;
    };
    updateDisclosure();
    desktop.addEventListener("change", updateDisclosure);
  }
}

customElements.define("series-nav", SeriesNav);
customElements.define("series-sources", SeriesSources);
customElements.define("source-module-links", SourceModuleLinks);
customElements.define("series-post-links", SeriesPostLinks);
customElements.define("series-library", SeriesLibrary);
customElements.define("archive-library", ArchiveLibrary);
customElements.define("content-facets", ContentFacets);
customElements.define("transcript-reader", TranscriptReader);
