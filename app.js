/* Kotoba Studio — web app học từ vựng tiếng Nhật.
   Dữ liệu từ vựng nằm ở data/*.js (window.KOTOBA_DATA, window.KOTOBA_EXAMPLES).
   Tiến độ lưu trên máy (localStorage), tách riêng theo từng người học và từng cấp độ. */
(function () {
  'use strict';

  var APP_VERSION = '1.0';
  var STORE_KEY = 'kotoba.studio.v1';
  var LEVELS = [
    { code: 'N3', title: 'JLPT N3 · Trung cấp', color: '#2E5B45' },
    { code: 'N2', title: 'JLPT N2 · Trung cao cấp', color: '#24476B' },
    { code: 'N1', title: 'JLPT N1 · Cao cấp', color: '#8C3B2E' }
  ];
  var COLORS = ['#2E5B45', '#24476B', '#8C3B2E', '#6A4C93', '#7A5C12', '#2F6F73', '#9A4565', '#4E5D2C'];
  var MAX_PROFILES = 12;
  var AUTHOR = 'Ngô Tấn Đạt';

  var root = document.getElementById('app');
  if (!root) return;

  /* ---------------- dữ liệu từ vựng ---------------- */
  var DATA = (window.KOTOBA_DATA && typeof window.KOTOBA_DATA === 'object') ? window.KOTOBA_DATA : {};
  var EXAMPLES = (window.KOTOBA_EXAMPLES && typeof window.KOTOBA_EXAMPLES === 'object') ? window.KOTOBA_EXAMPLES : {};
  var wordCache = {};

  function words(code) {
    if (wordCache[code]) return wordCache[code];
    var src = Array.isArray(DATA[code]) ? DATA[code] : [];
    var list = [];
    var map = {};
    for (var i = 0; i < src.length; i++) {
      var w = src[i];
      if (!w || typeof w.w !== 'string' || !w.w || typeof w.id !== 'number' || map[w.id]) continue;
      map[w.id] = w;
      list.push(w);
    }
    list.sort(function (a, b) { return a.id - b.id; });
    wordCache[code] = { list: list, map: map, maxId: list.length ? list[list.length - 1].id : 0, minId: list.length ? list[0].id : 0 };
    return wordCache[code];
  }
  function exampleFor(code, id) {
    var lv = EXAMPLES[code];
    if (!lv || typeof lv !== 'object') return null;
    var e = lv[id];
    return (e && typeof e === 'object') ? e : null;
  }
  function exampleCount(code) {
    var lv = EXAMPLES[code];
    if (!lv || typeof lv !== 'object') return 0;
    var m = words(code).map, n = 0;
    for (var k in lv) if (Object.prototype.hasOwnProperty.call(lv, k) && m[k] && lv[k] && Array.isArray(lv[k].ex) && lv[k].ex.length) n++;
    return n;
  }

  /* ---------------- lưu trữ ---------------- */
  var storageOk = true;
  var storageWarned = false;

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function newProfile(n) {
    return { id: uid(), name: 'Người học ' + n, color: COLORS[(n - 1) % COLORS.length], lv: {} };
  }
  function defaultState() {
    var ps = [newProfile(1), newProfile(2), newProfile(3), newProfile(4)];
    return { v: 1, profiles: ps, active: null, level: 'N3', settings: {} };
  }
  function cleanIds(a) {
    if (!Array.isArray(a)) return [];
    var out = [], seen = {};
    for (var i = 0; i < a.length; i++) {
      var n = a[i];
      if (typeof n === 'number' && isFinite(n) && !seen[n]) { seen[n] = 1; out.push(n); }
    }
    return out;
  }
  function normalize(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.profiles)) return defaultState();
    var out = { v: 1, profiles: [], active: null, level: 'N3', settings: {} };
    for (var i = 0; i < s.profiles.length && out.profiles.length < MAX_PROFILES; i++) {
      var p = s.profiles[i];
      if (!p || typeof p !== 'object') continue;
      var np = {
        id: typeof p.id === 'string' && p.id ? p.id : uid(),
        name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 30) : 'Người học ' + (out.profiles.length + 1),
        color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : COLORS[out.profiles.length % COLORS.length],
        lv: {}
      };
      var lv = (p.lv && typeof p.lv === 'object') ? p.lv : {};
      for (var j = 0; j < LEVELS.length; j++) {
        var c = LEVELS[j].code, l = lv[c];
        if (!l || typeof l !== 'object') continue;
        np.lv[c] = {
          cur: typeof l.cur === 'number' ? l.cur : null,
          seen: cleanIds(l.seen),
          review: cleanIds(l.review),
          from: typeof l.from === 'number' ? l.from : null,
          to: typeof l.to === 'number' ? l.to : null,
          mode: l.mode === 'review' ? 'review' : 'all',
          shuffle: !!l.shuffle,
          seed: typeof l.seed === 'number' ? l.seed : 1
        };
      }
      var st = (p.settings && typeof p.settings === 'object') ? p.settings : {};
      np.settings = { kanaCard: !!st.kanaCard, kanaEx: st.kanaEx !== false, vi: st.vi !== false };
      out.profiles.push(np);
    }
    if (!out.profiles.length) return defaultState();
    if (typeof s.active === 'string') out.active = s.active;
    if (typeof s.level === 'string' && LEVELS.some(function (l) { return l.code === s.level; })) out.level = s.level;
    return out;
  }
  function loadState() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { storageOk = false; }
    if (!raw) return defaultState();
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      try { window.localStorage.setItem(STORE_KEY + '.hong', raw); } catch (e2) { /* bỏ qua */ }
      return defaultState();
    }
  }
  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
      if (!storageWarned) { storageWarned = true; toast('Máy này đang chặn lưu dữ liệu. Tiến độ sẽ mất khi đóng trang.'); }
    }
  }

  var state = loadState();
  state.profiles.forEach(function (p) { if (!p.settings) p.settings = { kanaCard: false, kanaEx: true, vi: true }; });

  /* ---------------- trạng thái giao diện (không lưu) ---------------- */
  var ui = {
    view: 'profiles',
    flipped: false,
    editing: null,
    confirmDelete: null,
    backup: false,
    restore: false,
    restoreReady: null,
    slide: '',
    list: null,
    listKey: ''
  };

  function profile() {
    for (var i = 0; i < state.profiles.length; i++) if (state.profiles[i].id === state.active) return state.profiles[i];
    return null;
  }
  function levelInfo(code) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].code === code) return LEVELS[i];
    return LEVELS[0];
  }
  function lvState(p, code) {
    if (!p.lv[code]) p.lv[code] = { cur: null, seen: [], review: [], from: null, to: null, mode: 'all', shuffle: false, seed: 1 };
    return p.lv[code];
  }
  function range(code, l) {
    var d = words(code);
    var from = l.from == null ? d.minId : l.from;
    var to = l.to == null ? d.maxId : l.to;
    if (from < d.minId) from = d.minId;
    if (to > d.maxId) to = d.maxId;
    if (from > to) { from = d.minId; to = d.maxId; }
    return { from: from, to: to };
  }
  function idsInRange(code, l) {
    var r = range(code, l), d = words(code), out = [];
    for (var i = 0; i < d.list.length; i++) if (d.list[i].id >= r.from && d.list[i].id <= r.to) out.push(d.list[i].id);
    return out;
  }
  function countIn(ids, inRange) {
    var set = {}, n = 0;
    for (var i = 0; i < inRange.length; i++) set[inRange[i]] = 1;
    for (var j = 0; j < ids.length; j++) if (set[ids[j]]) n++;
    return n;
  }
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = (seed >>> 0) || 1;
    function rnd() { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function studyList(p, code) {
    var l = lvState(p, code);
    var key = [p.id, code, l.mode, l.shuffle, l.seed, l.from, l.to].join('|');
    if (ui.list && ui.listKey === key) return ui.list;
    var ids = idsInRange(code, l);
    if (l.mode === 'review') {
      var rv = {};
      l.review.forEach(function (id) { rv[id] = 1; });
      ids = ids.filter(function (id) { return rv[id]; });
    }
    if (l.shuffle) ids = seededShuffle(ids, l.seed);
    ui.list = ids;
    ui.listKey = key;
    return ids;
  }
  function resetList() { ui.list = null; ui.listKey = ''; }

  /* ---------------- tiện ích ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initial(name) {
    var t = String(name || '').trim();
    if (!t) return '?';
    var parts = t.split(/\s+/);
    var last = parts[parts.length - 1];
    return Array.from(last)[0].toUpperCase();
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  var ICON = {
    sound: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    flip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
    left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    starOn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'
  };

  /* ---------------- phát âm ---------------- */
  var speakingKey = null;
  var jaVoice = null;
  function findVoice() {
    try {
      var vs = window.speechSynthesis.getVoices() || [];
      for (var i = 0; i < vs.length; i++) if (/^ja/i.test(vs[i].lang)) { jaVoice = vs[i]; return vs.length; }
      return vs.length;
    } catch (e) { return 0; }
  }
  if ('speechSynthesis' in window) {
    findVoice();
    try { window.speechSynthesis.onvoiceschanged = findVoice; } catch (e) { /* bỏ qua */ }
  }
  function markSpeaking() {
    var btns = root.querySelectorAll('[data-speak-key]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-speak-key') === speakingKey);
  }
  function speak(text, key) {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      toast('Trình duyệt này chưa hỗ trợ đọc tiếng Nhật.');
      return;
    }
    try {
      var synth = window.speechSynthesis;
      if (speakingKey === key && synth.speaking) { synth.cancel(); speakingKey = null; markSpeaking(); return; }
      synth.cancel();
      var total = jaVoice ? 1 : findVoice();
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      if (jaVoice) u.voice = jaVoice;
      u.rate = 0.9;
      u.onend = u.onerror = function () { if (speakingKey === key) { speakingKey = null; markSpeaking(); } };
      speakingKey = key;
      markSpeaking();
      synth.speak(u);
      if (!jaVoice && total > 0) toast('Chưa thấy giọng tiếng Nhật. Trên iPhone: Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Nhật.');
    } catch (e) {
      speakingKey = null;
      toast('Không phát âm được trên máy này.');
    }
  }

  /* ---------------- màn: Ai đang học? ---------------- */
  function profileChips(p) {
    return LEVELS.map(function (L) {
      var d = words(L.code);
      if (!d.list.length) return '<span class="chip">' + L.code + ' · chưa có từ</span>';
      var l = p.lv[L.code];
      var ids = l ? idsInRange(L.code, l) : d.list.map(function (w) { return w.id; });
      var seen = l ? countIn(l.seen, ids) : 0;
      return '<span class="chip on">' + L.code + ' · ' + seen + '/' + ids.length + '</span>';
    }).join('');
  }
  function viewProfiles() {
    var h = '';
    h += '<header class="row center" style="flex-direction:column;gap:6px">';
    h += '<div class="eyebrow">日本語をもっと楽しく · JAPANESE EVERY DAY</div>';
    h += '<h1 class="brand">Kotoba <span class="spark">✦</span> Studio</h1>';
    h += '<p class="h2" style="margin-top:4px">Ai đang học hôm nay?</p>';
    h += '<p class="small muted" style="margin:0">Mỗi người có tiến độ và danh sách "Còn ôn" riêng.</p>';
    h += '</header>';

    h += '<div style="display:flex;flex-direction:column;gap:10px">';
    state.profiles.forEach(function (p) {
      var editing = ui.editing === p.id;
      h += '<div class="profile' + (editing ? ' editing' : '') + '">';
      h += '<div class="row">';
      h += '<button class="profile-main" data-act="pick" data-id="' + esc(p.id) + '" aria-label="Học với hồ sơ ' + esc(p.name) + '">';
      h += '<span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span>';
      h += '<span style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="pname">' + esc(p.name) + '</span><span class="chips">' + profileChips(p) + '</span></span>';
      h += '</button>';
      h += '<button class="icon-btn" data-act="edit" data-id="' + esc(p.id) + '" aria-label="Đổi tên ' + esc(p.name) + '">' + ICON.pen + '</button>';
      h += '</div>';
      if (editing) {
        h += '<div class="edit-box">';
        if (ui.confirmDelete === p.id) {
          h += '<p style="margin:0;font-size:14px;font-weight:600">Xóa hồ sơ "' + esc(p.name) + '"?</p>';
          h += '<p class="small muted" style="margin:0">Toàn bộ tiến độ và danh sách "Còn ôn" của người này sẽ mất, không lấy lại được.</p>';
          h += '<div class="grid2"><button class="btn danger" data-act="del-yes" data-id="' + esc(p.id) + '">Xóa hẳn</button><button class="btn" data-act="del-no">Không xóa</button></div>';
        } else {
          h += '<label class="field" for="rename-' + esc(p.id) + '">Tên mới<input id="rename-' + esc(p.id) + '" type="text" maxlength="30" autocomplete="off" value="' + esc(p.name) + '"></label>';
          h += '<div class="grid3">';
          h += '<button class="btn primary" data-act="save-name" data-id="' + esc(p.id) + '">Lưu</button>';
          h += '<button class="btn" data-act="cancel-edit">Hủy</button>';
          h += '<button class="btn danger" data-act="del" data-id="' + esc(p.id) + '"' + (state.profiles.length < 2 ? ' disabled' : '') + '>Xóa</button>';
          h += '</div>';
          h += '<span class="small muted">' + (state.profiles.length < 2 ? 'Cần giữ ít nhất 1 người học. ' : '') + 'Đổi tên không làm mất tiến độ.</span>';
        }
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div>';

    if (state.profiles.length < MAX_PROFILES) h += '<button class="btn ghost" data-act="add" style="min-height:52px">+ Thêm người học</button>';

    h += '<div class="grid2"><button class="btn" data-act="backup">Sao lưu tiến độ</button><button class="btn" data-act="restore">Khôi phục</button></div>';
    if (ui.backup) h += viewBackup();
    if (ui.restore) h += viewRestore();

    h += '<p class="small muted" style="margin:0;text-align:center">' + (storageOk
      ? 'Dữ liệu lưu trên máy này. Đổi máy: bấm "Sao lưu" rồi "Khôi phục" ở máy mới.'
      : 'Máy này đang chặn lưu dữ liệu, tiến độ sẽ mất khi đóng trang.') + '</p>';
    h += footer();
    return h;
  }

  /* ---------------- sao lưu / khôi phục ---------------- */
  function toBase64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function backupCode() {
    return 'KOTOBA1:' + toBase64(JSON.stringify({ v: 1, at: new Date().toISOString(), profiles: state.profiles }));
  }
  function viewBackup() {
    var h = '<section class="panel">';
    h += '<h2 class="h2" style="font-size:15px">Mã sao lưu</h2>';
    h += '<p class="small muted" style="margin:0">Sao chép mã này và cất vào Ghi chú, Zalo hoặc email. Ở máy mới, bấm "Khôi phục" rồi dán mã vào.</p>';
    h += '<label class="field" for="backup-code">Mã của ' + state.profiles.length + ' người học<textarea id="backup-code" readonly>' + esc(backupCode()) + '</textarea></label>';
    h += '<div class="grid2"><button class="btn primary" data-act="copy">Sao chép mã</button><button class="btn" data-act="close-backup">Đóng</button></div>';
    h += '</section>';
    return h;
  }
  function viewRestore() {
    var h = '<section class="panel">';
    h += '<h2 class="h2" style="font-size:15px">Khôi phục tiến độ</h2>';
    if (ui.restoreReady) {
      h += '<p style="margin:0;font-size:14px">Mã hợp lệ: ' + ui.restoreReady.profiles.length + ' người học (' + esc(ui.restoreReady.profiles.map(function (p) { return p.name; }).join(', ')) + ').</p>';
      h += '<p class="small muted" style="margin:0">Dữ liệu hiện có trên máy này sẽ được thay hoàn toàn.</p>';
      h += '<div class="grid2"><button class="btn primary" data-act="restore-yes">Khôi phục</button><button class="btn" data-act="restore-no">Hủy</button></div>';
    } else {
      h += '<label class="field" for="restore-code">Dán mã sao lưu<textarea id="restore-code" placeholder="KOTOBA1:..."></textarea></label>';
      h += '<div class="grid2"><button class="btn primary" data-act="restore-check">Kiểm tra mã</button><button class="btn" data-act="restore-no">Hủy</button></div>';
    }
    h += '</section>';
    return h;
  }
  function parseBackup(text) {
    var t = String(text || '').replace(/\s+/g, '');
    if (t.indexOf('KOTOBA1:') !== 0) return null;
    try {
      var obj = JSON.parse(fromBase64(t.slice(8)));
      if (!obj || !Array.isArray(obj.profiles) || !obj.profiles.length) return null;
      var n = normalize({ profiles: obj.profiles });
      return n;
    } catch (e) { return null; }
  }

  /* ---------------- màn: chọn cấp độ ---------------- */
  function viewLevels() {
    var p = profile();
    var h = '';
    h += '<div class="topbar">';
    h += '<button class="who" data-act="to-profiles"><span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span class="who-name">' + esc(p.name) + '</span><span class="who-sub">Đổi người học ›</span></span></button>';
    h += '<span style="font-family:var(--f-display);font-weight:700">Kotoba <span class="spark" style="color:var(--accent)">✦</span></span>';
    h += '</div>';
    h += '<div><h1 class="h1">Hôm nay học cấp độ nào?</h1><p class="small muted" style="margin:4px 0 0">Tiến độ của từng cấp độ được lưu riêng cho ' + esc(p.name) + '.</p></div>';

    LEVELS.forEach(function (L) {
      var d = words(L.code);
      var has = d.list.length > 0;
      var l = p.lv[L.code];
      var ids = has ? (l ? idsInRange(L.code, l) : d.list.map(function (w) { return w.id; })) : [];
      var seen = l ? countIn(l.seen, ids) : 0;
      var review = l ? countIn(l.review, ids) : 0;
      var pct = ids.length ? Math.round(seen / ids.length * 100) : 0;
      var r = has ? range(L.code, l || {}) : null;
      h += '<button class="level" data-act="pick-level" data-level="' + L.code + '"' + (has ? '' : ' aria-disabled="true"') + '>';
      h += '<span class="row between"><span class="row"><span class="level-code" style="background:' + L.color + '">' + L.code + '</span>';
      h += '<span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:16px;font-weight:700">' + L.title + '</span><span class="small muted">' + (has ? d.list.length + ' từ · ' + exampleCount(L.code) + ' từ có ví dụ' : 'Chờ danh sách từ') + '</span></span></span>';
      h += '<span class="tag ' + (has ? 'ok' : 'off') + '">' + (has ? 'Sẵn sàng' : 'Chưa có từ') + '</span></span>';
      h += '<span class="bar"><i style="width:' + pct + '%;background:' + L.color + '"></i></span>';
      h += '<span class="row between small" style="color:var(--ink-2)"><span>Đã học ' + seen + ' · Còn ôn ' + review + '</span><span>' + (has ? 'Từ ' + r.from + ' – ' + r.to : '—') + '</span></span>';
      h += '</button>';
    });

    var cur = state.level, d0 = words(cur);
    if (d0.list.length) {
      var l0 = lvState(p, cur), r0 = range(cur, l0);
      h += '<section class="panel">';
      h += '<h2 class="h2" style="font-size:14px">Phần học được giao (' + cur + ')</h2>';
      h += '<div class="grid2">';
      h += '<label class="field" for="range-from">Từ số<input id="range-from" type="number" inputmode="numeric" min="' + d0.minId + '" max="' + d0.maxId + '" value="' + r0.from + '"></label>';
      h += '<label class="field" for="range-to">Đến số<input id="range-to" type="number" inputmode="numeric" min="' + d0.minId + '" max="' + d0.maxId + '" value="' + r0.to + '"></label>';
      h += '</div>';
      h += '<div class="grid2"><button class="btn primary" data-act="range-save">Lưu phạm vi</button><button class="btn" data-act="range-all">Học toàn bộ</button></div>';
      h += '<p class="small muted" style="margin:0">Mặc định là học toàn bộ ' + d0.list.length + ' từ. Đổi nếu muốn chia phần cho từng người. Bấm vào thẻ ' + cur + ' ở trên để bắt đầu học.</p>';
      h += '</section>';
    }
    h += footer();
    return h;
  }

  /* ---------------- màn: học thẻ ---------------- */
  function wordSize(w) {
    var n = Array.from(w).length;
    return n <= 3 ? 64 : n <= 5 ? 52 : n <= 7 ? 42 : 34;
  }
  function viewStudy() {
    var p = profile(), code = state.level, L = levelInfo(code), d = words(code);
    var l = lvState(p, code);
    var list = studyList(p, code);
    var inRange = idsInRange(code, l);
    var seenCount = countIn(l.seen, inRange);
    var reviewCount = countIn(l.review, inRange);
    var pos = list.indexOf(l.cur);
    if (pos < 0 && list.length) { pos = 0; l.cur = list[0]; }
    var w = pos >= 0 ? d.map[l.cur] : null;
    if (w && l.seen.indexOf(w.id) < 0) { l.seen.push(w.id); seenCount++; save(); }
    var e = w ? exampleFor(code, w.id) : null;
    var st = p.settings;

    var h = '';
    h += '<header style="display:flex;flex-direction:column;gap:6px">';
    h += '<div class="eyebrow">日本語をもっと楽しく · JAPANESE EVERY DAY</div>';
    h += '<div class="row between"><div class="row" style="align-items:baseline;gap:6px"><h1 class="brand">Kotoba <span class="spark">✦</span> Studio</h1><span class="small muted" style="font-weight:600">v' + APP_VERSION + '</span></div>';
    h += '<span class="pill" aria-label="Thẻ hiện tại">' + (list.length ? (pos + 1) + ' / ' + list.length : '0 / 0') + '</span></div>';
    h += '<div class="byline">Created by <b>' + AUTHOR + '</b></div>';
    h += '</header>';

    h += '<div class="topbar">';
    h += '<button class="who" data-act="to-profiles"><span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span class="who-name">' + esc(p.name) + '</span><span class="who-sub">Đổi người học ›</span></span></button>';
    h += '<button class="btn" data-act="to-levels" style="min-height:40px;border-radius:999px">' + esc(L.title.split(' · ')[0]) + ' ' + ICON.chev + '</button>';
    h += '</div>';

    h += '<div class="row between"><div style="font-size:12px;font-weight:700;letter-spacing:0.06em">' + code + ' · TỪ VỰNG ĐỜI SỐNG</div><div class="small muted" style="font-variant-numeric:tabular-nums">Đã học ' + seenCount + ' · Còn ôn ' + reviewCount + '</div></div>';
    h += '<div class="note">Nghĩa của các từ đang là <strong>bản nháp</strong>, chưa kiểm chứng đầy đủ. Hiện có ' + exampleCount(code) + ' từ có ví dụ đời sống; các từ còn lại sẽ được bổ sung theo đợt.</div>';
    h += '<div class="bar" aria-hidden="true"><i style="width:' + (inRange.length ? Math.round(seenCount / inRange.length * 100) : 0) + '%"></i></div>';

    h += '<div class="modes" role="group" aria-label="Chế độ học">';
    h += '<button class="mode' + (l.mode === 'all' ? ' on' : '') + '" data-act="mode-all" aria-pressed="' + (l.mode === 'all') + '">Học tất cả</button>';
    h += '<button class="mode' + (l.mode === 'review' ? ' on' : '') + '" data-act="mode-review" aria-pressed="' + (l.mode === 'review') + '">Chỉ ôn "Còn ôn" (' + reviewCount + ')</button>';
    h += '<button class="mode' + (l.shuffle ? ' on' : '') + '" data-act="shuffle" aria-pressed="' + l.shuffle + '">Xáo trộn</button>';
    h += '</div>';

    if (!w) {
      h += '<div class="empty">' + (l.mode === 'review'
        ? 'Chưa có thẻ nào được đánh dấu "Còn ôn" trong phần học này. Khi học, bấm ☆ Còn ôn ở những từ chưa thuộc.'
        : 'Phần học này chưa có từ nào.') + '</div>';
      if (l.mode === 'review') h += '<button class="btn primary" data-act="mode-all">Quay lại học tất cả</button>';
      h += footer();
      return h;
    }

    var isLast = pos === list.length - 1, isFirst = pos === 0;
    var sameReading = w.r === w.w;
    var verified = w.s === 'verified';
    var inReview = l.review.indexOf(w.id) >= 0;

    h += '<button class="card' + (ui.flipped ? ' back' : '') + (ui.slide ? ' ' + ui.slide : '') + '" id="card" data-act="flip" aria-label="' + (ui.flipped ? 'Mặt sau, chạm để lật lại' : 'Mặt trước, chạm để xem nghĩa') + '">';
    if (!ui.flipped) {
      h += '<span class="side-tag">MẶT TRƯỚC · TỪ VỰNG</span>';
      h += '<span class="word" lang="ja" style="font-size:' + wordSize(w.w) + 'px">' + esc(w.w) + '</span>';
      if (st.kanaCard && !sameReading) h += '<span class="reading" lang="ja">' + esc(w.r) + '</span>';
      h += '<span class="status' + (verified ? ' ok' : '') + '">' + (verified ? 'Nghĩa đã kiểm chứng' : 'Nghĩa: bản nháp') + '</span>';
      h += '<span class="hint">Chạm để lật · Vuốt trái/phải để đổi từ</span>';
    } else {
      h += '<span class="side-tag">MẶT SAU · NGHĨA</span>';
      h += '<span class="word" lang="ja" style="font-size:' + Math.min(44, wordSize(w.w)) + 'px">' + esc(w.w) + '</span>';
      if (!sameReading) h += '<span class="reading" lang="ja">' + esc(w.r) + '</span>';
      h += '<span class="meaning">' + esc(w.m) + '</span>';
      h += '<span class="hint">' + (e && e.t ? esc(e.t) + ' · ' : '') + 'Chạm để lật lại</span>';
    }
    h += '</button>';

    h += '<nav class="nav" aria-label="Chuyển từ">';
    h += '<button class="btn" data-act="prev"' + (isFirst ? ' disabled' : '') + '>' + ICON.left + 'Trước</button>';
    h += '<button class="btn star' + (inReview ? ' on' : '') + '" data-act="toggle-review" aria-pressed="' + inReview + '">' + (inReview ? ICON.starOn + 'Đã đánh dấu' : ICON.star + 'Còn ôn') + '</button>';
    h += '<button class="btn primary" data-act="next"' + (isLast ? ' disabled' : '') + '>Tiếp' + ICON.right + '</button>';
    h += '</nav>';
    if (isLast) h += '<div class="endnote">Bạn đã tới thẻ cuối của phần này. <button data-act="first">Về thẻ đầu</button></div>';
    h += '<div class="jump"><label for="jump" class="row" style="gap:6px">Tới thẻ số<input id="jump" type="number" inputmode="numeric" min="1" max="' + list.length + '" value="' + (pos + 1) + '"></label><span>/ ' + list.length + '</span><button class="btn" data-act="jump" style="min-height:38px">Đi</button></div>';

    h += '<label class="check" for="opt-kanacard"><input type="checkbox" id="opt-kanacard" data-opt="kanaCard"' + (st.kanaCard ? ' checked' : '') + '>Hiện hiragana trên flashcard</label>';
    h += '<div class="grid2"><button class="btn" data-act="say-word" data-speak-key="word">' + ICON.sound + 'Nghe từ</button><button class="btn" data-act="flip">' + ICON.flip + 'Lật thẻ</button></div>';

    if (ui.flipped && e) {
      if (Array.isArray(e.p) && e.p.length) {
        h += '<section class="usage"><h2 class="h2" style="font-size:15px">Cách dùng trong đời sống</h2>';
        e.p.forEach(function (pt) {
          if (!Array.isArray(pt)) return;
          h += '<div class="pattern"><span class="jp" lang="ja">' + esc(pt[0]) + '</span><span class="small" style="color:var(--ink-2)">' + esc(pt[1]) + '</span></div>';
        });
        h += '</section>';
      }
      if (e.tip) h += '<section class="tip"><span class="label">MẸO ĐỜI SỐNG</span><span>' + esc(e.tip) + '</span></section>';
    }

    h += '<div style="display:flex;flex-direction:column">';
    h += '<label class="check" for="opt-kanaex"><input type="checkbox" id="opt-kanaex" data-opt="kanaEx"' + (st.kanaEx ? ' checked' : '') + '>Hiện hiragana trong ví dụ</label>';
    h += '<label class="check" for="opt-vi"><input type="checkbox" id="opt-vi" data-opt="vi"' + (st.vi ? ' checked' : '') + '>Hiện bản dịch tiếng Việt cho từng ví dụ</label>';
    h += '</div>';

    h += '<section style="display:flex;flex-direction:column;gap:12px">';
    var exs = e && Array.isArray(e.ex) ? e.ex.filter(Array.isArray) : [];
    h += '<div><h2 class="h2">' + (exs.length ? exs.length + ' ví dụ trong đời sống' : 'Ví dụ trong đời sống') + '</h2><div class="small muted">Câu nói thường ngày, gắn với tình huống cụ thể</div></div>';
    if (!exs.length) {
      h += '<div class="empty">Từ này chưa có ví dụ. Ví dụ sẽ được bổ sung trong các đợt cập nhật tới.</div>';
    } else {
      exs.forEach(function (x, i) {
        h += '<article class="ex">';
        h += '<div class="row between"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="ex-no">VÍ DỤ ' + (i + 1) + '</span>' + (x[0] ? '<span class="scene">' + esc(x[0]) + '</span>' : '') + '</div>';
        h += '<button class="speak" data-act="say-ex" data-i="' + i + '" data-speak-key="ex' + i + '" aria-label="Nghe ví dụ ' + (i + 1) + '">' + ICON.sound + '</button></div>';
        h += '<div class="ex-jp" lang="ja">' + esc(x[1]) + '</div>';
        if (st.kanaEx && x[2]) h += '<div class="ex-kana" lang="ja">' + esc(x[2]) + '</div>';
        if (st.vi && x[3]) h += '<div class="ex-vi"><span class="label">DỊCH TIẾNG VIỆT</span><span>' + esc(x[3]) + '</span></div>';
        h += '</article>';
      });
    }
    h += '</section>';
    h += footer();
    return h;
  }

  function footer() {
    return '<footer class="footer"><div class="small muted">Made with care · <b style="font-family:var(--f-display);font-style:italic;color:var(--ink)">' + AUTHOR + '</b></div>' +
      '<p>Dùng tốt nhất trên Safari iPhone: bấm Chia sẻ › Thêm vào Màn hình chính. Tiến độ và danh sách "Còn ôn" được lưu trên máy của bạn.</p></footer>';
  }

  /* ---------------- vẽ ---------------- */
  function render(keepScroll) {
    var y = window.scrollY;
    try {
      if (ui.view !== 'profiles' && !profile()) ui.view = 'profiles';
      if (ui.view === 'study' && !words(state.level).list.length) ui.view = 'levels';
      root.innerHTML = ui.view === 'profiles' ? viewProfiles() : ui.view === 'levels' ? viewLevels() : viewStudy();
      markSpeaking();
    } catch (err) {
      root.innerHTML = '<div class="fatal"><strong>Có lỗi khi hiển thị.</strong><br>Tiến độ của bạn vẫn được giữ nguyên. Hãy tải lại trang.<br><button class="btn" style="margin-top:10px" data-act="reload">Tải lại</button></div>';
      if (window.console) console.error(err);
    }
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }

  /* ---------------- hành động ---------------- */
  function go(delta) {
    var p = profile(); if (!p) return;
    var l = lvState(p, state.level), list = studyList(p, state.level);
    var pos = list.indexOf(l.cur);
    var np = Math.max(0, Math.min(list.length - 1, pos + delta));
    if (np === pos || !list.length) return;
    l.cur = list[np];
    ui.flipped = false;
    ui.slide = delta > 0 ? 'slide-r' : 'slide-l';
    save();
    render(true);
    requestAnimationFrame(function () {
      var c = document.getElementById('card');
      if (c) requestAnimationFrame(function () { c.classList.remove('slide-l', 'slide-r'); });
      ui.slide = '';
    });
    try { if (speakingKey) { window.speechSynthesis.cancel(); speakingKey = null; } } catch (e) { /* bỏ qua */ }
  }
  function currentWord() {
    var p = profile(); if (!p) return null;
    var l = lvState(p, state.level);
    return words(state.level).map[l.cur] || null;
  }

  var suppressClick = false;
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t || !root.contains(t)) return;
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-id');
    var p = profile();

    switch (act) {
      case 'reload': location.reload(); return;
      case 'pick':
        state.active = id; ui.editing = null; ui.confirmDelete = null; ui.backup = ui.restore = false;
        resetList(); save(); ui.view = 'levels'; render(); return;
      case 'edit':
        ui.editing = ui.editing === id ? null : id; ui.confirmDelete = null; render(true);
        if (ui.editing) { var inp = document.getElementById('rename-' + id); if (inp) { inp.focus(); inp.select(); } }
        return;
      case 'cancel-edit': ui.editing = null; ui.confirmDelete = null; render(true); return;
      case 'save-name': {
        var input = document.getElementById('rename-' + id);
        var name = input ? input.value.trim().slice(0, 30) : '';
        if (!name) { toast('Tên không được để trống.'); return; }
        state.profiles.forEach(function (x) { if (x.id === id) x.name = name; });
        ui.editing = null; save(); render(true); toast('Đã đổi tên thành "' + name + '".'); return;
      }
      case 'del': if (state.profiles.length > 1) { ui.confirmDelete = id; render(true); } return;
      case 'del-no': ui.confirmDelete = null; render(true); return;
      case 'del-yes':
        if (state.profiles.length < 2) return;
        state.profiles = state.profiles.filter(function (x) { return x.id !== id; });
        if (state.active === id) state.active = null;
        ui.editing = ui.confirmDelete = null; save(); render(true); toast('Đã xóa hồ sơ.'); return;
      case 'add': {
        var np = newProfile(state.profiles.length + 1);
        np.settings = { kanaCard: false, kanaEx: true, vi: true };
        state.profiles.push(np); ui.editing = np.id; ui.confirmDelete = null; save(); render(true);
        var ni = document.getElementById('rename-' + np.id); if (ni) { ni.focus(); ni.select(); }
        return;
      }
      case 'backup': ui.backup = !ui.backup; ui.restore = false; ui.restoreReady = null; render(true); return;
      case 'close-backup': ui.backup = false; render(true); return;
      case 'copy': {
        var ta = document.getElementById('backup-code');
        var text = ta ? ta.value : '';
        var fallback = function () { if (ta) { ta.focus(); ta.select(); } toast('Hãy giữ ngón tay trên mã và chọn Sao chép.'); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('Đã sao chép mã sao lưu.'); }, fallback);
          else fallback();
        } catch (e) { fallback(); }
        return;
      }
      case 'restore': ui.restore = !ui.restore; ui.backup = false; ui.restoreReady = null; render(true); return;
      case 'restore-no': ui.restore = false; ui.restoreReady = null; render(true); return;
      case 'restore-check': {
        var rc = document.getElementById('restore-code');
        var parsed = parseBackup(rc ? rc.value : '');
        if (!parsed) { toast('Mã không hợp lệ. Hãy dán đúng mã bắt đầu bằng KOTOBA1:'); return; }
        ui.restoreReady = parsed; render(true); return;
      }
      case 'restore-yes':
        if (!ui.restoreReady) return;
        state.profiles = ui.restoreReady.profiles; state.active = null;
        ui.restore = false; ui.restoreReady = null; resetList(); save(); render(); toast('Đã khôi phục tiến độ.'); return;
      case 'to-profiles': ui.view = 'profiles'; ui.flipped = false; render(); return;
      case 'to-levels': ui.view = 'levels'; ui.flipped = false; render(); return;
      case 'pick-level': {
        var code = t.getAttribute('data-level');
        if (!words(code).list.length) { toast('Cấp độ ' + code + ' chưa có danh sách từ.'); return; }
        state.level = code; resetList(); ui.flipped = false; save(); ui.view = 'study'; render(); return;
      }
      case 'range-save': {
        if (!p) return;
        var d = words(state.level), l = lvState(p, state.level);
        var f = parseInt((document.getElementById('range-from') || {}).value, 10);
        var to = parseInt((document.getElementById('range-to') || {}).value, 10);
        if (!isFinite(f) || !isFinite(to)) { toast('Hãy nhập số cho cả hai ô.'); return; }
        f = Math.max(d.minId, Math.min(d.maxId, f)); to = Math.max(d.minId, Math.min(d.maxId, to));
        if (f > to) { var tmp = f; f = to; to = tmp; }
        l.from = f; l.to = to; resetList(); save(); render(true); toast('Đã lưu phạm vi: từ ' + f + ' đến ' + to + '.'); return;
      }
      case 'range-all': {
        if (!p) return;
        var la = lvState(p, state.level); la.from = null; la.to = null; resetList(); save(); render(true); toast('Đã chọn học toàn bộ.'); return;
      }
      case 'flip':
        if (suppressClick) return;
        ui.flipped = !ui.flipped; render(true); return;
      case 'prev': go(-1); return;
      case 'next': go(1); return;
      case 'first': {
        var lf = lvState(p, state.level), lst = studyList(p, state.level);
        if (lst.length) { lf.cur = lst[0]; ui.flipped = false; save(); render(true); var c0 = document.getElementById('card'); if (c0) c0.scrollIntoView({ block: 'center' }); }
        return;
      }
      case 'jump': {
        var j = document.getElementById('jump'), lj = lvState(p, state.level), lsj = studyList(p, state.level);
        var n = parseInt(j ? j.value : '', 10);
        if (!isFinite(n) || n < 1 || n > lsj.length) { toast('Hãy nhập số từ 1 đến ' + lsj.length + '.'); return; }
        lj.cur = lsj[n - 1]; ui.flipped = false; save(); render(true); return;
      }
      case 'toggle-review': {
        var lr = lvState(p, state.level), w = currentWord(); if (!w) return;
        var k = lr.review.indexOf(w.id);
        if (k >= 0) { lr.review.splice(k, 1); toast('Đã bỏ khỏi danh sách "Còn ôn".'); }
        else { lr.review.push(w.id); toast('Đã thêm vào danh sách "Còn ôn".'); }
        save(); render(true); return;
      }
      case 'mode-all': case 'mode-review': {
        var lm = lvState(p, state.level); lm.mode = act === 'mode-all' ? 'all' : 'review';
        resetList(); ui.flipped = false; save(); render(true); return;
      }
      case 'shuffle': {
        var ls = lvState(p, state.level); ls.shuffle = !ls.shuffle;
        if (ls.shuffle) ls.seed = (Date.now() % 2147483647) || 1;
        resetList(); ui.flipped = false; save(); render(true); toast(ls.shuffle ? 'Đã xáo trộn thứ tự thẻ.' : 'Đã trở về thứ tự gốc.'); return;
      }
      case 'say-word': { var ww = currentWord(); if (ww) speak(ww.w, 'word'); return; }
      case 'say-ex': {
        var wx = currentWord(); if (!wx) return;
        var ex = exampleFor(state.level, wx.id), i = parseInt(t.getAttribute('data-i'), 10);
        if (ex && Array.isArray(ex.ex) && Array.isArray(ex.ex[i])) speak(ex.ex[i][1], 'ex' + i);
        return;
      }
    }
  });

  root.addEventListener('change', function (ev) {
    var t = ev.target;
    var opt = t && t.getAttribute && t.getAttribute('data-opt');
    if (!opt) return;
    var p = profile(); if (!p) return;
    p.settings[opt] = !!t.checked;
    save(); render(true);
  });

  root.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    var id = ev.target && ev.target.id;
    if (id === 'jump') { ev.preventDefault(); var b = root.querySelector('[data-act="jump"]'); if (b) b.click(); }
    else if (id && id.indexOf('rename-') === 0) { ev.preventDefault(); var s = ev.target.closest('.profile').querySelector('[data-act="save-name"]'); if (s) s.click(); }
  });

  document.addEventListener('keydown', function (ev) {
    if (ui.view !== 'study') return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
  });

  /* Vuốt trái / phải chỉ tính khi bắt đầu trong vùng thẻ */
  var sx = 0, sy = 0, tracking = false;
  root.addEventListener('touchstart', function (ev) {
    var c = ev.target.closest && ev.target.closest('#card');
    if (!c || ev.touches.length !== 1) { tracking = false; return; }
    tracking = true; sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
  }, { passive: true });
  root.addEventListener('touchend', function (ev) {
    if (!tracking) return;
    tracking = false;
    var t = ev.changedTouches[0]; if (!t) return;
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 450);
      go(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* Mở lại đúng chỗ đang học nếu đã chọn người học trước đó */
  if (profile()) ui.view = words(state.level).list.length ? 'study' : 'levels';
  render();

  /* Chế độ ngoại tuyến (chỉ bật khi đặt trên GitHub Pages) */
  try {
    if (window.KOTOBA_PWA && 'serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* không ảnh hưởng app */ });
      });
    }
  } catch (e) { /* bỏ qua */ }
})();
