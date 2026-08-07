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

    // 폭 대신 자식의 위치를 기준으로 삼는다. clientWidth 는 레이아웃 시점에 따라 0 으로
    // 읽히는 구간이 있어서(라이브 실측), 그것에 기대면 단추가 통째로 죽는다.
    function offsets() {
      var base = strip.children[0].offsetLeft;
      return Array.prototype.map.call(strip.children, function (c) {
        return c.offsetLeft - base;
      });
    }
    function index() {
      var o = offsets(), sl = strip.scrollLeft, best = 0, gap = Infinity;
      for (var i = 0; i < o.length; i++) {
        var d = Math.abs(o[i] - sl);
        if (d < gap) { gap = d; best = i; }
      }
      return best;
    }
    // 목표 장을 상태로 들고 간다. 스크롤 위치만 보고 판단하면 연속 클릭이
    // 애니메이션이 끝나기 전의 같은 위치를 읽어 한 칸에서 멈춘다.
    var cur = 0;
    var lockUntil = 0;

    function refresh() {
      var i = Date.now() < lockUntil ? cur : index();
      cur = i;
      count.textContent = (i + 1) + " / " + n;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
    }
    function go(d) {
      var o = offsets();
      var i = Math.min(n - 1, Math.max(0, cur + d));
      if (i === cur) return;
      cur = i;
      lockUntil = Date.now() + 700;
      var reduce = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        strip.scrollTo({ left: o[i], behavior: reduce ? "auto" : "smooth" });
      } catch (e) {
        strip.scrollLeft = o[i];
      }
      refresh();
      // 부드러운 스크롤이 아예 돌지 않는 환경이 있다(실측). 제자리에 머물면 그냥 옮긴다.
      setTimeout(function () {
        if (Math.abs(strip.scrollLeft - o[i]) > 4) strip.scrollLeft = o[i];
      }, 420);
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    strip.addEventListener("scroll", function () { requestAnimationFrame(refresh); }, { passive: true });
    // 손으로 밀어 넘긴 경우의 동기화. scroll 만으로 두면 이벤트가 눌린 환경에서 카운터가 굳는다.
    ["pointerup", "touchend", "keyup"].forEach(function (ev) {
      strip.addEventListener(ev, function () {
        lockUntil = 0;
        setTimeout(refresh, 260);
      }, { passive: true });
    });
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
