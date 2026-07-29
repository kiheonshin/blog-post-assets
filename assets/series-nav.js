/* 배포마다 이 버전을 올린다. GitHub Pages가 자산에 max-age=600을 걸어
   HTML만 새로 받고 모듈은 캐시에서 꺼내 쓰는 일이 생긴다. 그러면 새 시리즈가
   목록에서 빠지고 "시리즈 정보를 불러오지 못했습니다"가 뜬다(2026-07-25 실증).
   페이지의 series-nav.js?v= 값과 반드시 같이 올릴 것. */
import { contentLibrary, getSeries } from "./content-manifest.js?v=20260729c";

const siteRoot = new URL("../", import.meta.url);

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
    const list = makeElement("ol", "library-grid");

    for (const series of contentLibrary.series) {
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
      list.append(item);
    }

    this.replaceChildren(list);
  }
}

customElements.define("series-nav", SeriesNav);
customElements.define("series-sources", SeriesSources);
customElements.define("series-post-links", SeriesPostLinks);
customElements.define("series-library", SeriesLibrary);
