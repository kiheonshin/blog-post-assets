import { contentLibrary, getSeries } from "./content-manifest.js";

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
    makeElement("span", "", `NOTES · ${series.posts.length}부작`),
    makeElement("span", "", "→"),
  );

  link.append(
    meta,
    makeElement("span", "t", series.title),
    makeElement("span", "s", "이 원자료를 다시 읽고 쓴 글"),
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
      this.textContent = "원자료 정보를 불러오지 못했습니다.";
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
          `${series.period} · ${series.posts.length}편 · 원자료 ${series.sources?.length ?? 0}`,
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
