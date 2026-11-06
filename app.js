/* Kotoba Studio — web app học từ vựng tiếng Nhật.
   Dữ liệu từ vựng nằm ở data/*.js (window.KOTOBA_DATA, window.KOTOBA_EXAMPLES).
   Tiến độ lưu trên máy (localStorage), tách riêng theo từng người học và từng cấp độ. */
(function () {
  'use strict';

  var APP_VERSION = '2.0';
  var STORE_KEY = 'kotoba.studio.v1';
  var LEVELS = [
    { code: 'N3', title: 'JLPT N3 · Trung cấp', color: '#2E5B45' },
    { code: 'N2', title: 'JLPT N2 · Trung cao cấp', color: '#24476B' },
    { code: 'N1', title: 'JLPT N1 · Cao cấp', color: '#8C3B2E' },
    { code: 'K3', kind: 'kanji', short: 'N3', title: 'Kanji N3 · gồm cả N5, N4', color: '#2E5B45' },
    { code: 'K2', kind: 'kanji', short: 'N2', title: 'Kanji N2', color: '#24476B' },
    { code: 'K1', kind: 'kanji', short: 'N1', title: 'Kanji N1', color: '#8C3B2E' }
  ];
  function isKanji(code) { return code === 'K3' || code === 'K2' || code === 'K1'; }
  var COLORS = ['#2E5B45', '#24476B', '#8C3B2E', '#6A4C93', '#7A5C12', '#2F6F73', '#9A4565', '#4E5D2C'];
  var MAX_PROFILES = 12;
  var AUTHOR = 'Ngô Tấn Đạt';

  var root = document.getElementById('app');
  if (!root) return;

  /* ---------------- dữ liệu từ vựng ---------------- */
  var DATA = (window.KOTOBA_DATA && typeof window.KOTOBA_DATA === 'object') ? window.KOTOBA_DATA : {};
  var EXAMPLES = (window.KOTOBA_EXAMPLES && typeof window.KOTOBA_EXAMPLES === 'object') ? window.KOTOBA_EXAMPLES : {};
  var KANJI = (window.KOTOBA_KANJI && typeof window.KOTOBA_KANJI === 'object' && window.KOTOBA_KANJI.k) ? window.KOTOBA_KANJI : null;
  /* Mục Kanji: danh sách 2136 chữ (data/kanji-list.js) + dữ liệu từng đợt (data/kj-XX.js). Thiếu file thì mục này trống, phần Từ vựng không ảnh hưởng. */
  var KJ = (window.KOTOBA_KJ && typeof window.KOTOBA_KJ === 'object') ? window.KOTOBA_KJ : {};
  var KJD = (window.KOTOBA_KJD && typeof window.KOTOBA_KJD === 'object') ? window.KOTOBA_KJD : {};
  var wordCache = {};

  function words(code) {
    if (wordCache[code]) return wordCache[code];
    var src = Array.isArray(DATA[code]) ? DATA[code] : [];
    if (isKanji(code)) {
      src = [];
      var chars = typeof KJ[code] === 'string' ? Array.from(KJ[code]) : [];
      for (var q = 0; q < chars.length; q++) src.push({ id: q + 1, w: chars[q] });
    }
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
  function kanjiReady(code) {
    var w = words(code).list, n = 0;
    for (var i = 0; i < w.length; i++) if (KJD[w[i].w]) n++;
    return n;
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
    return { v: 1, profiles: ps, active: null, level: 'N3', settings: {}, voice: { ja: '', vi: '' } };
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
    var out = { v: 1, profiles: [], active: null, level: 'N3', settings: {}, voice: { ja: '', vi: '' } };
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
          group: typeof l.group === 'number' && l.group >= 0 ? Math.floor(l.group) : 0,
          assign: (l.assign && typeof l.assign.from === 'number' && typeof l.assign.to === 'number') ? { from: Math.floor(l.assign.from), to: Math.floor(l.assign.to) } : null,
          mode: l.mode === 'review' ? 'review' : 'all',
          shuffle: !!l.shuffle,
          seed: typeof l.seed === 'number' ? l.seed : 1
        };
      }
      var st = (p.settings && typeof p.settings === 'object') ? p.settings : {};
      var pl = (st.play && typeof st.play === 'object') ? st.play : {};
      np.settings = {
        kanaCard: !!st.kanaCard, kanaEx: st.kanaEx !== false, vi: st.vi !== false, kanji: !!st.kanji, kjTip: !!st.kjTip,
        rate: [0.7, 0.85, 1].indexOf(st.rate) >= 0 ? st.rate : 0.85,
        play: { content: ['word', 'meaning', 'full'].indexOf(pl.content) >= 0 ? pl.content : 'meaning', gap: [1, 2, 3, 4].indexOf(pl.gap) >= 0 ? pl.gap : 4 }
      };
      out.profiles.push(np);
    }
    if (!out.profiles.length) return defaultState();
    if (typeof s.active === 'string') out.active = s.active;
    if (typeof s.level === 'string' && LEVELS.some(function (l) { return l.code === s.level; })) out.level = s.level;
    out.section = s.section === 'kanji' ? 'kanji' : 'vocab';
    if (s.voice && typeof s.voice === 'object') {
      out.voice.ja = typeof s.voice.ja === 'string' ? s.voice.ja : '';
      out.voice.vi = typeof s.voice.vi === 'string' ? s.voice.vi : '';
    }
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
  if (!state.voice || typeof state.voice !== 'object') state.voice = { ja: '', vi: '' };

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
    listKey: '',
    voicePanel: false
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
    if (!p.lv[code]) p.lv[code] = { cur: null, seen: [], review: [], from: null, to: null, group: 0, assign: null, mode: 'all', shuffle: false, seed: 1 };
    return p.lv[code];
  }

  /* ---------------- cụm 50 từ ---------------- */
  var GROUP_SIZE = 50;
  function groupsOf(code) {
    var d = words(code);
    if (!d.groups) {
      d.groups = [];
      for (var i = 0; i < d.list.length; i += GROUP_SIZE) {
        d.groups.push(d.list.slice(i, i + GROUP_SIZE).map(function (w) { return w.id; }));
      }
    }
    return d.groups;
  }
  function groupOfId(code, id) {
    var g = groupsOf(code);
    for (var k = 0; k < g.length; k++) if (g[k].length && id <= g[k][g[k].length - 1]) return k + 1;
    return g.length;
  }
  function groupLabel(code, k) {
    var g = groupsOf(code)[k - 1];
    return g && g.length ? g[0] + '–' + g[g.length - 1] : '';
  }
  /* Phần được giao, tính theo số cụm. Bản cũ lưu theo số từ (from/to) thì tự đổi sang cụm tương ứng. */
  function assignOf(code, l) {
    var n = groupsOf(code).length;
    var a = l && l.assign;
    var f, t;
    if (a) { f = a.from; t = a.to; }
    else if (l && (l.from != null || l.to != null)) {
      f = l.from != null ? groupOfId(code, l.from) : 1;
      t = l.to != null ? groupOfId(code, l.to) : n;
    } else { f = 1; t = n; }
    f = Math.max(1, Math.min(n, f || 1));
    t = Math.max(1, Math.min(n, t || n));
    if (f > t) { var x = f; f = t; t = x; }
    return { from: f, to: t, all: f === 1 && t === n, n: n };
  }
  function assignedIds(code, l) {
    var g = groupsOf(code), a = assignOf(code, l), out = [];
    for (var k = a.from; k <= a.to; k++) out = out.concat(g[k - 1] || []);
    return out;
  }
  function currentGroup(code, l) {
    var n = groupsOf(code).length;
    return l && l.group >= 1 && l.group <= n ? l.group : 0;
  }
  function scopeIds(code, l) {
    var k = currentGroup(code, l);
    if (k) return groupsOf(code)[k - 1].slice();
    return words(code).list.map(function (w) { return w.id; });
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
    var key = [p.id, code, l.mode, l.shuffle, l.seed, currentGroup(code, l)].join('|');
    if (ui.list && ui.listKey === key) return ui.list;
    var ids = scopeIds(code, l);
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
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    sound: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    flip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
    left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    starOn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
    stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
    skip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5.5v13a1 1 0 0 0 1.6.8l9-6.5a1 1 0 0 0 0-1.6l-9-6.5A1 1 0 0 0 5 5.5z"/><rect x="17" y="5" width="3" height="14" rx="1"/></svg>',
    shuffle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'
  };

  /* ---------------- phát âm ----------------
     Safari trên iPhone hay nuốt mất âm đầu khi bộ đọc vừa "thức dậy",
     và cắt đầu câu nếu đọc ngay sau khi vừa dừng. Cách xử lý:
     - đọc một đoạn im lặng ngắn để làm nóng trước khi đọc câu thật
     - chờ ~0,25 giây sau mỗi lần dừng
     - thêm một dấu ngắt nhẹ ở đầu mỗi câu
     - luôn có hẹn giờ dự phòng, phòng khi Safari không báo đọc xong */
  var SYNTH_OK = ('speechSynthesis' in window) && typeof window.SpeechSynthesisUtterance === 'function';
  var RATES = [0.7, 0.85, 1];
  var speakingKey = null;
  var lastSpeechEnd = 0;
  var speechToken = 0;
  var seqTimer = null;
  var voiceCache = { ja: [], vi: [], loaded: false };

  function voiceTier(v) {
    var id = ((v.voiceURI || '') + ' ' + (v.name || '')).toLowerCase();
    if (id.indexOf('premium') >= 0) return 4;
    if (id.indexOf('enhanced') >= 0 || id.indexOf('nâng cao') >= 0) return 3;
    if (id.indexOf('eloquence') >= 0 || id.indexOf('speech.synthesis.voice') >= 0 ||
        /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|fred|junior|ralph|kathy|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bahh)\b/.test(id)) return 0;
    if (id.indexOf('google') >= 0) return 2;
    return 1;
  }
  function voiceLabel(v) {
    var t = voiceTier(v);
    var nm = String(v.name || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim() || v.name;
    return nm + (t === 4 ? ' · Cao cấp' : t === 3 ? ' · Nâng cao' : t === 0 ? ' · Giọng vui' : t === 2 ? '' : ' · Cơ bản');
  }
  function loadVoices() {
    if (!SYNTH_OK) return;
    try {
      var vs = window.speechSynthesis.getVoices() || [];
      var ja = [], vi = [];
      for (var i = 0; i < vs.length; i++) {
        var lang = String(vs[i].lang || '').toLowerCase().replace('_', '-');
        if (lang.indexOf('ja') === 0) ja.push(vs[i]);
        else if (lang.indexOf('vi') === 0) vi.push(vs[i]);
      }
      var sorter = function (a, b) { return voiceTier(b) - voiceTier(a) || (a.name > b.name ? 1 : a.name < b.name ? -1 : 0); };
      ja.sort(sorter); vi.sort(sorter);
      voiceCache = { ja: ja, vi: vi, loaded: vs.length > 0 };
    } catch (e) { /* bỏ qua */ }
  }
  function pickVoice(lang) {
    var list = voiceCache[lang] || [];
    var want = state.voice && state.voice[lang];
    if (want) for (var i = 0; i < list.length; i++) if (list[i].voiceURI === want) return list[i];
    return list[0] || null;
  }
  if (SYNTH_OK) {
    loadVoices();
    try {
      window.speechSynthesis.onvoiceschanged = function () {
        loadVoices();
        if (ui.voicePanel && ui.view === 'study') render(true);
      };
    } catch (e) { /* bỏ qua */ }
    /* iPhone chỉ cho đọc sau lần chạm đầu tiên: mở khóa bộ đọc ngay lần chạm đó */
    var unlock = function () {
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
      try {
        if (window.speechSynthesis.speaking) return;
        var u = new window.SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (e) { /* bỏ qua */ }
    };
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  function markSpeaking() {
    var btns = root.querySelectorAll('[data-speak-key]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-speak-key') === speakingKey);
  }
  function currentRate() {
    var p = profile();
    var r = p && p.settings && p.settings.rate;
    return RATES.indexOf(r) >= 0 ? r : 0.85;
  }
  function stopSpeech() {
    speechToken++;
    clearTimeout(seqTimer);
    if (SYNTH_OK) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
          lastSpeechEnd = Date.now();
        }
      } catch (e) { /* bỏ qua */ }
    }
    speakingKey = null;
    markSpeaking();
  }
  function sayOne(text, lang, rate, token, volume, done) {
    var finished = false, guard = null;
    var finish = function () {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      lastSpeechEnd = Date.now();
      if (token === speechToken) done();
    };
    try {
      var u = new window.SpeechSynthesisUtterance(volume === 0 ? text : (lang === 'ja' ? '、' : ', ') + text);
      u.lang = lang === 'ja' ? 'ja-JP' : 'vi-VN';
      var v = pickVoice(lang);
      if (v) u.voice = v;
      u.rate = rate;
      if (volume === 0) u.volume = 0;
      u.onend = finish;
      u.onerror = finish;
      guard = setTimeout(finish, volume === 0 ? 900 : 3500 + String(text).length * 420 / rate);
      window.speechSynthesis.speak(u);
    } catch (e) {
      finish();
    }
  }
  /* Đọc một chuỗi: mỗi mục là {text, lang} hoặc {wait: ms}; mục nào có before() sẽ chạy trước khi đọc */
  function runSequence(items, key, onDone) {
    stopSpeech();
    if (!SYNTH_OK) return;
    var token = speechToken;
    var rate = currentRate();
    var i = 0;
    speakingKey = key;
    markSpeaking();
    var next = function () {
      if (token !== speechToken) return;
      if (i >= items.length) {
        speakingKey = null;
        markSpeaking();
        if (onDone) onDone();
        return;
      }
      var it = items[i++];
      if (it.before) { try { it.before(); } catch (e) { /* bỏ qua */ } markSpeaking(); }
      if (it.wait) { seqTimer = setTimeout(next, it.wait); return; }
      if (!it.text) { next(); return; }
      if (it.lang === 'vi' && !voiceCache.vi.length && voiceCache.loaded) { seqTimer = setTimeout(next, 1500); return; }
      sayOne(it.text, it.lang, rate, token, 1, next);
    };
    var idle = Date.now() - lastSpeechEnd;
    if (idle > 1500) {
      /* làm nóng ngay trong lần chạm (iPhone yêu cầu), rồi mới đọc câu thật */
      sayOne('、', 'ja', 1, token, 0, function () { seqTimer = setTimeout(next, 120); });
    } else {
      seqTimer = setTimeout(next, Math.max(0, 250 - idle));
    }
  }
  function speak(text, key, lang) {
    if (!SYNTH_OK) { toast('Trình duyệt này chưa hỗ trợ đọc tiếng Nhật.'); return; }
    if (player.on && !player.paused) pausePlayer(true);
    if (speakingKey === key) { stopSpeech(); return; }
    if (!voiceCache.ja.length) loadVoices();
    runSequence([{ text: text, lang: lang || 'ja' }], key);
    if (voiceCache.loaded && !voiceCache.ja.length && (lang || 'ja') === 'ja') {
      toast('Chưa thấy giọng tiếng Nhật. Trên iPhone: Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Nhật.');
    }
  }

  /* ---------------- phát liên tục ---------------- */
  var player = { on: false, paused: false, list: [], idx: 0, order: 'seq' };
  var wakeLock = null;

  function playSettings(p) {
    var pl = (p && p.settings && p.settings.play) || {};
    return {
      content: ['word', 'meaning', 'full'].indexOf(pl.content) >= 0 ? pl.content : 'meaning',
      gap: [1, 2, 3, 4].indexOf(pl.gap) >= 0 ? pl.gap : 4
    };
  }
  function requestWakeLock() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }, function () { /* không bắt buộc */ });
      }
    } catch (e) { /* bỏ qua */ }
  }
  function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* bỏ qua */ }
    wakeLock = null;
  }
  function showWord(id, flipped) {
    var p = profile(); if (!p) return;
    var l = lvState(p, state.level);
    l.cur = id;
    ui.flipped = !!flipped;
    save();
    render(true);
  }
  function playItemsFor(w) {
    var pl = playSettings(profile());
    var items = [{ text: w.w, lang: 'ja', before: function () { showWord(w.id, false); } }];
    if (pl.content === 'word') {
      items.push({ wait: 900 });
      items.push({ text: w.w, lang: 'ja' });
    } else {
      items.push({ wait: 1200 });
      items.push({ text: w.m, lang: 'vi', before: function () { showWord(w.id, true); } });
      if (pl.content === 'full') {
        var e = exampleFor(state.level, w.id);
        if (e && Array.isArray(e.ex)) {
          e.ex.slice(0, 3).forEach(function (x) { /* nghe liên tục: chỉ đọc 3 ví dụ đầu */
            if (Array.isArray(x) && x[1]) { items.push({ wait: 700 }); items.push({ text: x[1], lang: 'ja' }); }
          });
        }
      }
    }
    items.push({ wait: pl.gap * 1000 });
    return items;
  }
  function playStep() {
    if (!player.on || player.paused) return;
    if (player.idx >= player.list.length) {
      var n = player.list.length;
      stopPlayer();
      toast('Đã phát hết ' + n + ' từ.');
      return;
    }
    var w = words(state.level).map[player.list[player.idx]];
    if (!w) { player.idx++; playStep(); return; }
    runSequence(playItemsFor(w), 'play', function () {
      player.idx++;
      playStep();
    });
  }
  function startPlayer(order) {
    var p = profile(); if (!p) return;
    if (!SYNTH_OK) { toast('Trình duyệt này chưa hỗ trợ đọc tiếng Nhật.'); return; }
    var list = studyList(p, state.level).slice();
    if (!list.length) { toast('Phần học này chưa có từ nào để phát.'); return; }
    var l = lvState(p, state.level);
    if (order === 'shuf') list = seededShuffle(list, (Date.now() % 2147483647) || 1);
    player = { on: true, paused: false, list: list, idx: order === 'seq' ? Math.max(0, list.indexOf(l.cur)) : 0, order: order };
    if (!voiceCache.ja.length) loadVoices();
    requestWakeLock();
    playStep();
  }
  function pausePlayer(silent) {
    if (!player.on) return;
    player.paused = true;
    stopSpeech();
    releaseWakeLock();
    if (!silent) render(true);
  }
  function resumePlayer() {
    if (!player.on) return;
    player.paused = false;
    requestWakeLock();
    playStep();
  }
  function stopPlayer(silent) {
    if (!player.on) return;
    player.on = false;
    player.paused = false;
    stopSpeech();
    releaseWakeLock();
    if (!silent) render(true);
  }
  function playerMove(delta) {
    var ni = Math.max(0, Math.min(player.list.length - 1, player.idx + delta));
    player.idx = ni;
    stopSpeech();
    if (player.paused) showWord(player.list[ni], false);
    else playStep();
  }
  document.addEventListener('visibilitychange', function () {
    if (!player.on || player.paused) return;
    if (document.visibilityState === 'hidden') pausePlayer(true);
    else requestWakeLock();
  });

  /* ---------------- màn: Ai đang học? ---------------- */
  function profileChips(p) {
    return LEVELS.map(function (L) {
      var d = words(L.code);
      if (L.kind === 'kanji') {
        var kl = p.lv[L.code];
        if (!d.list.length || !kl || !kl.seen.length) return '';
        return '<span class="chip on">漢字 ' + L.short + ' · ' + countIn(kl.seen, assignedIds(L.code, kl)) + '/' + assignedIds(L.code, kl).length + '</span>';
      }
      if (!d.list.length) return '<span class="chip">' + L.code + ' · chưa có từ</span>';
      var l = p.lv[L.code];
      var ids = assignedIds(L.code, l);
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
    var sec = state.section === 'kanji' ? 'kanji' : 'vocab';
    h += '<div class="sections" role="tablist" aria-label="Chọn mục học">';
    h += '<button class="section-btn' + (sec === 'vocab' ? ' on' : '') + '" role="tab" aria-selected="' + (sec === 'vocab') + '" data-act="section" data-v="vocab"><span lang="ja">言葉</span>Từ vựng</button>';
    h += '<button class="section-btn' + (sec === 'kanji' ? ' on' : '') + '" role="tab" aria-selected="' + (sec === 'kanji') + '" data-act="section" data-v="kanji"><span lang="ja">漢字</span>Kanji</button>';
    h += '</div>';
    if (sec === 'kanji') {
      var kdone = 0; for (var kc in KJD) if (Object.prototype.hasOwnProperty.call(KJD, kc)) kdone++;
      h += '<p class="small muted" style="margin:0">2136 chữ kanji thông dụng, đi từ N3 (gồm cả N5, N4) lên N2, N1. Hiện có ' + kdone + ' chữ đã có mẹo nhớ; các chữ còn lại sẽ được bổ sung theo đợt.</p>';
    }

    LEVELS.forEach(function (L) {
      if ((L.kind === 'kanji' ? 'kanji' : 'vocab') !== sec) return;
      var unit = L.kind === 'kanji' ? ' chữ' : ' từ';
      var d = words(L.code);
      var has = d.list.length > 0;
      var l = p.lv[L.code];
      var ids = has ? assignedIds(L.code, l) : [];
      var seen = l ? countIn(l.seen, ids) : 0;
      var review = l ? countIn(l.review, ids) : 0;
      var pct = ids.length ? Math.round(seen / ids.length * 100) : 0;
      var a = has ? assignOf(L.code, l) : null;
      h += '<button class="level" data-act="pick-level" data-level="' + L.code + '"' + (has ? '' : ' aria-disabled="true"') + '>';
      h += '<span class="row between"><span class="row"><span class="level-code" style="background:' + L.color + '">' + (L.short || L.code) + '</span>';
      h += '<span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:16px;font-weight:700">' + L.title + '</span><span class="small muted">' + (has ? (L.kind === 'kanji' ? d.list.length + ' chữ · ' + kanjiReady(L.code) + ' chữ có mẹo' : d.list.length + ' từ · ' + exampleCount(L.code) + ' từ có ví dụ') : 'Chờ danh sách' + unit) + '</span></span></span>';
      h += '<span class="tag ' + (has ? 'ok' : 'off') + '">' + (has ? 'Sẵn sàng' : 'Chưa có' + unit) + '</span></span>';
      h += '<span class="bar"><i style="width:' + pct + '%;background:' + L.color + '"></i></span>';
      h += '<span class="row between small" style="color:var(--ink-2)"><span>Đã học ' + seen + ' · Còn ôn ' + review + '</span><span>' + (has ? (a.all ? 'Cả ' + a.n + ' cụm' : 'Được giao cụm ' + a.from + '–' + a.to) : '—') + '</span></span>';
      h += '</button>';
    });

    h += footer();
    return h;
  }

  /* ---------------- màn: chọn cụm ---------------- */
  function viewGroups() {
    var p = profile(), code = state.level, L = levelInfo(code), d = words(code);
    var l = lvState(p, code), g = groupsOf(code), a = assignOf(code, l);
    var curG = currentGroup(code, l);
    var doneCount = 0;
    g.forEach(function (ids) { if (countIn(l.seen, ids) === ids.length) doneCount++; });
    var kj = L.kind === 'kanji', unit = kj ? 'chữ' : 'từ';

    var h = '';
    h += '<div class="topbar">';
    h += '<button class="who" data-act="to-profiles"><span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span class="who-name">' + esc(p.name) + '</span><span class="who-sub">Đổi người học ›</span></span></button>';
    h += '<button class="btn" data-act="to-levels" style="min-height:40px;border-radius:999px">‹ Đổi cấp độ</button>';
    h += '</div>';
    h += '<div><h1 class="h1">' + esc(L.title.split(' · ')[0]) + ' · Chọn cụm học</h1>';
    h += '<p class="small muted" style="margin:4px 0 0">' + d.list.length + ' ' + unit + ' chia thành ' + g.length + ' cụm, mỗi cụm ' + GROUP_SIZE + ' ' + unit + '. Đã xem hết ' + doneCount + ' cụm.</p></div>';

    if (l.cur != null && d.map[l.cur]) {
      var scope = scopeIds(code, l), at = scope.indexOf(l.cur);
      h += '<button class="continue" data-act="to-study">';
      h += '<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="continue-k">HỌC TIẾP</span>';
      h += '<span class="continue-t">' + (curG ? 'Cụm ' + curG + ' · ' + unit + ' ' + groupLabel(code, curG) : 'Cả ' + d.list.length + ' ' + unit) + '</span>';
      h += '<span class="continue-s">Đang ở thẻ ' + (at >= 0 ? at + 1 : 1) + ' / ' + scope.length + '</span></span>';
      h += '<span class="continue-arrow" aria-hidden="true">' + ICON.right + '</span></button>';
    }

    h += '<div class="gtiles">';
    g.forEach(function (ids, i) {
      var k = i + 1;
      var seen = countIn(l.seen, ids), star = countIn(l.review, ids);
      var done = seen === ids.length, isCur = k === curG, out = k < a.from || k > a.to;
      var tag = done ? '✓ Xong' : isCur ? 'Đang học' : seen ? 'Đang dở' : out ? 'Chưa giao' : 'Chưa học';
      var tagCls = done ? 'ok' : (isCur || seen) ? 'cur' : 'off';
      h += '<button class="gtile' + (isCur ? ' cur' : '') + (out ? ' out' : '') + '" data-act="pick-group" data-g="' + k + '" aria-label="Cụm ' + k + ', từ ' + groupLabel(code, k) + ', đã học ' + seen + ' trên ' + ids.length + '">';
      h += '<span class="row between"><span class="gtile-no">Cụm ' + k + '</span><span class="gtag ' + tagCls + '">' + tag + '</span></span>';
      h += kj ? '<span class="gtile-kj" lang="ja">' + esc(ids.slice(0, 6).map(function (x) { return d.map[x] ? d.map[x].w : ''; }).join('')) + '…</span>' : '<span class="small muted">Từ ' + groupLabel(code, k) + '</span>';
      h += '<span class="bar" style="height:5px"><i style="width:' + Math.round(seen / ids.length * 100) + '%"></i></span>';
      h += '<span class="row between small" style="color:var(--ink-2);font-variant-numeric:tabular-nums"><span>' + seen + '/' + ids.length + '</span><span>★ ' + star + '</span></span>';
      h += '</button>';
    });
    h += '</div>';

    h += '<button class="btn" data-act="pick-group" data-g="0" style="min-height:52px;font-weight:700">Học liền cả ' + d.list.length + ' ' + unit + '</button>';

    h += '<section class="panel">';
    h += '<h2 class="h2" style="font-size:14px">Phần học được giao cho ' + esc(p.name) + '</h2>';
    h += '<div class="grid2">';
    ['from', 'to'].forEach(function (side) {
      h += '<label class="field" for="assign-' + side + '">' + (side === 'from' ? 'Từ cụm' : 'Đến cụm');
      h += '<select id="assign-' + side + '" class="select" data-assign="' + side + '">';
      for (var k = 1; k <= g.length; k++) h += '<option value="' + k + '"' + (a[side] === k ? ' selected' : '') + '>Cụm ' + k + ' (' + groupLabel(code, k) + ')</option>';
      h += '</select></label>';
    });
    h += '</div>';
    h += '<p class="small muted" style="margin:0">Cụm ngoài phần giao hiện mờ nhưng vẫn mở học được. Mặc định: giao cả ' + g.length + ' cụm.</p>';
    h += '</section>';
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
    var inRange = scopeIds(code, l);
    var curG = currentGroup(code, l), nG = groupsOf(code).length;
    var seenCount = countIn(l.seen, inRange);
    var reviewCount = countIn(l.review, inRange);
    var pos = list.indexOf(l.cur);
    if (pos < 0 && list.length) { pos = 0; l.cur = list[0]; }
    var w = pos >= 0 ? d.map[l.cur] : null;
    if (w && l.seen.indexOf(w.id) < 0) { l.seen.push(w.id); seenCount++; save(); }
    var e = w ? exampleFor(code, w.id) : null;
    var st = p.settings;

    var h = '';
    h += miniBar(code + ' · ' + (curG ? 'Cụm ' + curG : 'Cả ' + d.list.length + ' từ') + ' · ★ ' + reviewCount, list.length ? (pos + 1) + ' / ' + list.length : '0 / 0');
    h += '<header style="display:flex;flex-direction:column;gap:6px">';
    h += '<div class="eyebrow">日本語をもっと楽しく · JAPANESE EVERY DAY</div>';
    h += '<div class="row between"><div class="row" style="align-items:baseline;gap:6px"><h1 class="brand">Kotoba <span class="spark">✦</span> Studio</h1><span class="small muted" style="font-weight:600">v' + APP_VERSION + '</span></div>';
    h += '<span class="pill" aria-label="Thẻ hiện tại">' + (list.length ? (pos + 1) + ' / ' + list.length : '0 / 0') + '</span></div>';
    h += '<div class="byline">Created by <span class="sig">' + AUTHOR + '<svg class="sig-line" width="150" height="10" viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7 C 30 1, 60 10, 95 5 S 140 3, 148 6"/></svg></span></div>';
    h += '</header>';

    h += '<div class="topbar">';
    h += '<button class="who" data-act="to-profiles"><span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span class="who-name">' + esc(p.name) + '</span><span class="who-sub">Đổi người học ›</span></span></button>';
    h += '<button class="btn" data-act="to-levels" style="min-height:40px;border-radius:999px">' + esc(L.title.split(' · ')[0]) + ' ' + ICON.chev + '</button>';
    h += '</div>';

    h += '<div class="gb-row"><button class="groupbar" data-act="to-groups">';
    h += '<span style="display:flex;flex-direction:column;gap:2px;min-width:0">';
    h += '<span class="groupbar-k">' + code + ' · ' + (curG ? 'CỤM ' + curG + ' / ' + nG : 'CẢ ' + d.list.length + ' TỪ') + '</span>';
    h += '<span class="groupbar-t">' + (curG ? '<span class="nw">Từ ' + groupLabel(code, curG) + ' ·</span> ' : '') + '<span class="nw">đã học ' + seenCount + '/' + inRange.length + ' · ★ ' + reviewCount + '</span></span></span>';
    h += '<span class="groupbar-a">Đổi cụm ›</span></button><button class="srch-btn" data-act="search-open" aria-label="Tìm từ và kanji">' + ICON.search + '</button></div>';
    h += '<div class="bar" aria-hidden="true"><i style="width:' + (inRange.length ? Math.round(seenCount / inRange.length * 100) : 0) + '%"></i></div>';

    h += modesGrid(l, reviewCount, w);

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
      h += '<span class="hint">Chạm để lật · Vuốt trái/phải để đổi từ</span>';
    } else {
      h += '<span class="side-tag">MẶT SAU · NGHĨA</span>';
      h += '<span class="word" lang="ja" style="font-size:' + Math.min(44, wordSize(w.w)) + 'px">' + esc(w.w) + '</span>';
      if (!sameReading) h += '<span class="reading" lang="ja">' + esc(w.r) + '</span>';
      h += '<span class="meaning">' + esc(w.m) + '</span>';
      h += '<span class="hint">' + (e && e.t ? esc(e.t) + ' · ' : '') + 'Chạm để lật lại</span>';
    }
    h += '</button>';

    if (player.on) {
      h += playerBar();
    } else {
      h += '<div class="sayrow-wrap"><button class="btn pcnav" data-act="prev"' + (isFirst ? ' disabled' : '') + ' aria-label="Thẻ trước">' + ICON.left + 'Trước</button>' + '<button class="btn sayrow" data-act="say-word" data-speak-key="word">' + ICON.sound + 'Nghe từ này</button>' + '<button class="btn primary pcnav" data-act="next"' + (isLast ? ' disabled' : '') + ' aria-label="Thẻ sau">Tiếp' + ICON.right + '</button></div>';
    }
    if (ui.flipped && st.kanji) h += kanjiBox(code, w);
    if (isLast && curG && l.mode === 'all') {
      h += '<section class="gdone">';
      h += '<span class="gdone-ic" aria-hidden="true">✓</span>';
      h += '<h2 class="h2">' + (seenCount >= inRange.length ? 'Xong cụm ' + curG + '!' : 'Tới thẻ cuối cụm ' + curG) + '</h2>';
      h += '<p class="small" style="margin:0;color:var(--ink-2)">Đã xem ' + seenCount + '/' + inRange.length + ' từ' + (reviewCount ? '. Có ' + reviewCount + ' từ đánh dấu "Còn ôn".' : '.') + '</p>';
      h += '<div class="grid2" style="width:100%">';
      h += reviewCount ? '<button class="btn star-btn" data-act="mode-review">Ôn ' + reviewCount + ' từ khó</button>' : '<button class="btn" data-act="first">Học lại từ đầu</button>';
      h += curG < nG ? '<button class="btn primary" data-act="pick-group" data-g="' + (curG + 1) + '" data-mode="all">Sang cụm ' + (curG + 1) + ' →</button>' : '<button class="btn primary" data-act="to-groups">Về bảng cụm</button>';
      h += '</div>';
      if (reviewCount) h += '<button class="linkbtn" data-act="first">Học lại cụm từ đầu</button>';
      h += '</section>';
    } else if (isLast) {
      h += '<div class="endnote">Bạn đã tới thẻ cuối của phần này. <button data-act="first">Về thẻ đầu</button></div>';
    }
    h += '<div class="jump"><label for="jump" class="row" style="gap:6px">Tới thẻ số<input id="jump" type="number" inputmode="numeric" min="1" max="' + list.length + '" value="' + (pos + 1) + '"></label><span>/ ' + list.length + '</span><button class="btn" data-act="jump" style="min-height:38px">Đi</button><button class="btn" data-act="first" style="min-height:38px"' + (isFirst ? ' disabled' : '') + '>Về thẻ 1</button></div>';

    /* 4 khối cài đặt & nghe: đặt xuống dưới cùng (sau phần ví dụ) */
    var cfg = '<div class="toggles">' + toggleRow('opt-kanacard', 'kanaCard', st.kanaCard, 'Hiện hiragana trên flashcard');
    if (KANJI) cfg += toggleRow('opt-kanji', 'kanji', st.kanji, 'Hiện âm Hán Việt · On · Kun');
    cfg += '</div>';
    cfg += '<div class="grid2"><button class="btn" data-act="say-word" data-speak-key="word">' + ICON.sound + 'Nghe từ</button><button class="btn" data-act="flip">' + ICON.flip + 'Lật thẻ</button></div>';
    cfg += playBox(p, list.length);
    cfg += '<div class="toggles">';
    cfg += toggleRow('opt-kanaex', 'kanaEx', st.kanaEx, 'Hiện hiragana trong ví dụ');
    cfg += toggleRow('opt-vi', 'vi', st.vi, 'Hiện bản dịch tiếng Việt');
    cfg += '</div>';

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
    h += cfg;
    h += footer();
    return h;
  }

  function segRow(title, key, cur, opts) {
    var h = '<div class="seg-wrap"><span class="seg-title">' + title + '</span><div class="seg" role="group" aria-label="' + title + '">';
    opts.forEach(function (o) {
      var on = String(o[0]) === String(cur);
      h += '<button class="seg-btn' + (on ? ' on' : '') + '" data-act="play-set" data-k="' + key + '" data-v="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
    });
    return h + '</div></div>';
  }
  function voiceSelect(lang, title) {
    var list = voiceCache[lang] || [];
    var cur = pickVoice(lang);
    var h = '<div class="seg-wrap"><label class="seg-title" for="voice-' + lang + '">' + title + '</label><div class="row">';
    if (!list.length) {
      h += '<span class="small muted" style="flex:1">' + (voiceCache.loaded ? 'Máy chưa có giọng này' : 'Đang tải danh sách giọng…') + '</span>';
    } else {
      h += '<select id="voice-' + lang + '" class="select" data-voice="' + lang + '">';
      list.forEach(function (v) {
        h += '<option value="' + esc(v.voiceURI) + '"' + (cur && cur.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(voiceLabel(v)) + '</option>';
      });
      h += '</select>';
    }
    h += '<button class="btn" data-act="voice-test" data-lang="' + lang + '" data-speak-key="test-' + lang + '" style="min-height:44px;flex-shrink:0"' + (list.length ? '' : ' disabled') + '>' + ICON.sound + 'Thử</button>';
    return h + '</div></div>';
  }
  function playBox(p, count) {
    var pl = playSettings(p);
    var desc = pl.content === 'word' ? 'Chỉ từ, đọc 2 lần' : pl.content === 'full' ? 'Từ + nghĩa + ví dụ' : 'Từ + nghĩa tiếng Việt';
    var h = '<section class="playbox" aria-label="Nghe liên tục">';
    h += '<div class="row between"><h2 class="h2" style="font-size:16px">Nghe liên tục</h2>';
    h += '<button class="linkbtn" data-act="voice-panel" aria-expanded="' + ui.voicePanel + '">' + (ui.voicePanel ? 'Thu gọn' : 'Giọng đọc & cài đặt') + '</button></div>';
    h += '<div class="grid2">';
    h += '<button class="btn primary" data-act="play-seq"' + (count ? '' : ' disabled') + '>' + ICON.play + 'Theo thứ tự</button>';
    h += '<button class="btn" data-act="play-shuf"' + (count ? '' : ' disabled') + '>' + ICON.shuffle + 'Xáo trộn</button>';
    h += '</div>';
    h += '<p class="small muted" style="margin:0">' + desc + ' · nghỉ ' + pl.gap + ' giây · ' + count + ' từ' + (currentGroup(state.level, lvState(p, state.level)) ? ' trong cụm ' + currentGroup(state.level, lvState(p, state.level)) : '') + '. Màn hình sẽ được giữ sáng khi đang phát.</p>';
    if (ui.voicePanel) {
      h += '<div class="voice-panel">';
      h += segRow('Mỗi từ đọc', 'content', pl.content, [['word', 'Chỉ từ ×2'], ['meaning', 'Từ + nghĩa'], ['full', '+ Ví dụ']]);
      h += segRow('Nghỉ giữa các từ', 'gap', pl.gap, [[1, '1 giây'], [2, '2 giây'], [3, '3 giây'], [4, '4 giây']]);
      h += segRow('Tốc độ đọc', 'rate', currentRate(), [[0.7, 'Chậm'], [0.85, 'Vừa'], [1, 'Thường']]);
      h += voiceSelect('ja', 'Giọng tiếng Nhật');
      h += voiceSelect('vi', 'Giọng tiếng Việt (đọc nghĩa)');
      var best = voiceCache.ja[0];
      if (!best || voiceTier(best) < 3) {
        h += '<div class="note"><strong>Muốn giọng Nhật tự nhiên hơn?</strong> Máy bạn đang dùng giọng cơ bản. Tải giọng nâng cao (miễn phí, 1 lần): <b>Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Nhật</b> › chọn <b>Kyoko</b> hoặc <b>Otoya</b> › tải bản <b>Nâng cao</b>. Tải xong, đóng hẳn app rồi mở lại, giọng mới sẽ tự được chọn.</div>';
      }
      h += '</div>';
    }
    h += '</section>';
    return h;
  }
  function playerBar() {
    var n = player.list.length;
    var h = '<div class="player" role="region" aria-label="Đang phát">';
    h += '<div class="player-info"><span class="player-count">' + (player.paused ? 'Đã tạm dừng' : 'Đang phát') + ' ' + Math.min(player.idx + 1, n) + ' / ' + n + '</span>';
    h += '<span class="player-mode">' + (player.order === 'shuf' ? ICON.shuffle + 'Xáo trộn' : 'Theo thứ tự') + '</span></div>';
    h += '<div class="player-btns">';
    h += '<button class="btn" data-act="play-stop">' + ICON.stop + 'Dừng</button>';
    h += '<button class="btn primary" data-act="play-pause">' + (player.paused ? ICON.play + 'Tiếp tục' : ICON.pause + 'Tạm dừng') + '</button>';
    h += '<button class="btn" data-act="play-skip"' + (player.idx >= n - 1 ? ' disabled' : '') + '>Bỏ qua' + ICON.skip + '</button>';
    h += '</div></div>';
    return h;
  }

  /* Khối "Phân tích kanji" ở mặt sau: Hán Việt cả từ + On/Kun từng chữ. Thiếu dữ liệu thì không hiện. */
  function kanjiBox(code, w) {
    try {
      if (!KANJI || !w) return '';
      var info = KANJI.w && KANJI.w[code] ? KANJI.w[code][w.id] : null;
      var used = {};
      if (info && Array.isArray(info.u)) info.u.forEach(function (x) { if (Array.isArray(x) && !used[x[0]]) used[x[0]] = x; });
      var seen = {}, rows = '', prev = '';
      String(w.w).split('').forEach(function (c) {
        var k = c === '々' ? prev : c;
        prev = k;
        var d = KANJI.k[k];
        if (!d || seen[k]) return;
        seen[k] = 1;
        var u = used[k] || used[c];
        var famOpen = ui.fam && ui.fam.id === w.id && ui.fam.k === k;
        rows += '<div class="kj-row"><button class="kj-char kj-tap' + (famOpen ? ' on' : '') + '" lang="ja" data-act="kj-fam" data-k="' + esc(k) + '" aria-expanded="' + famOpen + '" aria-label="Xem các từ có chữ ' + esc(k) + '">' + esc(k) + '</button><span class="kj-info">';
        rows += '<span class="kj-hv">' + esc(d.h || '—') + (d.h ? '' : ' <span class="small muted">(chữ do Nhật tạo)</span>') + '</span>';
        rows += '<span class="kj-line"><b>On</b><span lang="ja">' + esc(d.on || '—') + '</span></span>';
        rows += '<span class="kj-line"><b>Kun</b><span lang="ja">' + esc(d.kun || '—') + '</span></span>';
        if (u) rows += '<span class="kj-used">Trong từ này đọc <span lang="ja">' + esc(u[1]) + '</span> · âm ' + (u[2] === 'on' ? 'On' : 'Kun') + '</span>';
        rows += '</span></div>';
        if (famOpen) rows += '<div class="kj-fam"><div class="small" style="font-weight:700">Họ từ của chữ <span lang="ja">' + esc(k) + '</span></div>' + famList(k, 20) + '</div>';
      });
      if (!rows) return '';
      var h = '<section class="kanji"><div class="row between" style="align-items:baseline"><h2 class="h2" style="font-size:15px">Phân tích kanji</h2>';
      if (info && info.hv) h += '<span class="kj-word">' + esc(info.hv) + '</span>';
      h += '</div>';
      if (info && info.sp) h += '<div class="small muted">Từ này có cách đọc đặc biệt, không ghép theo từng chữ.</div>';
      h += '<div class="small muted">Chạm vào chữ kanji để xem các từ khác có chữ đó.</div>';
      return h + rows + '</section>';
    } catch (err) { return ''; }
  }

  /* ---------------- mục Kanji: thẻ học từng chữ ---------------- */
  function kanjiInfo(c) {
    var d = KJD[c];
    if (d && typeof d === 'object') return d;
    var k = KANJI && KANJI.k ? KANJI.k[c] : null;
    return k ? { h: k.h, on: k.on, kun: k.kun } : null;
  }
  /* Họ từ: các từ vựng trong app có chứa chữ kanji này */
  var famCache = null;
  function famOf(c) {
    if (!famCache) {
      famCache = {};
      LEVELS.forEach(function (L) {
        if (L.kind === 'kanji') return;
        words(L.code).list.forEach(function (w) {
          var seen = {};
          Array.from(w.w).forEach(function (ch) {
            if (seen[ch] || !/[㐀-鿿]/.test(ch)) return;
            seen[ch] = 1;
            (famCache[ch] = famCache[ch] || []).push({ code: L.code, w: w });
          });
        });
      });
    }
    return famCache[c] || [];
  }
  function famList(c, limit) {
    var all = famOf(c), h = '';
    if (!all.length) return '<div class="small muted">Chưa có từ vựng nào trong app chứa chữ này.</div>';
    h += '<div class="fam">';
    all.slice(0, limit).forEach(function (x) {
      h += '<button class="fam-item" data-act="fam-go" data-code="' + x.code + '" data-id="' + x.w.id + '">';
      h += '<span class="fam-w" lang="ja">' + esc(x.w.w) + '</span><span class="fam-r" lang="ja">' + esc(x.w.r || '') + '</span>';
      h += '<span class="fam-m">' + esc(x.w.m || '') + '</span><span class="fam-lv">' + x.code + ' ›</span></button>';
    });
    h += '</div>';
    if (all.length > limit) h += '<div class="small muted">… và ' + (all.length - limit) + ' từ khác.</div>';
    return h;
  }
  function kanjiSpeech(info) {
    if (!info) return '';
    var parts = [];
    String(info.on || '').split('・').forEach(function (x) { if (x) parts.push(x); });
    String(info.kun || '').split('・').forEach(function (x) { x = x.replace(/[()（）.]/g, ''); if (x) parts.push(x); });
    return parts.join('、');
  }
  function viewKanjiStudy() {
    var p = profile(), code = state.level, L = levelInfo(code), d = words(code);
    var l = lvState(p, code);
    var list = studyList(p, code);
    var inRange = scopeIds(code, l);
    var curG = currentGroup(code, l), nG = groupsOf(code).length;
    var seenCount = countIn(l.seen, inRange);
    var reviewCount = countIn(l.review, inRange);
    var pos = list.indexOf(l.cur);
    if (pos < 0 && list.length) { pos = 0; l.cur = list[0]; }
    var w = pos >= 0 ? d.map[l.cur] : null;
    if (w && l.seen.indexOf(w.id) < 0) { l.seen.push(w.id); seenCount++; save(); }
    var st = p.settings;
    var info = w ? kanjiInfo(w.w) : null;

    var h = '';
    h += miniBar('Kanji ' + L.short + ' · ' + (curG ? 'Cụm ' + curG : 'Cả ' + d.list.length + ' chữ') + ' · ★ ' + reviewCount, list.length ? (pos + 1) + ' / ' + list.length : '0 / 0');
    h += '<header style="display:flex;flex-direction:column;gap:6px">';
    h += '<div class="eyebrow">日本語をもっと楽しく · KANJI EVERY DAY</div>';
    h += '<div class="row between"><div class="row" style="align-items:baseline;gap:6px"><h1 class="brand">Kotoba <span class="spark">✦</span> Studio</h1><span class="small muted" style="font-weight:600">v' + APP_VERSION + '</span></div>';
    h += '<span class="pill" aria-label="Thẻ hiện tại">' + (list.length ? (pos + 1) + ' / ' + list.length : '0 / 0') + '</span></div>';
    h += '<div class="byline">Created by <span class="sig">' + AUTHOR + '<svg class="sig-line" width="150" height="10" viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7 C 30 1, 60 10, 95 5 S 140 3, 148 6"/></svg></span></div>';
    h += '</header>';

    h += '<div class="topbar">';
    h += '<button class="who" data-act="to-profiles"><span class="avatar" style="background:' + esc(p.color) + '">' + esc(initial(p.name)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span class="who-name">' + esc(p.name) + '</span><span class="who-sub">Đổi người học ›</span></span></button>';
    h += '<button class="btn" data-act="to-levels" style="min-height:40px;border-radius:999px">Kanji ' + esc(L.short) + ' ' + ICON.chev + '</button>';
    h += '</div>';

    h += '<div class="gb-row"><button class="groupbar" data-act="to-groups">';
    h += '<span style="display:flex;flex-direction:column;gap:2px;min-width:0">';
    h += '<span class="groupbar-k">KANJI ' + esc(L.short) + ' · ' + (curG ? 'CỤM ' + curG + ' / ' + nG : 'CẢ ' + d.list.length + ' CHỮ') + '</span>';
    h += '<span class="groupbar-t">' + (curG ? '<span class="nw">Chữ ' + groupLabel(code, curG) + ' ·</span> ' : '') + '<span class="nw">đã học ' + seenCount + '/' + inRange.length + ' · ★ ' + reviewCount + '</span></span></span>';
    h += '<span class="groupbar-a">Đổi cụm ›</span></button><button class="srch-btn" data-act="search-open" aria-label="Tìm từ và kanji">' + ICON.search + '</button></div>';
    h += '<div class="bar" aria-hidden="true"><i style="width:' + (inRange.length ? Math.round(seenCount / inRange.length * 100) : 0) + '%"></i></div>';

    h += modesGrid(l, reviewCount, w);

    if (!w) {
      h += '<div class="empty">' + (l.mode === 'review'
        ? 'Chưa có chữ nào được đánh dấu "Còn ôn" trong phần học này. Khi học, bấm ☆ Còn ôn ở những chữ chưa thuộc.'
        : 'Phần học này chưa có chữ nào.') + '</div>';
      if (l.mode === 'review') h += '<button class="btn primary" data-act="mode-all">Quay lại học tất cả</button>';
      h += footer();
      return h;
    }

    var isLast = pos === list.length - 1, isFirst = pos === 0;
    var inReview = l.review.indexOf(w.id) >= 0;
    var tip = info && info.t ? info.t : '';

    h += '<button class="card kjcard' + (ui.flipped ? ' back' : '') + (ui.slide ? ' ' + ui.slide : '') + '" id="card" data-act="flip" aria-label="' + (ui.flipped ? 'Mặt sau, chạm để lật lại' : 'Mặt trước, chạm để xem âm đọc') + '">';
    if (!ui.flipped) {
      h += '<span class="side-tag">MẶT TRƯỚC · KANJI</span>';
      h += '<span class="kj-big" lang="ja">' + esc(w.w) + '</span>';
      if (st.kjTip && tip) h += '<span class="kj-story"><span class="label">MẸO NHỚ</span><span>' + esc(tip) + '</span></span>';
      else if (st.kjTip) h += '<span class="kj-story muted">Chữ này chưa có mẹo nhớ, sẽ được bổ sung theo đợt.</span>';
      h += '<span class="hint">Chạm để lật · Vuốt trái/phải để đổi chữ</span>';
    } else {
      h += '<span class="side-tag">MẶT SAU · ÂM ĐỌC</span>';
      h += '<span class="kj-mid" lang="ja">' + esc(w.w) + '</span>';
      if (info) {
        h += '<span class="kj-hvbig">' + esc(info.h || '—') + '</span>';
        if (info.m) h += '<span class="meaning">' + esc(info.m) + '</span>';
        h += '<span class="kj-read"><span class="kj-line"><b>On</b><span lang="ja">' + esc(info.on || '—') + '</span></span>';
        h += '<span class="kj-line"><b>Kun</b><span lang="ja">' + esc(info.kun || '—') + '</span></span></span>';
      } else {
        h += '<span class="small muted">Chữ này chưa có dữ liệu âm đọc, sẽ được bổ sung theo đợt.</span>';
      }
      h += '<span class="hint">Chạm để lật lại</span>';
    }
    h += '</button>';
    h += '<button class="btn tipbtn' + (st.kjTip ? ' on' : '') + '" data-act="kj-tip" aria-pressed="' + !!st.kjTip + '">' + (st.kjTip ? 'Ẩn mẹo' : 'Hiện mẹo') + '</button>';

    h += '<div class="sayrow-wrap"><button class="btn pcnav" data-act="prev"' + (isFirst ? ' disabled' : '') + ' aria-label="Thẻ trước">' + ICON.left + 'Trước</button>' + '<button class="btn sayrow" data-act="say-word" data-speak-key="word"' + (kanjiSpeech(info) ? '' : ' disabled') + '>' + ICON.sound + 'Nghe On · Kun</button>' + '<button class="btn primary pcnav" data-act="next"' + (isLast ? ' disabled' : '') + ' aria-label="Thẻ sau">Tiếp' + ICON.right + '</button></div>';
    if (isLast && curG && l.mode === 'all') {
      h += '<section class="gdone">';
      h += '<span class="gdone-ic" aria-hidden="true">✓</span>';
      h += '<h2 class="h2">' + (seenCount >= inRange.length ? 'Xong cụm ' + curG + '!' : 'Tới thẻ cuối cụm ' + curG) + '</h2>';
      h += '<p class="small" style="margin:0;color:var(--ink-2)">Đã xem ' + seenCount + '/' + inRange.length + ' chữ' + (reviewCount ? '. Có ' + reviewCount + ' chữ đánh dấu "Còn ôn".' : '.') + '</p>';
      h += '<div class="grid2" style="width:100%">';
      h += reviewCount ? '<button class="btn star-btn" data-act="mode-review">Ôn ' + reviewCount + ' chữ khó</button>' : '<button class="btn" data-act="first">Học lại từ đầu</button>';
      h += curG < nG ? '<button class="btn primary" data-act="pick-group" data-g="' + (curG + 1) + '" data-mode="all">Sang cụm ' + (curG + 1) + ' →</button>' : '<button class="btn primary" data-act="to-groups">Về bảng cụm</button>';
      h += '</div>';
      if (reviewCount) h += '<button class="linkbtn" data-act="first">Học lại cụm từ đầu</button>';
      h += '</section>';
    } else if (isLast) {
      h += '<div class="endnote">Bạn đã tới thẻ cuối của phần này. <button data-act="first">Về thẻ đầu</button></div>';
    }
    h += '<div class="jump"><label for="jump" class="row" style="gap:6px">Tới thẻ số<input id="jump" type="number" inputmode="numeric" min="1" max="' + list.length + '" value="' + (pos + 1) + '"></label><span>/ ' + list.length + '</span><button class="btn" data-act="jump" style="min-height:38px">Đi</button><button class="btn" data-act="first" style="min-height:38px"' + (isFirst ? ' disabled' : '') + '>Về thẻ 1</button></div>';
    h += '<div class="grid2"><button class="btn" data-act="say-word" data-speak-key="word"' + (kanjiSpeech(info) ? '' : ' disabled') + '>' + ICON.sound + 'Nghe On · Kun</button><button class="btn" data-act="flip">' + ICON.flip + 'Lật thẻ</button></div>';

    if (ui.flipped) {
      h += '<section class="kanji"><h2 class="h2" style="font-size:15px">Từ vựng có chữ <span lang="ja">' + esc(w.w) + '</span></h2>';
      h += famList(w.w, 12) + '</section>';
    }
    h += footer();
    return h;
  }

  /* v1.8: dải thu gọn hiện khi kéo xuống */
  function miniBar(left, pill) {
    return '<div class="minibar" id="minibar" aria-hidden="true"><div class="minibar-in"><button class="minibar-main" data-act="to-groups"><span class="minibar-t">' + esc(left) + '</span><span class="minibar-r"><span class="pill">' + esc(pill) + '</span><span class="minibar-a">Đổi cụm ›</span></span></button><button class="srch-btn sm" data-act="search-open" aria-label="Tìm từ và kanji">' + ICON.search + '</button></div></div>';
  }
  function modesGrid(l, reviewCount, w) {
    var inReview = w ? l.review.indexOf(w.id) >= 0 : false;
    var h = '<div class="modes" role="group" aria-label="Chế độ học">';
    h += '<button class="mode' + (l.mode === 'all' ? ' on' : '') + '" data-act="mode-all" aria-pressed="' + (l.mode === 'all') + '">Học tất cả</button>';
    h += '<button class="mode' + (l.shuffle ? ' on' : '') + '" data-act="shuffle" aria-pressed="' + l.shuffle + '">Xáo trộn</button>';
    h += '<button class="mode' + (l.mode === 'review' ? ' on' : '') + '" data-act="mode-review" aria-pressed="' + (l.mode === 'review') + '">Chỉ ôn "Còn ôn" (' + reviewCount + ')</button>';
    if (w) h += '<button class="mode star' + (inReview ? ' on' : '') + '" data-act="toggle-review" aria-pressed="' + inReview + '">' + (inReview ? ICON.starOn + 'Đã đánh dấu' : ICON.star + 'Còn ôn') + '</button>';
    return h + '</div>';
  }
  function updateMiniBar() {
    var m = document.getElementById('minibar'); if (!m) return;
    var g = root.querySelector('.groupbar');
    var show = !!g && g.getBoundingClientRect().bottom < 0;
    if (m.classList.contains('show') !== show) {
      m.classList.toggle('show', show);
      m.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
  }

  function toggleRow(id, opt, on, label) {
    return '<label class="toggle" for="' + id + '"><span>' + label + '</span>' +
      '<input type="checkbox" role="switch" id="' + id + '" data-opt="' + opt + '"' + (on ? ' checked' : '') + '>' +
      '<span class="switch" aria-hidden="true"></span></label>';
  }

  function footer() {
    var orn = function (flip) {
      return '<svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '><path d="M2 6 H22 M26 6 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0"/></svg>';
    };
    return '<footer class="footer"><span class="made">MADE WITH CARE BY</span>' +
      '<div class="sig-row">' + orn(false) + '<span class="sig sig-lg">' + AUTHOR + '</span>' + orn(true) + '</div>' +
      '<svg class="sig-line" width="200" height="12" viewBox="0 0 200 12" aria-hidden="true"><path d="M4 8 C 50 0, 100 12, 150 5 S 190 4, 196 7"/></svg>' +
      '<p>Dùng tốt nhất trên Safari iPhone: bấm Chia sẻ › Thêm vào Màn hình chính. Tiến độ và danh sách "Còn ôn" được lưu trên máy của bạn.</p></footer>';
  }

  /* ---------------- vẽ ---------------- */
  function render(keepScroll) {
    var y = window.scrollY;
    try {
      if (ui.view !== 'profiles' && !profile()) ui.view = 'profiles';
      if ((ui.view === 'study' || ui.view === 'groups') && !words(state.level).list.length) ui.view = 'levels';
      root.innerHTML = ui.view === 'profiles' ? viewProfiles() : ui.view === 'levels' ? viewLevels() : ui.view === 'groups' ? viewGroups() : (isKanji(state.level) ? viewKanjiStudy() : viewStudy());
      document.body.classList.toggle('has-nav', !!root.querySelector('.nav, .player'));
      document.body.classList.toggle('has-player', !!root.querySelector('.player'));
      markSpeaking();
    } catch (err) {
      root.innerHTML = '<div class="fatal"><strong>Có lỗi khi hiển thị.</strong><br>Tiến độ của bạn vẫn được giữ nguyên. Hãy tải lại trang.<br><button class="btn" style="margin-top:10px" data-act="reload">Tải lại</button></div>';
      if (window.console) console.error(err);
    }
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    try { updateMiniBar(); } catch (e) { /* không ảnh hưởng app */ }
  }

  /* ---------------- hành động ---------------- */
  function go(delta) {
    if (player.on) { playerMove(delta); return; }
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
    if (speakingKey) stopSpeech();
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
    var PLAYER_SAFE = { 'play-pause': 1, 'play-skip': 1, 'play-stop': 1, 'flip': 1, 'toggle-review': 1, 'say-word': 1, 'say-ex': 1, 'voice-panel': 1, 'voice-test': 1, 'play-set': 1, 'prev': 1, 'next': 1 };
    if (player.on && !PLAYER_SAFE[act]) stopPlayer(true);

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
        if (!words(code).list.length) { toast(isKanji(code) ? 'Chưa tải được danh sách kanji.' : 'Cấp độ ' + code + ' chưa có danh sách từ.'); return; }
        state.level = code; state.section = isKanji(code) ? 'kanji' : 'vocab'; resetList(); ui.flipped = false; save(); ui.view = 'groups'; render(); return;
      }
      case 'to-groups': ui.view = 'groups'; ui.flipped = false; render(); return;
      case 'to-study': ui.view = 'study'; ui.flipped = false; render(); return;
      case 'pick-group': {
        if (!p) return;
        var gl = lvState(p, state.level), gk = parseInt(t.getAttribute('data-g'), 10) || 0;
        var gn = groupsOf(state.level).length;
        gl.group = gk >= 1 && gk <= gn ? gk : 0;
        if (t.getAttribute('data-mode') === 'all') gl.mode = 'all';
        var gscope = scopeIds(state.level, gl);
        if (gscope.indexOf(gl.cur) < 0) {
          var firstNew = null;
          for (var gi = 0; gi < gscope.length; gi++) if (gl.seen.indexOf(gscope[gi]) < 0) { firstNew = gscope[gi]; break; }
          gl.cur = firstNew != null ? firstNew : gscope[0];
        }
        resetList(); ui.flipped = false; save(); ui.view = 'study'; render(); return;
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
      case 'say-word': {
        var ww = currentWord(); if (!ww) return;
        if (isKanji(state.level)) { var ks = kanjiSpeech(kanjiInfo(ww.w)); if (ks) speak(ks, 'word', 'ja'); return; }
        speak(ww.w, 'word'); return;
      }
      case 'section': state.section = t.getAttribute('data-v') === 'kanji' ? 'kanji' : 'vocab'; save(); render(true); return;
      case 'kj-tip': if (!p) return; p.settings.kjTip = !p.settings.kjTip; save(); render(true); return;
      case 'kj-fam': {
        var fw = currentWord(), fk = t.getAttribute('data-k'); if (!fw || !fk) return;
        ui.fam = ui.fam && ui.fam.id === fw.id && ui.fam.k === fk ? null : { id: fw.id, k: fk };
        render(true); return;
      }
      case 'fam-go': {
        if (!p) return;
        var fc = t.getAttribute('data-code'), fid = parseInt(id, 10);
        if (isKanji(fc) || !words(fc).map[fid]) return;
        var fl = lvState(p, fc);
        state.level = fc; state.section = 'vocab';
        fl.group = groupOfId(fc, fid); fl.mode = 'all'; fl.cur = fid;
        ui.fam = null; resetList(); ui.flipped = false; save(); ui.view = 'study'; render();
        toast('Đã mở từ ' + words(fc).map[fid].w + ' (cụm ' + fl.group + ').'); return;
      }
      case 'search-open': openSearch(); return;
      case 'play-seq': startPlayer('seq'); return;
      case 'play-shuf': startPlayer('shuf'); return;
      case 'play-pause': if (player.paused) resumePlayer(); else pausePlayer(); return;
      case 'play-skip': if (player.on) playerMove(1); return;
      case 'play-stop': stopPlayer(); return;
      case 'voice-panel': ui.voicePanel = !ui.voicePanel; if (ui.voicePanel) loadVoices(); render(true); return;
      case 'voice-test': {
        var tl = t.getAttribute('data-lang');
        speak(tl === 'vi' ? 'Xin chào, đây là giọng đọc tiếng Việt.' : 'こんにちは。日本の生活にはもう慣れましたか。', 'test-' + tl, tl);
        return;
      }
      case 'play-set': {
        if (!p) return;
        var k = t.getAttribute('data-k'), v = t.getAttribute('data-v');
        if (!p.settings.play) p.settings.play = { content: 'meaning', gap: 4 };
        if (k === 'content' && ['word', 'meaning', 'full'].indexOf(v) >= 0) p.settings.play.content = v;
        else if (k === 'gap') { var gv = parseInt(v, 10); p.settings.play.gap = [1, 2, 3, 4].indexOf(gv) >= 0 ? gv : 4; }
        else if (k === 'rate' && RATES.indexOf(parseFloat(v)) >= 0) p.settings.rate = parseFloat(v);
        save(); render(true); return;
      }
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
    var aside = t && t.getAttribute && t.getAttribute('data-assign');
    if (aside) {
      var ap = profile(); if (!ap) return;
      var al = lvState(ap, state.level), ag = groupsOf(state.level);
      var fEl = document.getElementById('assign-from'), tEl = document.getElementById('assign-to');
      var af = parseInt(fEl ? fEl.value : '1', 10) || 1, at = parseInt(tEl ? tEl.value : String(ag.length), 10) || ag.length;
      if (af > at) { var sw = af; af = at; at = sw; }
      if (af === 1 && at === ag.length) { al.assign = null; al.from = null; al.to = null; }
      else {
        al.assign = { from: af, to: at };
        al.from = ag[af - 1][0];
        al.to = ag[at - 1][ag[at - 1].length - 1];
      }
      save(); render(true);
      toast(al.assign ? 'Đã giao cụm ' + af + '–' + at + ' cho ' + ap.name + '.' : 'Đã giao cả ' + ag.length + ' cụm.');
      return;
    }
    var vlang = t && t.getAttribute && t.getAttribute('data-voice');
    if (vlang) {
      state.voice[vlang] = t.value;
      save();
      toast('Đã chọn giọng mới.');
      return;
    }
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

  /* Tạm ẩn thanh nút ghim khi bàn phím đang mở (đang gõ vào ô nhập) */
  function isTextInput(el) {
    return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox'));
  }
  document.addEventListener('focusin', function (ev) {
    if (isTextInput(ev.target)) document.body.classList.add('typing');
  });
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      if (!isTextInput(document.activeElement)) document.body.classList.remove('typing');
    }, 50);
  });

  document.addEventListener('keydown', function (ev) {
    if (ui.view !== 'study' || document.body.classList.contains('srch-open')) return;
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

  /* ---------------- v2.0: tìm từ & kanji trong mọi cụm ---------------- */
  var srchIdx = null, srchEl = null, SRCH_MAX = 30;
  function foldVi(x) {
    return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }
  function lowVi(x) { return String(x || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function toHira(x) {
    return String(x || '').replace(/[ァ-ヶ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
  }
  function kanaKey(x) { return toHira(x).replace(/[\s.・()（）\-ー〜~]/g, function (ch) { return ch === 'ー' ? 'ー' : ''; }); }
  function partsOf(x, fn) {
    return String(x || '').split(/[,;、，/・()（）]+/).map(fn).filter(function (v) { return v; });
  }
  function buildSearchIndex() {
    var vocab = [], kanji = [];
    LEVELS.forEach(function (L) {
      var d = words(L.code);
      if (!d.list.length) return;
      if (isKanji(L.code)) {
        d.list.forEach(function (w) {
          var info = kanjiInfo(w.w) || {};
          kanji.push({ code: L.code, id: w.id, w: w.w, h: info.h || '', m: info.m || '',
            hv: partsOf(info.h, foldVi), mm: partsOf(info.m, foldVi), mf: foldVi(info.m),
            hvA: partsOf(info.h, lowVi), mmA: partsOf(info.m, lowVi), mfA: lowVi(info.m),
            rd: partsOf((info.on || '') + '・' + (info.kun || ''), kanaKey) });
        });
      } else {
        d.list.forEach(function (w) {
          vocab.push({ code: L.code, id: w.id, w: w.w, r: w.r || '', m: w.m || '',
            rk: kanaKey(w.r), mm: partsOf(w.m, foldVi), mf: foldVi(w.m), mmA: partsOf(w.m, lowVi), mfA: lowVi(w.m) });
        });
      }
    });
    return { vocab: vocab, kanji: kanji };
  }
  function rank(val, q) { if (!q || !val) return 9; if (val === q) return 0; if (val.indexOf(q) === 0) return 1; if (val.indexOf(q) > 0) return 2; return 9; }
  function rankList(arr, q) { var b = 9; for (var i = 0; i < arr.length; i++) { var r = rank(arr[i], q); if (r < b) b = r; } return b; }
  function runSearch(raw) {
    if (!srchIdx) srchIdx = buildSearchIndex();
    var q = String(raw || '').trim();
    var qv = foldVi(q), qa = lowVi(q), qk = kanaKey(q), hasJa = /[぀-ヿ㐀-鿿]/.test(q);
    var accent = qa !== qv; /* có gõ dấu thì tìm đúng dấu; không dấu thì tìm rộng */
    var out = { vocab: [], kanji: [] };
    if (!q) return out;
    srchIdx.vocab.forEach(function (e) {
      var s = 9;
      if (hasJa) { s = Math.min(rank(e.w, q), rank(e.rk, qk)); }
      else {
        var sa = Math.min(rankList(e.mmA, qa), rank(e.mfA, qa) + 0.5);
        s = accent ? sa : Math.min(sa < 9 ? sa - 0.3 : 9, rankList(e.mm, qv), rank(e.mf, qv) + 0.5);
      }
      if (s < 9) out.vocab.push({ e: e, s: s });
    });
    var chars = {};
    Array.from(q).forEach(function (c) { if (/[㐀-鿿]/.test(c)) chars[c] = 1; });
    srchIdx.kanji.forEach(function (e) {
      var s = 9;
      if (hasJa) {
        if (chars[e.w]) s = q === e.w ? 0 : 1;
        else if (qk && /^[぀-ゟ]+$/.test(qk)) s = Math.min(9, rankList(e.rd, qk) + 1);
      } else {
        var ka = Math.min(rankList(e.hvA, qa), rankList(e.mmA, qa) + 0.2, rank(e.mfA, qa) + 0.7);
        s = accent ? ka : Math.min(ka < 9 ? ka - 0.3 : 9, rankList(e.hv, qv), rankList(e.mm, qv) + 0.2, rank(e.mf, qv) + 0.7);
      }
      if (s < 9) out.kanji.push({ e: e, s: s });
    });
    var by = function (a, b) { return a.s - b.s || (a.e.code < b.e.code ? -1 : a.e.code > b.e.code ? 1 : a.e.id - b.e.id); };
    out.vocab.sort(by); out.kanji.sort(by);
    return out;
  }
  function srchSection(title, arr, kind) {
    if (!arr.length) return '';
    var h = '<section class="srch-sec"><h2 class="srch-h">' + title + ' <span>' + arr.length + (arr.length > SRCH_MAX ? ' · hiện ' + SRCH_MAX + ' kết quả đầu' : '') + '</span></h2>';
    arr.slice(0, SRCH_MAX).forEach(function (x) {
      var e = x.e, L = levelInfo(e.code), g = groupOfId(e.code, e.id);
      h += '<button class="srch-item" data-s="go" data-code="' + e.code + '" data-id="' + e.id + '">';
      if (kind === 'v') {
        h += '<span class="srch-w" lang="ja">' + esc(e.w) + '</span><span class="srch-mid"><span class="srch-r" lang="ja">' + esc(e.r) + '</span><span class="srch-m">' + esc(e.m) + '</span></span>';
        h += '<span class="srch-lv">' + esc(e.code) + ' · Cụm ' + g + '</span>';
      } else {
        h += '<span class="srch-w kj" lang="ja">' + esc(e.w) + '</span><span class="srch-mid"><span class="srch-r">' + esc(e.h || '—') + '</span><span class="srch-m">' + esc(e.m || '') + '</span></span>';
        h += '<span class="srch-lv">Kanji ' + esc(L.short) + ' · Cụm ' + g + '</span>';
      }
      h += '</button>';
    });
    return h + '</section>';
  }
  function renderSearch() {
    if (!srchEl) return;
    var q = srchEl.querySelector('#srch-q').value;
    var box = srchEl.querySelector('#srch-res');
    if (!q.trim()) {
      box.innerHTML = '<p class="srch-hint">Gõ chữ Nhật (基準), hiragana (きじゅん), nghĩa tiếng Việt (tiêu chuẩn / tieu chuan) hoặc âm Hán Việt (chuan). Tìm trong tất cả các cụm Từ vựng và Kanji.</p>';
      return;
    }
    var r = runSearch(q);
    if (!r.vocab.length && !r.kanji.length) { box.innerHTML = '<p class="srch-hint">Không tìm thấy kết quả cho “' + esc(q.trim()) + '”.</p>'; return; }
    box.innerHTML = srchSection('Từ vựng', r.vocab, 'v') + srchSection('Kanji', r.kanji, 'k');
  }
  function ensureSearchEl() {
    if (srchEl) return srchEl;
    srchEl = document.createElement('div');
    srchEl.id = 'srch'; srchEl.className = 'srch'; srchEl.hidden = true;
    srchEl.setAttribute('role', 'dialog'); srchEl.setAttribute('aria-modal', 'true'); srchEl.setAttribute('aria-label', 'Tìm từ và kanji');
    srchEl.innerHTML = '<div class="srch-top"><div class="srch-bar"><label class="srch-field">' + ICON.search +
      '<input id="srch-q" type="search" placeholder="Tìm từ, hiragana, nghĩa, kanji…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Từ cần tìm"></label>' +
      '<button class="srch-x" data-s="close" aria-label="Đóng tìm kiếm">✕</button></div></div><div class="srch-body" id="srch-res" aria-live="polite"></div>';
    document.body.appendChild(srchEl);
    var inp = srchEl.querySelector('#srch-q'), tmr = 0;
    inp.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(renderSearch, 80); });
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    srchEl.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); closeSearch(); } });
    srchEl.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-s]'); if (!t) return;
      if (t.getAttribute('data-s') === 'close') { closeSearch(); return; }
      if (t.getAttribute('data-s') === 'go') openFromSearch(t.getAttribute('data-code'), parseInt(t.getAttribute('data-id'), 10));
    });
    return srchEl;
  }
  function openSearch() {
    var el = ensureSearchEl();
    el.hidden = false; document.body.classList.add('srch-open');
    var inp = el.querySelector('#srch-q');
    renderSearch();
    try { inp.focus(); inp.select(); } catch (e) { /* bỏ qua */ }
  }
  function closeSearch() {
    if (!srchEl || srchEl.hidden) return;
    srchEl.hidden = true; document.body.classList.remove('srch-open');
    try { var b = root.querySelector('[data-act="search-open"]'); if (b && b.offsetParent) b.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ }
  }
  function openFromSearch(code, id) {
    var p = profile(); if (!p || !words(code).map[id]) return;
    if (player.on) stopPlayer(true);
    var l = lvState(p, code);
    state.level = code; state.section = isKanji(code) ? 'kanji' : 'vocab';
    l.group = groupOfId(code, id); l.mode = 'all'; l.cur = id;
    ui.fam = null; resetList(); ui.flipped = false; ui.view = 'study';
    save(); closeSearch(); render();
    toast('Đã mở ' + words(code).map[id].w + ' (' + (isKanji(code) ? 'Kanji ' + levelInfo(code).short : code) + ' · cụm ' + l.group + ').');
  }

  /* v1.8: hiện/ẩn dải thu gọn theo vị trí cuộn */
  var miniTick = false;
  window.addEventListener('scroll', function () {
    if (miniTick) return; miniTick = true;
    requestAnimationFrame(function () { miniTick = false; try { updateMiniBar(); } catch (e) { /* bỏ qua */ } });
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
