const register = document.querySelector("[data-archive-inventory]");

if (register) {
  const rows = Array.from(register.querySelectorAll(".arc-stock__row"));
  const search = register.querySelector("[data-archive-inventory-search]");
  const filters = Array.from(register.querySelectorAll("[data-archive-inventory-filter]"));
  const filterCounts = Array.from(
    register.querySelectorAll("[data-archive-inventory-filter-count]"),
  );
  const count = register.querySelector("[data-archive-inventory-count]");
  const empty = register.querySelector("[data-archive-inventory-empty]");

  const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("ko-KR");
  let activeFilter = "all";

  for (const item of filterCounts) {
    const access = item.dataset.archiveInventoryFilterCount;
    item.textContent = String(
      access === "all"
        ? rows.length
        : rows.filter((row) => row.dataset.access === access).length,
    );
  }

  function rowText(row) {
    return normalize([
      row.dataset.title,
      row.dataset.meta,
      row.dataset.description,
      row.dataset.access,
    ].join(" "));
  }

  function applyState() {
    const query = normalize(search?.value);
    let visible = 0;

    for (const row of rows) {
      const matchesFilter = activeFilter === "all" || row.dataset.access === activeFilter;
      const matchesQuery = !query || rowText(row).includes(query);
      const isVisible = matchesFilter && matchesQuery;
      row.hidden = !isVisible;
      if (isVisible) visible += 1;
    }

    if (count) {
      count.textContent = `${visible}개 결과 · 목록 안에서 스크롤`;
    }
    if (empty) {
      empty.hidden = visible > 0;
    }
  }

  search?.addEventListener("input", applyState);
  for (const filter of filters) {
    filter.addEventListener("click", () => {
      activeFilter = filter.dataset.archiveInventoryFilter ?? "all";
      for (const item of filters) {
        item.setAttribute("aria-pressed", String(item === filter));
      }
      applyState();
    });
  }

  applyState();
}
