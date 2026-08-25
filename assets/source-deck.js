/* 원자료 슬라이드 뷰어 — 코크리에이션 slides-2023-06 의 인라인 스크립트를 그대로 옮기고
   장표 경로만 window.DECK.dir 로 뺐다. 동작은 손대지 않았다(새 구현 금지).
   기준선 페이지는 아직 자기 인라인 사본을 쓴다(범위 밖) — 다음 회차에 이 파일로 모은다. */


(function(){
  var D = window.DECK, S = D.slides, C = D.chapters;
  var pv = document.getElementById('pv'), stage = document.getElementById('pvstage');
  var sorter = document.getElementById('pvsorter'), sgrid = document.getElementById('pvsgrid');
  var at = 0, opener = null, notesOn = false;

  function pad(n){ return String(n).padStart(3,'0'); }

  function render(){
    var s = S[at];
    stage.innerHTML = '';
    var img = new Image();
    img.src = (D.dir + 'slide-') + pad(s.n) + '.jpg';
    img.alt = '슬라이드 ' + s.n;
    img.decoding = 'async';
    stage.appendChild(img);
    // 영상은 PPTX 도형 좌표 그대로 얹고, 장표가 열리면 바로 재생한다(자동 재생).
    // 한 장에 여럿이면 소리가 겹치니 그때만 음소거한다.
    var many = s.v.length > 1;
    s.v.forEach(function(v, i){
      if (v.x) { return; }   // 재생본이 없는 영상 자리
      var d = document.createElement('div');
      d.className = 'pv__v';
      d.style.cssText = 'left:' + v.l + '%;top:' + v.t + '%;width:' + v.w + '%;height:' + v.h + '%';
      // 저작권 차단으로 유튜브 재생이 막힌 장표는 발표 자료 원본을 그대로 얹는다.
      d.innerHTML = v.f
        ? '<video src="' + (D.vdir || '') + v.f + '" autoplay loop playsinline '
          + (many ? 'muted ' : 'muted ') + 'controls preload="metadata" '
          + 'title="발표 중 재생한 영상' + (many ? ' ' + (i + 1) : '') + '"></video>'
        : '<iframe src="https://www.youtube-nocookie.com/embed/' + v.y +
        '?autoplay=1&rel=0&playsinline=1' + (many ? '&mute=1' : '') +
        '" title="발표 중 재생한 영상' + (many ? ' ' + (i + 1) : '') +
        '" allow="autoplay; fullscreen" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin"></iframe>';
      stage.appendChild(d);
    });

    var ch = C[s.c] || C[0];
    document.getElementById('pvch').textContent =
      (ch.n ? ch.n + '. ' : '') + ch.t + (s.s ? '  —  ' + s.s : '');
    document.getElementById('pvno').textContent = s.n;
    document.getElementById('pvprev').disabled = at === 0;
    document.getElementById('pvnext').disabled = at === S.length - 1;

    notes.innerHTML = s.k.length
      ? '<p class="sc">' + esc(s.s || '') + '</p><ul>' +
        s.k.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
      : '<p class="none">이 장표에는 따로 정리된 노트가 없다.</p>';
    notes.scrollTop = 0;            // 장표를 넘기면 노트도 처음부터
    fitStage();
    noteFade();

    var rail = document.getElementById('pvrail').children;
    for (var i = 0; i < rail.length; i++){
      rail[i].className = (i <= at ? 'on' : '') + (rail[i].dataset.cut ? ' cut' : '');
    }
    if (history.replaceState) history.replaceState(null, '', '#' + s.n);
  }

  function esc(t){
    return String(t).replace(/[&<>]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];
    });
  }

  function go(d){
    var i = at + d;
    if (i < 0 || i >= S.length) return;
    at = i; render();
  }

  // 무대를 남는 자리에 꼭 맞는 16:9 사각형으로 만든다. CSS로 두면 가로가 넓을 때
  // 높이만 깎여 비율이 깨지므로 픽셀로 계산해 박는다.
  var fit = document.getElementById('pvfit');
  var notes = document.getElementById('pvnotesbox');
  function fitStage(){
    if (pv.hidden) return;
    // 재는 동안 무대를 0으로 접는다. 무대가 남은 자리보다 크면 부모를 밀어
    // 넓혀서, 그 부모를 재면 줄어들 수가 없다(자기 크기를 자기가 재는 꼴).
    stage.style.width = '0px';
    stage.style.height = '0px';
    var r = fit.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var w = Math.floor(Math.min(r.width, r.height * 16 / 9));
    stage.style.width = w + 'px';
    stage.style.height = Math.floor(w * 9 / 16) + 'px';
  }

  // 노트가 잘렸는지에 따라 위·아래 페이드를 켠다
  function noteFade(){
    var top = notes.scrollTop > 2 ? '1' : '0';
    var bot = notes.scrollTop + notes.clientHeight < notes.scrollHeight - 2 ? '1' : '0';
    notes.setAttribute('data-top', top);
    notes.setAttribute('data-bot', bot);
  }
  notes.addEventListener('scroll', noteFade);
  window.addEventListener('resize', function(){ fitStage(); noteFade(); });
  // 남는 자리는 창 크기 말고도 바뀐다(AI 노트 열고 닫기, 주소창 접힘 등).
  // 그때마다 다시 맞추지 않으면 무대가 남은 높이를 넘어 잘린다.
  if (window.ResizeObserver){
    new ResizeObserver(function(){ fitStage(); noteFade(); }).observe(fit);
  }

  function open(n){
    at = Math.max(0, Math.min(S.length - 1, n - 1));
    pv.hidden = false;
    document.body.style.overflow = 'hidden';
    fitStage();
    render();
    document.getElementById('pvnext').focus();
  }

  function close(){
    pv.hidden = true;
    sorter.hidden = true;
    document.getElementById('pvgrid').setAttribute('aria-pressed', 'false');
    stage.innerHTML = '';           // 재생 중이던 iframe을 확실히 끊는다
    document.body.style.overflow = '';
    if (history.replaceState) history.replaceState(null, '', location.pathname);
    if (opener) opener.focus();
  }

  // 전체 보기 — 파워포인트 슬라이드 정렬기처럼 96장을 썸네일로 편다.
  // 아무 장표나 누르면 그 자리에서 슬라이드쇼가 이어진다.
  function buildSorter(){
    if (sgrid.children.length) return;
    sgrid.innerHTML = S.map(function(s, i){
      return '<li><button type="button" class="pv__sc" data-i="' + i + '" aria-label="슬라이드 ' + s.n + '로 이동">' +
        '<img src="' + D.dir + 'thumb-' + pad(s.n) + '.jpg" alt="" loading="lazy" decoding="async">' +
        '<span class="pv__scn">' + pad(s.n) + (s.v.length ? ' <b>▶</b>' : '') + '</span>' +
        '</button></li>';
    }).join('');
  }
  function toggleSorter(){
    var opening = sorter.hidden;
    if (opening){
      buildSorter();
      Array.prototype.forEach.call(sgrid.children, function(li, i){
        li.firstChild.classList.toggle('now', i === at);
      });
      sorter.hidden = false;
      var cur = sgrid.children[at];
      if (cur) cur.scrollIntoView({block: 'center'});
    } else {
      sorter.hidden = true;
    }
    document.getElementById('pvgrid').setAttribute('aria-pressed', opening);
  }

  // 진행 막대 — 챕터가 바뀌는 칸에 눈금
  var rail = document.getElementById('pvrail');
  S.forEach(function(s, i){
    var el = document.createElement('span');
    if (i > 0 && s.c !== S[i-1].c){ el.dataset.cut = '1'; }
    el.title = '슬라이드 ' + s.n;
    el.addEventListener('click', function(){ at = i; render(); });
    el.style.cursor = 'pointer';
    rail.appendChild(el);
  });

  var motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 좌표로 직접 옮긴다. 브라우저 기본 앵커 이동에 기대지 않아 어느 환경에서든
  // 같은 자리로 간다. 움직임을 줄이는 설정이면 곧바로, 아니면 부드럽게.
  function scrollToY(y){
    y = Math.max(0, y);
    try { window.scrollTo({top: y, behavior: motionOK ? 'smooth' : 'auto'}); }
    catch (_) { window.scrollTo(0, y); }
  }

  document.addEventListener('click', function(e){
    var g = e.target.closest('[data-go]');
    if (g){ opener = g; open(+g.dataset.go); return; }
    // 챕터 표지 CTA — 그 페이지 위치로 스크롤한다(슬라이드쇼는 열지 않는다).
    var ct = e.target.closest('.chap__ct');
    if (ct){
      e.preventDefault();
      var tgt = document.getElementById(ct.getAttribute('href').slice(1));
      if (tgt) scrollToY(tgt.getBoundingClientRect().top + window.pageYOffset - 24);
      return;
    }
    if (pv.hidden) return;
    var id = e.target.id;
    if (id === 'pvprev') go(-1);
    if (id === 'pvnext') go(1);
    if (id === 'pvclose') close();
    if (id === 'pvgrid' || id === 'pvsortclose') toggleSorter();
    var cell = e.target.closest('.pv__sc');
    if (cell){
      at = +cell.dataset.i;
      sorter.hidden = true;
      document.getElementById('pvgrid').setAttribute('aria-pressed', 'false');
      render();
    }
    if (id === 'pvnotes'){
      notesOn = !notesOn;
      notes.hidden = !notesOn;
      e.target.setAttribute('aria-pressed', notesOn);
      fitStage();                 // 노트가 열리고 닫히면 무대에 남는 높이가 바뀐다
      noteFade();
    }
    if (id === 'pvfull'){
      if (document.fullscreenElement) document.exitFullscreen();
      else if (pv.requestFullscreen) pv.requestFullscreen();
    }
  });

  document.addEventListener('keydown', function(e){
    if (pv.hidden) return;
    var k = e.key;
    // 전체 보기가 열려 있으면 Esc로 그것부터 닫고, 넘기기는 막는다
    if (!sorter.hidden){
      if (k === 'Escape'){ toggleSorter(); }
      return;
    }
    if (k === 'Escape'){ if (!document.fullscreenElement) close(); return; }
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' '){ e.preventDefault(); go(1); }
    if (k === 'ArrowLeft' || k === 'PageUp'){ e.preventDefault(); go(-1); }
    if (k === 'Home'){ e.preventDefault(); at = 0; render(); }
    if (k === 'End'){ e.preventDefault(); at = S.length - 1; render(); }
  });

  // 손가락으로 넘기기. 세로 스크롤과 헷갈리지 않게 가로 이동이 뚜렷할 때만.
  var tx = 0, ty = 0;
  stage.addEventListener('touchstart', function(e){
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, {passive: true});
  stage.addEventListener('touchend', function(e){
    if (stage.querySelector('iframe')) return;   // video는 자동 재생이라 잠그지 않는다       // 재생 중에는 넘기지 않는다
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, {passive: true});

  // 주소에 #42 가 붙어 오면 그 장표부터 연다
  var h = parseInt(location.hash.slice(1), 10);
  if (h >= 1 && h <= S.length) open(h);

  // 차례의 현재 위치
  var links = document.querySelectorAll('.toc a[href^="#ch"]');
  var obs = new IntersectionObserver(function(es){
    es.forEach(function(en){
      if (!en.isIntersecting) return;
      links.forEach(function(a){
        a.setAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id);
      });
    });
  }, {rootMargin: '-10% 0px -80% 0px'});
  document.querySelectorAll('.chap').forEach(function(s){ obs.observe(s); });

  // 챕터 표지 썸네일: 두 줄 창 + 위·아래 페이드 마스크 + 스크롤.
  // 격자를 런타임에 스크롤 창으로 감싸므로 HTML 구조는 그대로 둔다.
  document.querySelectorAll('.chap__ctagrid').forEach(function(grid){
    var wrap = document.createElement('div');
    wrap.className = 'chap__ctascroll';
    grid.parentNode.insertBefore(wrap, grid);
    wrap.appendChild(grid);
    function upd(){
      var fade = +wrap.dataset.fade || 0;
      var top = wrap.scrollTop > 1;
      var bot = wrap.scrollTop + wrap.clientHeight < wrap.scrollHeight - 1;
      wrap.style.setProperty('--ft', top ? fade + 'px' : '0px');
      wrap.style.setProperty('--fb', bot ? fade + 'px' : '0px');
    }
    function measure(){
      var cells = grid.children;
      if (!cells.length){ return; }
      // 행 높이를 DOM 실측이 아니라 산술로 구한다. 셀은 12열(모바일 5열)·
      // 간격 3px·1px 테두리·16:9 고정이므로 격자 폭만 있으면 결정된다.
      // 실측 방식은 lazy 썸네일이 화면 밖에서 로드되지 않아 로드 전
      // 스냅샷(엉뚱한 행높이)이 영구 박제되는 버그가 있었다(2026-07-24).
      var cs = getComputedStyle(grid);
      var cols = cs.gridTemplateColumns.split(' ').length;
      var gap = parseFloat(cs.rowGap) || 3;
      var gridW = grid.clientWidth;
      if (gridW < 40){ return; }
      var colW = (gridW - gap * (cols - 1)) / cols;
      var rowH = (colW - 2) * 9 / 16 + 2;   // 테두리 2px 포함
      var stride = rowH + gap;
      var rows = Math.ceil(cells.length / cols);
      var gridH = rows * rowH + (rows - 1) * gap;
      var fade = Math.round(rowH * 0.85);
      wrap.dataset.fade = fade;
      // 두 줄 + 페이드 한 겹. 내용이 그보다 낮으면(두 줄 이하) 딱 맞춰 마스크·스크롤이 없다.
      wrap.style.height = Math.round(Math.min(stride * 2 + fade, gridH)) + 'px';
      upd();
    }
    wrap.addEventListener('scroll', upd, { passive: true });
    measure();
    setTimeout(measure, 80);               // 레이아웃 안정 후 한 번 더
    window.addEventListener('resize', measure);
    grid.querySelectorAll('img').forEach(function(im){
      if (!im.complete) im.addEventListener('load', measure, { once: true });
    });
  });
})();

