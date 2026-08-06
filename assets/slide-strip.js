// 장표 묶음 뷰어 — 여러 장을 한 자리에서 좌우로 넘겨 본다.
// 마크업: <figure class="slides"><div class="slides__strip"><img>×N</div><figcaption>…</figcaption></figure>
// JS 없이도 strip 자체가 가로 스크롤로 동작한다. 여기서는 화살표 단추와 장 수 표시만 얹는다.
// 웹 전용 인터페이스라 Medium 판에는 존재하지 않는다(2026-08-07 본인 지시).
(function () {
  document.querySelectorAll("figure.slides").forEach(function (fig) {
    var strip = fig.querySelector(".slides__strip");
    if (!strip) return;
    var n = strip.children.length;
    if (n < 2) return;

    var bar = document.createElement("div");
    bar.className = "slides__bar";
    var prev = document.createElement("button");
    var next = document.createElement("button");
    var count = document.createElement("span");
    prev.type = "button";
    next.type = "button";
    prev.className = "slides__btn";
    next.className = "slides__btn";
    prev.setAttribute("aria-label", "이전 장");
    next.setAttribute("aria-label", "다음 장");
    prev.textContent = "←";
    next.textContent = "→";
    count.className = "slides__count";

    function index() {
      // 첫 레이아웃 전에 폭이 0으로 잡히는 시점이 있다 — 0 나눗셈이 NaN 카운터로 굳는 것을 막는다.
      var w = strip.clientWidth || 1;
      return Math.min(n - 1, Math.max(0, Math.round(strip.scrollLeft / w)));
    }
    function refresh() {
      var i = index();
      count.textContent = (i + 1) + " / " + n;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
    }
    function go(d) {
      strip.scrollBy({ left: d * strip.clientWidth, behavior: "smooth" });
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    strip.addEventListener("scroll", function () { requestAnimationFrame(refresh); }, { passive: true });
    window.addEventListener("resize", refresh);

    bar.appendChild(prev);
    bar.appendChild(count);
    bar.appendChild(next);
    var cap = fig.querySelector("figcaption");
    fig.insertBefore(bar, cap);
    refresh();
    requestAnimationFrame(refresh);
    window.addEventListener("load", refresh);
  });
})();
