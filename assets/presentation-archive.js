(function () {
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.pa-toc a[href^="#"]'),
  );
  if (!links.length || !("IntersectionObserver" in window)) return;

  var sections = links
    .map(function (link) {
      return document.getElementById(link.getAttribute("href").slice(1));
    })
    .filter(Boolean);

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.setAttribute(
            "aria-current",
            link.getAttribute("href") === "#" + entry.target.id ? "true" : "false",
          );
        });
      });
    },
    { rootMargin: "-10% 0px -75% 0px" },
  );

  sections.forEach(function (section) {
    observer.observe(section);
  });
})();
