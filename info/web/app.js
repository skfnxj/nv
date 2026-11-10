/* ===================================================================
   THE HOUSE — 코르부스 그룹 직원 포털 (세계관 체험용 가상 사이트)
   =================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const store = {
  get(k) { try { return localStorage.getItem("house:" + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("house:" + k, v); } catch {} },
};

/* ---------- 화면 전환 ---------- */
function show(id) {
  $$(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  document.body.className = id === "front" ? "theme-front" : "";
  scrollTo(0, 0);
}
function toast(t, ms = 2600) {
  const el = $("#toast");
  el.textContent = t; el.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), ms);
}
function glitch() { const g = $("#glitch"); g.classList.remove("go"); void g.offsetWidth; g.classList.add("go"); }

/* ===================================================================
   BGM — 외부 파일 없이 WebAudio로 만드는 느와르 재즈 루프
   하우스: 느린 마이너 9th 패드 + 워킹 베이스 + LP 잡음
   언더럭스: 더 어두운 코드 + 심장 박동
   =================================================================== */
const BGM = {
  ctx: null, on: false, mode: "house", timer: null, bar: 0,
  prog: {
    house: [[45, [60, 64, 67, 71]], [41, [57, 60, 64, 69]], [38, [53, 57, 60, 64]], [40, [56, 59, 62, 65]]],
    ux:    [[36, [63, 67, 70, 74]], [32, [60, 63, 67, 72]], [29, [60, 65, 68, 72]], [31, [59, 62, 65, 67]]],
    // 공개 사이트(코르부스 로비): 밝은 호텔 라운지 보사풍 — Cmaj9 · Am9 · Fmaj9 · G13
    corp:  [[36, [55, 59, 62, 64]], [45, [55, 60, 64, 71]], [41, [52, 57, 60, 67]], [43, [53, 57, 59, 64]]],
  },
  // 로비 피아노 같은 높은 음 한두 개
  // 오르골: 쇠 빗살을 튕기는 소리 — 맑은 기본음 + 금방 사라지는 금속 배음(빗살 특유의 6.27배) + 살짝 어긋난 쌍둥이 빗살
  musicbox(t, m, vol) {
    const c = this.ctx, f0 = this.hz(m), out = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 6000;
    out.gain.value = vol; out.connect(lp); lp.connect(this.master); lp.connect(this.delay);
    [[1, 1, 1.6], [1.003, .35, 1.4], [2, .08, .5], [6.27, .12, .12]].forEach(([r, a, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f0 * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .003); g.gain.exponentialRampToValueAtTime(.0003, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
    });
  },
  // 하프: 줄을 뜯는 소리를 직접 계산(카플러스-스트롱). 음마다 한 번 만들어 두고 재사용
  harpBuf: {},
  harp(t, m, vol) {
    const c = this.ctx, sr = c.sampleRate;
    if (!this.harpBuf[m]) {
      const len = Math.floor(sr * 3), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
      const P = Math.max(2, Math.round(sr / this.hz(m))), line = new Float32Array(P);
      for (let i = 0; i < P; i++) line[i] = (Math.random() * 2 - 1) * (1 - i / P * .5); // 손가락으로 뜯은 부드러운 시작
      const damp = .4985 + Math.min(.0012, 20 / this.hz(m) * .001); // 낮은 줄일수록 오래 울림
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const k = i % P, v = line[k];
        d[i] = v;
        line[k] = (v + prev) * damp; prev = v;
      }
      this.harpBuf[m] = buf;
    }
    const s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter();
    s.buffer = this.harpBuf[m]; lp.type = "lowpass"; lp.frequency.value = 3800;
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 2.95); // 낮은 줄이 뚝 끊기지 않게
    s.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.delay);
    s.start(t); s.stop(t + 3);
  },
  // 그랜드피아노: 배음 6개(살짝 어긋난 현의 배음), 높은 배음일수록 빨리 사라짐,
  // 해머가 현을 때리는 짧은 소리, 시간이 지나며 어두워지는 필터
  piano(t, m, vol, len = 3.2) {
    const c = this.ctx, f0 = this.hz(m), out = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = .5;
    lp.frequency.setValueAtTime(Math.min(9000, f0 * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, f0 * 2.2), t + 1.4);
    out.gain.value = vol; out.connect(lp); lp.connect(this.master); lp.connect(this.delay);
    [1, .55, .32, .2, .12, .07].forEach((a, i) => {
      const n = i + 1, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f0 * n * Math.sqrt(1 + .0004 * n * n); o.detune.value = (Math.random() - .5) * 3;
      const d = len / (1 + i * .9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .004);
      g.gain.exponentialRampToValueAtTime(a * .35, t + .25); g.gain.exponentialRampToValueAtTime(.0003, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
    });
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), hg = c.createGain();
    s.buffer = this.noiseBuf; bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 1;
    hg.gain.setValueAtTime(.25, t); hg.gain.exponentialRampToValueAtTime(.0003, t + .03);
    s.connect(bp); bp.connect(hg); hg.connect(out); s.start(t, Math.random()); s.stop(t + .04);
  },
  // 비브라폰: 둥근 기본음 + 아주 옅은 4배 배음(쇠판 소리) + 느린 떨림(트레몰로)
  vibe(t, m, vol) {
    const c = this.ctx, o = c.createOscillator(), o4 = c.createOscillator(), g = c.createGain(), g4 = c.createGain();
    const trem = c.createGain(), lfo = c.createOscillator(), depth = c.createGain(), f = c.createBiquadFilter();
    o.type = "sine"; o.frequency.value = this.hz(m);
    o4.type = "sine"; o4.frequency.value = this.hz(m) * 4; g4.gain.setValueAtTime(.06, t); g4.gain.exponentialRampToValueAtTime(.0003, t + .35);
    lfo.frequency.value = 5.2; depth.gain.value = .28; trem.gain.value = .72; lfo.connect(depth); depth.connect(trem.gain);
    f.type = "lowpass"; f.frequency.value = 2600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0004, t + 2.6);
    o.connect(g); o4.connect(g4); g4.connect(g); g.connect(trem); trem.connect(f); f.connect(this.master); f.connect(this.delay);
    [o, o4, lfo].forEach(x => { x.start(t); x.stop(t + 2.7); });
  },
  // 부드러운 로즈 피아노 느낌: 높은 배음 없이, 천천히 피어나고 필터로 둥글게
  bell(t, m, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = this.hz(m);
    f.type = "lowpass"; f.frequency.value = 1200; f.Q.value = .3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .04); g.gain.exponentialRampToValueAtTime(.0004, t + 1.8);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.9);
  },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),
  init() {
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    // 공간감: 짧은 피드백 딜레이
    this.delay = c.createDelay(); this.delay.delayTime.value = .32;
    const fb = c.createGain(); fb.gain.value = .28;
    this.delay.connect(fb); fb.connect(this.delay);
    const wet = c.createGain(); wet.gain.value = .35;
    this.delay.connect(wet); wet.connect(this.master);
    // LP 잡음 (계속 흐름)
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .012 + (Math.random() < .0006 ? (Math.random() - .5) * .6 : 0);
    const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 2400; nf.Q.value = .6;
    const ng = c.createGain(); ng.gain.value = .5;
    n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start();
    this.noiseBuf = buf;
  },
  pad(t, notes, dur, cutoff) {
    const c = this.ctx, f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; f.Q.value = .4;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.055, t + 1.1); g.gain.setValueAtTime(.055, t + dur - 1); g.gain.linearRampToValueAtTime(0, t + dur + .8);
    f.connect(g); g.connect(this.master); g.connect(this.delay);
    notes.forEach((m, i) => ["triangle", "sawtooth"].forEach((type, k) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = this.hz(m); o.detune.value = (k ? 7 : -5) + i;
      const og = c.createGain(); og.gain.value = k ? .25 : .6; o.connect(og); og.connect(f);
      o.start(t); o.stop(t + dur + 1);
    }));
  },
  pluck(t, m, vol, len = .5) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "sine"; o.frequency.value = this.hz(m); f.type = "lowpass"; f.frequency.value = 500;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + len);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + len + .05);
  },
  brush(t, vol) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + .15);
  },
  heart(t) { this.pluck(t, 28, .5, .25); this.pluck(t + .22, 28, .32, .25); },
  schedule() {
    const corp = this.mode === "corp";
    const c = this.ctx, beat = 60 / (this.mode === "ux" ? 62 : corp ? 86 : 72), barLen = beat * 4;
    const t = c.currentTime + .08, p = this.prog[this.mode], [root, notes] = p[this.bar % 4];
    // 공개 사이트는 "우우웅" 하고 부풀어 오르는 패드 대신, 마디 첫 박과 셋째 박에 피아노 화음을 가볍게 친다
    // 반주: 마디 첫 박과 셋째 박에 부드러운 건반 화음 (악기 후보: bell·piano·harp·musicbox·vibe — 지금은 vibe 멜로디 + bell 반주)
    if (corp) { [0, 2].forEach(b => notes.forEach(m => this.bell(t + beat * b + Math.random() * .02, m, b ? .022 : .03))); }
    else this.pad(t, notes, barLen, this.mode === "ux" ? 650 : 1100);
    const walk = this.mode === "ux" ? [0, 0, 7, 0] : corp ? [0, 7, 12, 7] : [0, 7, 12, 10];
    walk.forEach((iv, i) => this.pluck(t + i * beat, root + 12 + iv, (i ? .22 : .32) * (corp ? .7 : 1), beat * .9));
    for (let i = 0; i < 8; i++) if (i % 2) this.brush(t + i * beat / 2, corp ? .025 : .05); else if (i === 2 || i === 6) this.brush(t + i * beat / 2, corp ? .04 : .08);
    if (corp) { // 코드음에서 고른 맑은 피아노 음을 한 마디에 서너 개, 위로 올라가는 모양으로
      const pick = [...notes].sort(() => Math.random() - .5).slice(0, rand(3, 4)).sort((a, b) => a - b);
      pick.forEach((m, k) => this.vibe(t + beat * (k + (k % 2 ? .5 : 0)), m + 12, .05));
    }
    if (this.mode === "ux") { this.heart(t); this.heart(t + beat * 2); }
    this.bar++;
    this.timer = setTimeout(() => this.schedule(), barLen * 1000);
  },
  start() {
    if (!this.ctx) this.init();
    this.ctx.resume();
    if (this.on) return;
    this.on = true;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(.9, this.ctx.currentTime + 2);
    clearTimeout(this.timer); this.schedule(); this.sync();
  },
  stop() {
    if (!this.ctx || !this.on) return;
    this.on = false; clearTimeout(this.timer);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + .6);
    this.sync();
  },
  toggle() { this.on ? this.stop() : this.start(); },
  setMode(m) { if (this.mode === m) return; this.mode = m; this.bar = 0; if (this.on) { clearTimeout(this.timer); this.schedule(); } },
  sync() { $$("[data-bgm]").forEach(b => { b.classList.toggle("on", this.on); b.textContent = this.on ? "♪ BGM ON" : "♪ BGM OFF"; }); },
};
$$("[data-bgm]").forEach(b => b.onclick = () => BGM.toggle());

/* ===================================================================
   상태 — 브라우저에 저장해서, 다시 들어오면 이어진다
   =================================================================== */
const NOW = () => Date.now();
const DEF = () => ({
  name: "", th: 79, cr: 70, pack: 0, last: NOW(), visits: 0,
  work: "", warned80: false, warned90: false, once: {},
  dis: {}, bought: {}, likes: {}, extraPosts: [], notices: [], chats: {}, dev: {},
});
let ST;
try { ST = Object.assign(DEF(), JSON.parse(store.get("state") || "{}")); } catch { ST = DEF(); }
const save = () => store.set("state", JSON.stringify(ST));
const ME = ST; // 예전 코드 호환 (ME.name, ME.th, ME.cr)
// 언더럭스 구매 효과 — rent: 실제 대여 시간(분), perm: 영구
if (!ST.eff) ST.eff = {}; if (!ST.perm) ST.perm = {}; if (!Array.isArray(ST.intel)) ST.intel = [];
const FX = {
  ear:  { rent: 60, label: "게임 속 1주", name: "소음 차단 이어피스", fx: "갈증도가 더 천천히 오릅니다 (45초 → 70초마다 1)" },
  case: { rent: 30, label: "게임 속 3일", name: "추적 방지 케이스", fx: "진의 무작위 연락이 줄어듭니다" },
  gun:  { rent: 15, label: "게임 속 1일", name: "소음기 권총", fx: "D등급 임무 「폭주 개체 추적 지원」이 열립니다" },
  perf: { rent: 60, label: "30ml · 게임 속 1주 분량", name: "피 냄새 차단 향수", fx: "피 냄새가 덮여, 80% 경고 때 미노스가 달려오지 않습니다" },
  tumb: { perm: true, name: "혈액팩 위장 텀블러", fx: "혈액팩 1개로 갈증도가 더 많이 내려갑니다 (−50~80)" },
  curt: { perm: true, name: "암막 커튼", fx: "자리를 비운 사이 오르는 갈증도가 40% 줄어듭니다" },
  pane: { perm: true, name: "방음 패널", fx: "거처의 소리가 밖으로 새지 않습니다" },
};
const hasFx = id => !!(FX[id] && (FX[id].perm ? ST.perm[id] : ST.eff[id] > Date.now()));
const fxLeft = id => Math.max(0, Math.ceil((ST.eff[id] - Date.now()) / 60000));

const BASE_NOTICES = [
  ["red", "필독", "신입 알터 온보딩 — 기본 급식은 주 1회. 갈증도 80 이상이면 즉시 디스패치에 보고."],
  ["", "공지", "다운타운 북쪽 폭주 개체 신고 접수. 해당 구역 야간 단독 이동 자제."],
  ["gold", "급여", "기본급은 매달 같은 날 입금되며, 거처 유지비는 같은 날 자동 차감됩니다."],
  ["gold", "지원", "신입 정착 지원금 70 CR이 지급되었습니다."],
  ["", "보안", "인간에게 정체가 드러날 위험이 생기면 즉시 디스패치로 연락하십시오."],
];
const NOTICE_POOL = [
  ["", "공지", "스트립 남쪽 카지노 호텔 VIP층, 금주 야간 출입 제한."],
  ["red", "경고", "프리몬트 일대 사냥꾼 흔적 재확인. 단독 이동 금지 구역 확대."],
  ["", "공지", "벨 에포크 지하 창고 점검 — 관계자 외 출입 금지."],
  ["gold", "급여", "이번 달 임무 보상 정산이 완료되었습니다. 내역은 디바이스에서 확인."],
  ["", "물류", "냉장 컨테이너 C-7 노선 시간 변경: 04:30 → 04:10."],
  ["red", "경고", "다운타운 북쪽 폭주 개체, 회수 전까지 해당 구역 접근 금지."],
  ["", "보안", "크로니클 제보망에 하우스 물류 트럭 관련 글 확인. 노출 위험 '주의' 단계."],
  ["", "공지", "디바이스 펌웨어 업데이트 예정. 03:00~03:05 일시 접속 불가."],
];
function addNotice(n) { ST.notices.unshift(n); ST.notices = ST.notices.slice(0, 4); save(); renderNotices(); }
function renderNotices() {
  const all = [...ST.notices.map(n => [...n, true]), ...BASE_NOTICES];
  $("#noticeList").innerHTML = all.slice(0, 6).map(([c, t, x, isNew]) => `<li><em class="tag ${c}">${t}</em>${isNew ? '<b class="new">NEW</b>' : ""}${x}</li>`).join("");
}

/* ===================================================================
   플레이어 디바이스 — 갈증도는 시간이 지나면 오른다
   =================================================================== */
function thStage(v) {
  if (v >= 100) return ["폭주", ""];
  if (v >= 80) return ["심각", ""];
  if (v >= 60) return ["위험", ""];
  if (v >= 30) return ["주의", "warn"];
  return ["안정", "ok"];
}
const TH_LOG = {
  "안정": ["맥박 소리가 멀리 있습니다.", "본능이 조용합니다."],
  "주의": ["사람이 많은 곳에서 피 냄새가 또렷해집니다.", "가끔 시선이 목덜미에 머뭅니다."],
  "위험": ["주변 인간의 맥박이 또렷하게 들립니다.", "충동을 누르는 데 상당한 집중이 필요합니다."],
  "심각": ["판단이 흐려집니다. 사람 많은 곳을 피하십시오.", "피 냄새 외에는 아무것도 들리지 않습니다."],
  "폭주": ["……", "디바이스 응답 없음."],
};
function renderMe() {
  const [s, cls] = thStage(ST.th);
  $("#thNum").textContent = ST.th; $("#miniTH").textContent = ST.th;
  $("#thFill").style.width = Math.min(100, ST.th) + "%";
  const b = $("#thBadge"); b.textContent = s; b.className = "badge " + cls;
  $$(".me .scale span").forEach(sp => sp.classList.toggle("on", sp.textContent === s));
  $("#meName").textContent = ST.name || "미배정";
  $("#miniCR").textContent = ST.cr; $("#uxCR").textContent = ST.cr;
  $(".me .log").innerHTML = TH_LOG[s].map(t => `<div><i>▸</i>${t}</div>`).join("") +
    `<div class="rec"><i>◆</i>${ST.th >= 60 ? "권장 조치 — 혈액 공급 · 안정화" : "상태 양호 — 정기 급식 유지"}</div>`;
  const feed = $("#feed"), pack = $("#usePack");
  feed.disabled = ST.th < 50; feed.textContent = ST.th < 50 ? "급식 대기 (갈증도 50부터)" : "기본 급식분 섭취";
  pack.disabled = !ST.pack; pack.textContent = `혈액팩 사용 · ${ST.pack}개`;
  $("#workState").textContent = ST.work === today() ? "출근 완료 · 벨 에포크" : "미출근";
  const home = ["근무처 근처 방 (F~E) · 승급 전까지 고정"]; if (ST.perm.curt) home.push("암막 커튼 시공됨"); if (ST.perm.pane) home.push("방음 패널 시공됨");
  $("#homeLine").textContent = home.join(" · ");
  const on = Object.keys(FX).filter(hasFx);
  $("#fxList").innerHTML = on.length ? `<div class="fx-h">적용 중인 효과</div>` + on.map(id => `<div class="fx"><b>${FX[id].name}</b><span>${FX[id].fx}</span><em>${FX[id].perm ? "보유" : `남은 ${fxLeft(id)}분`}</em></div>`).join("") : "";
  $("#checkin").disabled = ST.work === today();
}
const today = () => new Date().toDateString();
function setTH(v, quiet) {
  ST.th = Math.max(0, Math.min(99, v));
  if (ST.th >= 80 && !ST.warned80) {
    ST.warned80 = true;
    pushMsg("jin", ["갈증도 80 초과 확인했습니다.", "지금 바로 급식하세요. 보고서는 제가 씁니다."]);
    setTimeout(() => pushMsg("minos", hasFx("perf") ? ["……무슨 냄새를 덮은 거야.", "덮는다고 없어지는 거 아니다. 마셔."] : ["냄새 난다.", "지금 어디야. ……움직이지 마."]), 4000);
  }
  if (ST.th >= 90 && !ST.warned90) { ST.warned90 = true; pushMsg("ruan", ["야.", "대답해."]); }
  if (ST.th < 70) { ST.warned80 = false; ST.warned90 = false; }
  save(); renderMe();
  if (!quiet && ST.th >= 80) $("#miniTH").parentElement.classList.add("pulse");
  else $("#miniTH").parentElement.classList.remove("pulse");
}
function drink(min, max, label) {
  const down = rand(min, max); setTH(ST.th - down);
  toast(`${label} · 갈증도 −${down} → ${ST.th}%`);
}
$("#feed").onclick = () => {
  drink(40, 70, "급식 기록됨");
  pushMsg("jin", ["급식 기록 확인했습니다.", `${ST.th}%. 이 정도면 오늘 밤은 혼자 다녀도 됩니다.`]);
};
$("#usePack").onclick = () => {
  if (!ST.pack) return;
  ST.pack--; hasFx("tumb") ? drink(50, 80, "혈액팩 사용 (텀블러)") : drink(40, 70, "혈액팩 사용");
  if (!ST.once.packReact) { ST.once.packReact = true; save(); setTimeout(() => pushMsg("jenis", ["…출처 없는 팩을 드셨군요.", "다음엔 제 쪽 물량으로 하세요. 성분표가 없는 피는 위험합니다."]), 3500); }
};
$("#checkin").onclick = () => {
  ST.work = today(); save(); renderMe(); toast("출근 기록됨 · 카페 벨 에포크");
  const lines = [["왔네요.", "오늘은 컵만 닦아요. 손님 얼굴은 보지 말고."], ["음… 오늘은 일찍 왔네.", "앞치마 끈, 또 앞으로 묶었다."], ["어서 와요.", "지하 창고 쪽엔 가지 말고요. 오늘은 특히."]];
  setTimeout(() => pushMsg("rainer", lines[rand(0, lines.length - 1)]), 2500);
};
// 세션 중에는 45초마다 1씩
let lastRise = Date.now();
setInterval(() => {
  if (!$("#portal").classList.contains("on") && !$("#ux").classList.contains("on")) { lastRise = Date.now(); return; }
  if (Date.now() - lastRise >= (hasFx("ear") ? 70000 : 45000)) { lastRise = Date.now(); setTH(ST.th + 1); ST.last = NOW(); save(); }
}, 5000);

/* 시계 · 급여일 */
function tick() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString("en-GB", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit" });
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  $("#payday").textContent = "D-" + Math.ceil((next - now) / 864e5);
}

/* ===================================================================
   디바이스 현황 — 상태가 수시로 바뀐다
   =================================================================== */
const CH = {
  ruan:   { ko: "루안", code: "ARC", gr: "S", ac: "#3fd6e8", st: "OFFLINE", sc: "#6b7287", loc: "위치 신호 없음 · 프리랜서", th: 18, memo: "응답 지연 · 평균 6시간. 급할 땐 디스패치 경유." },
  jenis:  { ko: "제니스", code: "CHEMIST", gr: "B", ac: "#7d9bff", st: "출장중", sc: "#e0a14a", loc: "뉴욕 · 제휴 제약사 이사회", th: 22, memo: "혈액 공급 라인 정상. 회신은 업무 시간 외." },
  rainer: { ko: "레이너", code: "MAESTRO", gr: "A", ac: "#d0344f", st: "근무중", loc: "카페 벨 에포크 · 다운타운", th: 11, memo: "신입 위장 근무 담당. 지하 창고 출입 제한." },
  anzi:   { ko: "안지", code: "INFORMER", gr: "A", ac: "#f2c14e", st: "ONLINE", loc: "크로니클 편집국", th: 9, memo: "최선임. 디바이스 응답은 기분 따라." },
  minos:  { ko: "미노스", code: "TRACER", gr: "B", ac: "#d9853b", st: "근무중", loc: "LVMPD 다운타운 지구", th: 41, memo: "갈증 주기 짧음 · 하우스 의무 기록 대상." },
  jin:    { ko: "진", code: "DISPATCHER", gr: "C", ac: "#c8d2e8", st: "방해 금지", sc: "#ff3d52", loc: "하우스 행정동 · 디스패치실", th: 15, memo: "신입 온보딩 담당. 업무 문의는 메시지로." },
  maquia: { ko: "마키아", code: "SPHINX", gr: "A", ac: "#3ddc97", st: "비공개", sc: "#6b7287", loc: "조회 권한 없음 (F)", th: null, memo: "이 개체의 위치·상태는 열람할 수 없습니다." },
};
const DEV_POOL = {
  ruan:   [["OFFLINE", "#6b7287", "위치 신호 없음 · 프리랜서"], ["ONLINE", "#5be38c", "스트립 외곽 · 이동 중"], ["임무중", "#ff3d52", "위치 비공개 · 단독 임무"]],
  jenis:  [["출장중", "#e0a14a", "뉴욕 · 제휴 제약사 이사회"], ["ONLINE", "#5be38c", "라스베이거스 · 위치 비공개"], ["회의중", "#e0a14a", "시카고 · 이사회 분기 회의"]],
  rainer: [["근무중", "#5be38c", "카페 벨 에포크 · 다운타운"], ["휴식", "#e0a14a", "벨 에포크 2층"], ["방해 금지", "#ff3d52", "위치 비공개"]],
  anzi:   [["ONLINE", "#5be38c", "크로니클 편집국"], ["취재중", "#e0a14a", "프리몬트 스트리트"], ["OFFLINE", "#6b7287", "응답 없음"]],
  minos:  [["근무중", "#5be38c", "LVMPD 다운타운 지구"], ["현장 출동", "#ff3d52", "다운타운 북쪽 · 사건 현장"], ["비번", "#e0a14a", "위치 비공개"]],
  jin:    [["방해 금지", "#ff3d52", "하우스 행정동 · 디스패치실"], ["근무중", "#5be38c", "하우스 행정동 · 디스패치실"], ["회의중", "#e0a14a", "하우스 본관 · 상층부"]],
};
Object.entries(ST.dev).forEach(([id, d]) => Object.assign(CH[id], d));
function renderDevices() {
  const cards = Object.entries(CH).map(([id, c]) => `
    <div class="win dev" style="--ac:${c.ac};--sc:${c.sc || "#5be38c"}" data-open="${id}">
      <div class="ph"><img src="../../char/${id}-e01.webp" alt="${c.ko}"><span class="st"><i></i>${c.st}</span><span class="gr">${c.gr}</span></div>
      <div class="bd">
        <div class="nm"><b>${c.ko}</b><span>${c.code}</span></div>
        <div class="loc">📍 ${c.loc}</div>
        <div class="mini">TH°<span class="b"><i style="width:${c.th ?? 0}%"></i></span><em data-th="${id}">${c.th == null ? "??" : c.th + "%"}</em></div>
        <div class="mini aff t-${tier(id)}">호감<span class="b"><i style="width:${aff(id)}%"></i></span><em>${aff(id)}</em></div>
        <div class="aff-t t-${tier(id)}">${TIER_KO[tier(id)]}</div>
        <div class="memo">${c.memo}</div>
      </div>
    </div>`).join("");
  const locked = `
    <div class="win dev locked" data-locked>
      <div class="ph"></div>
      <div class="bd">
        <div class="nm"><b>██████</b><span>ID 0001</span></div>
        <div class="loc">📍 ██████████</div>
        <div class="mini">TH°<span class="b"><i style="width:0"></i></span><em>—</em></div>
        <div class="mini aff">호감<span class="b"><i style="width:0"></i></span><em>—</em></div>
        <div class="memo hd">등급 분류 밖. 이 기록은 조회할 수 없습니다.</div>
      </div>
    </div>`;
  $("#devGrid").innerHTML = cards + locked;
  $$("[data-open]").forEach(el => el.onclick = () => {
    const id = el.dataset.open;
    if (id === "ruan" && CH.ruan.st === "OFFLINE" && !ST.once.ruanPoke) {
      ST.once.ruanPoke = true; save(); toast("호출 신호 전송 · 응답 대기 중");
      setTimeout(() => pushMsg("ruan", ["뭐.", "꺼 놓은 디바이스는 왜 찔러."]), 7000); return;
    }
    openTab("msg"); openChat(id);
  });
  $("[data-locked]").onclick = () => {
    glitch(); toast("ACCESS DENIED · 이 조회 시도는 기록되었습니다.");
    if (!ST.once.lockPeek) { ST.once.lockPeek = true; save(); setTimeout(() => pushMsg("maquia", ["……궁금한가.", "그 칸은 열지 마라. 아직은."]), 6000); }
  };
}
setInterval(() => {
  const ids = Object.keys(CH).filter(k => CH[k].th != null), id = ids[rand(0, ids.length - 1)];
  CH[id].th = Math.max(3, Math.min(58, CH[id].th + rand(-1, 2)));
  const em = document.querySelector(`[data-th="${id}"]`);
  if (em) { em.textContent = CH[id].th + "%"; em.parentElement.querySelector(".b i").style.width = CH[id].th + "%"; }
}, 4000);
function shiftDevice() {
  const ids = Object.keys(DEV_POOL), id = ids[rand(0, ids.length - 1)], opts = DEV_POOL[id].filter(o => o[0] !== CH[id].st);
  const [st, sc, loc] = opts[rand(0, opts.length - 1)];
  Object.assign(CH[id], { st, sc, loc }); ST.dev[id] = { st, sc, loc }; save();
  renderDevices();
}

/* ===================================================================
   디스패치 — 임무가 주기적으로 새로 열린다
   수락 → 진행(시간) → 완료 보고 → 검토 → CR 지급. 열린 임무는 일정 시간이 지나면 사라진다
   =================================================================== */
// F등급이 받을 수 있는 임무 (보상은 기존 범위: 일반 100~500, 물류 50~150)
const MISSION_POOL = [
  { t: "물류 · 냉장 컨테이너 이송 보조", place: "스트립 외곽 · 'C-7'", risk: "l", with: "ruan", pay: [60, 120], dur: 40 },
  { t: "물류 · 혈액팩 분배 지원", place: "하우스 행정동 지하", risk: "l", with: "", pay: [50, 100], dur: 30 },
  { t: "현장 정리 · 노출 흔적 제거", place: "프리몬트 뒷골목", risk: "m", with: "minos", pay: [150, 250], dur: 60 },
  { t: "감시 · 크로니클 제보자 확인", place: "다운타운 · 24시 코인세탁소", risk: "l", with: "anzi", pay: [100, 180], dur: 45 },
  { t: "호위 · VIP 귀가 동행", place: "더 세이렌 · 최상층", risk: "m", with: "ruan", pay: [200, 320], dur: 70 },
  { t: "회수 · 분실 디바이스 수거", place: "스트립 남쪽 모텔", risk: "l", with: "", pay: [100, 140], dur: 35 },
  { t: "정찰 · 사냥꾼 은신처 의심 지점", place: "사막 외곽 창고", risk: "m", with: "", pay: [220, 380], dur: 80 },
  { t: "벨 에포크 · 지하 창고 재고 정리", place: "벨 에포크", risk: "l", with: "rainer", pay: [100, 130], dur: 30 },
  { t: "협조 · 혈액 수치 재측정", place: "제휴 제약사 연구소", risk: "l", with: "jenis", pay: [100, 150], dur: 40 },
  { t: "물류 · 새벽 노선 C-3 동승", place: "C-3 노선 · 사막 국도", risk: "l", with: "", pay: [60, 110], dur: 45 },
  // 소음기 권총을 빌렸을 때만 열리는 임무 (무작위 배정에서 제외)
  { t: "폭주 개체 추적 지원", place: "다운타운 북쪽", risk: "m", with: "minos", pay: [300, 450], dur: 90, special: true },
];
const LOCKED = [
  { t: "폭주 개체 추적 지원", place: "다운타운 북쪽", risk: "m", lock: "D등급 이상" },
  { t: "언더럭스 직거래 현장 경비", place: "██████", risk: "m", lock: "C등급 이상" },
  { t: "████ 회수", place: "██████", risk: "h", lock: "B등급 이상 · 기밀" },
];
// 동행이 붙는 임무를 수락하면 그 사람이 먼저 연락해 온다
const COMPANION = {
  ruan: [["그 건 내가 간다.", "……진이 시켰어. 늦지 마."], ["뒤에 붙어 있어. 앞에 나서지 말고."]],
  minos: [["현장 정리 건, 나랑 간다.", "장갑 챙겨. 맨손으로 만지지 마."]],
  anzi: [["흠. 제보자 확인? 같이 가 줄게.", "표정 관리 연습할 기회야."]],
  rainer: [["창고 정리 맡았다면서요.", "상자 하나는 열지 말고요. 어느 건지는 보면 알아요."]],
  jenis: [["재측정 협조 감사합니다.", "바늘은 이번에도 제가 꽂습니다."]],
};
const MS_LIFE = 20 * 60000;   // 열린 임무는 20분 뒤 마감
const MS_EVERY = [4, 8];      // 새 임무는 4~8분마다
if (!Array.isArray(ST.ms)) ST.ms = [];
function newMission(quiet) {
  const used = ST.ms.filter(m => m.s === "open" || m.s === "go" || m.s === "rep").map(m => m.k);
  const left = MISSION_POOL.map((_, i) => i).filter(i => !used.includes(i) && !MISSION_POOL[i].special);
  if (!left.length) return;
  const k = left[rand(0, left.length - 1)], p = MISSION_POOL[k];
  ST.ms.unshift({ id: NOW() + "" + rand(10, 99), k, pay: Math.round(rand(p.pay[0], p.pay[1]) / 10) * 10, s: "open", exp: NOW() + MS_LIFE });
  ST.msNext = NOW() + rand(MS_EVERY[0], MS_EVERY[1]) * 60000;
  save();
  if (!quiet) { toast(`📋 새 임무 배정 · ${p.t}`); markDispatch(true); }
}
function markDispatch(on) { const b = $('.pt-nav [data-tab="dispatch"]'); if (b) b.classList.toggle("ping", on); }
// 처음 접속했거나 열린 임무가 하나도 없으면 두 개를 깔아 둔다
if (!ST.ms.some(m => m.s === "open")) { newMission(true); newMission(true); }
const fmt = s => s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
function renderDispatch() {
  const rk = { l: "저", m: "중", h: "고" };
  const live = ST.ms.filter(m => m.s !== "gone").slice(0, 7);
  const rows = live.map(m => {
    const p = MISSION_POOL[m.k], left = Math.max(0, Math.ceil(((m.s === "open" ? m.exp : m.at) - NOW()) / 1000));
    let act;
    if (m.s === "open") act = `<span class="res dim">마감까지 ${fmt(left)}</span><button class="btn sm red" data-act="ok" data-id="${m.id}">수락</button><button class="btn sm" data-act="no" data-id="${m.id}">거절</button>`;
    else if (m.s === "no") act = `<span class="res" style="color:var(--red)">거절됨 · 평가 반영</span>`;
    else if (m.s === "go") act = left ? `<span class="res">진행 중 · ${fmt(left)}</span>` : `<button class="btn sm red" data-act="rep" data-id="${m.id}">완료 보고서 제출</button>`;
    else if (m.s === "rep") act = `<span class="res">보고 검토 중 · ${fmt(left)}</span>`;
    else act = `<span class="res" style="color:var(--gold-hi)">지급 완료 · +${m.pay} CR</span>`;
    const w = p.with ? CH[p.with].ko : "단독";
    return `
    <div class="win dis ${m.s === "paid" || m.s === "no" ? "done" : ""}">
      <div>
        <h4>${m.s === "open" ? '<em class="newm">NEW</em>' : ""}📋 ${p.t}</h4>
        <div class="meta"><span>📍 <b>${p.place}</b></span><span>⚠ 위험도 <b class="risk-${p.risk}">${rk[p.risk]}</b></span>
          <span>👥 <b>${w}</b></span><span>⏳ <b>${fmt(p.dur)}</b></span><span>💳 <b>${m.pay} CR</b></span></div>
      </div>
      <div class="acts">${act}</div>
    </div>`;
  }).join("");
  const locks = LOCKED.filter((d, i) => !(i === 0 && hasFx("gun"))).map(d => `
    <div class="win dis lock"><div><h4>📋 ${d.t}</h4>
      <div class="meta"><span>📍 <b>${d.place}</b></span><span>⚠ 위험도 <b class="risk-${d.risk}">${rk[d.risk]}</b></span><span>🔒 <b>${d.lock}</b></span></div></div>
      <div class="acts"><span class="res">열람 불가</span></div></div>`).join("");
  const nextIn = ST.msNext ? Math.max(0, Math.ceil((ST.msNext - NOW()) / 1000)) : 0;
  $("#disList").innerHTML = `<p class="dis-next">다음 임무 배정까지 약 ${fmt(nextIn)} · 보유 ${ST.cr} CR</p>` + rows + locks;
  $$("#disList [data-act]").forEach(b => b.onclick = () => act(b.dataset.act, b.dataset.id));
}
function act(kind, id) {
  const m = ST.ms.find(x => x.id === id); if (!m) return;
  const p = MISSION_POOL[m.k];
  if (kind === "ok") {
    m.s = "go"; m.at = NOW() + p.dur * 1000; toast("수락 기록됨. 진행 시간이 끝나면 보고서를 제출하세요.");
    pushMsg("jin", [`'${p.t}' 수락 확인했습니다.`, p.with ? `동행은 ${CH[p.with].ko}입니다.` : "단독 건입니다. 무리하지 마십시오."]);
    if (p.with && COMPANION[p.with]) { const c = COMPANION[p.with]; setTimeout(() => pushMsg(p.with, c[rand(0, c.length - 1)]), 6000); }
  } else if (kind === "no") {
    m.s = "no"; toast("거절 기록됨. 평가에 반영될 수 있습니다.");
    pushMsg("jin", ["거절 확인했습니다.", "기록에는 남습니다. 이유가 있다면 따로 말씀하세요."]);
  } else if (kind === "rep") {
    m.s = "rep"; m.at = NOW() + 15000; toast("보고서 제출 완료 · 검토 대기");
    const quip = ["오탈자가 세 개 있네요.", "사진이 흔들렸습니다. 다음엔 고정하세요.", "시간 기록이 정확합니다. 좋습니다."];
    pushMsg("jin", ["보고서 접수했습니다.", "확인되면 보상 들어갑니다. " + quip[rand(0, quip.length - 1)]]);
  }
  save(); renderDispatch();
}
setInterval(() => {
  let changed = false;
  ST.ms.forEach(m => {
    if (m.s === "rep" && NOW() >= m.at) {
      m.s = "paid"; ST.cr += m.pay; changed = true; renderMe(); if (MISSION_POOL[m.k].with) addAff(MISSION_POOL[m.k].with, 5);
      toast(`💳 임무 보상 지급 · +${m.pay} CR`); pushMsg("jin", ["확인 완료.", `${m.pay} CR 지급했습니다.`]);
    }
    if (m.s === "open" && NOW() >= m.exp) { m.s = "gone"; changed = true; }
  });
  // 오래된 기록은 정리 (끝난 것 최대 4개만 남김)
  const done = ST.ms.filter(m => m.s === "paid" || m.s === "no" || m.s === "gone");
  if (done.length > 4) { ST.ms = ST.ms.filter(m => !done.slice(4).includes(m)); changed = true; }
  if (ST.msNext && NOW() >= ST.msNext && ($("#portal").classList.contains("on") || $("#ux").classList.contains("on"))) { newMission(); changed = true; }
  if (changed) save();
  if ($("#tab-dispatch").classList.contains("on")) renderDispatch();
}, 1000);

const TALK = {
  jin: {
    preview: "하우스 네트워크 접속 확인했습니다.",
    start: { say: ["하우스 네트워크 접속 확인했습니다.", "신입 온보딩 담당, 총괄 서기장 진 베버입니다. 디바이스 공지는 앞으로 제 쪽에서 나갑니다.", "현재 갈증도 79%. 위험 구간입니다. 오늘 안에 급식 받으세요."],
      ch: [["급식은 어디서 받아요?", "where"], ["안 마시면요?", "refuse"]] },
    where: { say: ["거처 냉장 보관함에 기본 급식분이 들어가 있습니다. 주 1회분.", "추가분은 크레딧으로 삽니다. 지금 잔액으로는 불가능하고요."], ch: [["월급은 언제 나와요?", "pay"]] },
    pay: { say: ["매달 같은 날. F등급 기본급 300, 같은 날 유지비 80 차감.", "……첫 달은 일할 계산입니다. 기대는 안 하시는 게 좋습니다."], ch: [["알겠어요.", "shift"]] },
    refuse: { say: ["마시고 말고는 본인 자유입니다.", "다만 80을 넘기면 제가 직접 회수하러 갑니다. 그건 자유가 아닙니다."], ch: [["……알겠어요.", "shift"]] },
    shift: { say: ["확인했습니다.", "아. 내일 열 시까지 벨 에포크 출근입니다. 위장 근무도 근무예요."] },
  },
  ruan: {
    preview: "야.",
    start: { say: ["야.", "디바이스 켰으면 대답부터 하지."], ch: [["누구세요?", "who"], ["왜 반말이에요?", "banmal"]] },
    who: { say: ["루안. 하우스 일, 내 맘대로 하는 사람.", "갈증 79라며. 진 그 자식이 단체 공지로 뿌렸어."], ch: [["그래서요?", "so"]] },
    banmal: { say: ["존댓말 듣고 싶으면 진한테 가.", "걘 그거 하나는 잘해."], ch: [["……그래서 용건이 뭔데요?", "so"]] },
    so: { say: ["그래서는 무슨. 오늘 밤엔 돌아다니지 말라고.", "뽈뽈거리다 사고 치면 치우는 건 나니까."], ch: [["걱정해 주는 거예요?", "care"], ["내가 알아서 할게요.", "self"]] },
    care: { say: ["……칫. 귀찮은 거야.", "팩 다 마시면 말해. 확인하게."] },
    self: { say: ["하.", "그 말 한 놈들 치운 게 몇인지 알아?", "……알아서 해 봐. 대신 내 눈앞에서."] },
  },
  jenis: {
    preview: "음, 실례지만 채혈을 한 번 더…",
    start: { say: ["안녕하세요. 제니스 밀러입니다. 하우스 혈액 공급 쪽을 맡고 있어요.", "음, 실례지만 채혈을 한 번 더 부탁드려도 될까요? 지난번 수치가 좀… 설명이 안 돼서요."],
      ch: [["뭐가 이상한데요?", "why"], ["싫어요.", "no"]] },
    why: { say: ["그걸 알려고 다시 뽑는 겁니다.", "후. 걱정하실 단계는 아니에요. 아직은요."], ch: [["……알겠어요.", "yes"], ["그래도 싫어요.", "no"]] },
    no: { say: ["그럼 기다리죠.", "어차피 갈증이 오르면, 급식은 제 쪽 물량이니까요. 그때 다시 여쭐게요."] },
    yes: { say: ["감사합니다. 금방 끝나요.", "이번 주 안에 시간 비워 두세요. 제가 뉴욕에서 돌아오면 바로 연락드릴게요."] },
  },
  rainer: {
    preview: "음… 내일부터 우리 가게 식구라면서요.",
    start: { say: ["음… 내일부터 우리 가게 식구라면서요.", "벨 에포크 오픈은 열 시예요. 앞치마는 걸려 있는 거 아무거나."],
      ch: [["커피 내릴 줄 모르는데요.", "coffee"], ["피 냄새 나는 손님 오면요?", "blood"]] },
    coffee: { say: ["괜찮아요. 처음엔 다 그래.", "대신 손님 목덜미는 쳐다보지 말고. 그건 내가 가르쳐 줄 수가 없거든요."], ch: [["……노력할게요.", "try"]] },
    try: { say: ["착하기도 해라.", "그래도 선 넘으면, 그땐 나도 안 웃어요."] },
    blood: { say: ["그럴 땐 웃어요. 그리고 뒤로 들어와요.", "아, 지하 창고는 열지 말고. 거긴 내 거라서."] },
  },
  anzi: {
    preview: "흠. 신입 디바이스가 드디어 켜졌네.",
    start: { say: ["흠. 신입 디바이스가 드디어 켜졌네.", "크로니클 안지. 이름은 안 외워도 돼. 어차피 또 보게 될 테니까."],
      ch: [["뭐 하는 분이에요?", "what"], ["하우스 사람이에요?", "house"]] },
    what: { say: ["이 도시에서 일어나는 일 구경하는 사람.", "너 같은 거 구경하는 것도 좋아하고."], ch: [["……구경이요?", "hint"]] },
    house: { say: ["반쯤.", "하우스가 다 보여 주진 않거든. 나머진 밑에 있어."], ch: [["밑이요?", "hint"]] },
    hint: { say: ["표정 좋네. 화났어?", "하나만 알려 줄게. 하우스 화면 맨 아래 버전 번호 있지. 심심하면 세 번 눌러 봐.", "진한테는 비밀."] },
  },
  minos: {
    preview: "79라고? 쯧.",
    start: { say: ["형사 미노스. 번호는 진한테 받았다.", "79라고? 쯧."], ch: [["괜찮아요.", "fine"], ["같이 있어 주면 안 돼요?", "stay"]] },
    fine: { say: ["괜찮은 놈은 79 안 찍혀.", "사람 많은 데 가지 마. 스트립 쪽은 특히."], ch: [["왜요?", "why"]] },
    why: { say: ["거긴 인간이 너무 많다고.", "지금 상태면 옆 사람 맥박 세다가 밤 다 간다.", "……이상한 거 보면 나한테 먼저 연락해. 진 말고."] },
    stay: { say: ["안 돼.", "……지금은. 네 냄새, 아직 너무 짙어."] },
  },
  maquia: {
    preview: "……봤다.",
    start: { say: ["……봤다."], ch: [["뭘요?", "what"], ["누구세요?", "who"]] },
    what: { say: ["네 기록.", "빈칸이 많군."], ch: [["그게 무슨 뜻이에요?", "mean"]] },
    mean: { say: ["흠.", "숨기는 건지, 모르는 건지. 곧 알게 되겠지."] },
    who: { say: ["마키아.", "기억해 둬. 필요해지면, 내가 먼저 찾는다."] },
  },
};
// 언더럭스 매물 풀 — 혈액팩은 늘 있고, 나머지는 주기적으로 바뀐다 (가격은 기존 범위 안)
const MK_POOL = [
  { id: "pack", cat: "혈액팩", t: "O형 정제팩 2개 · 출처 확실", who: "@nightjar", pr: 70, repeat: true },
  { id: "feral", cat: "정보 · 중요", t: "다운타운 북쪽 폭주 개체 마지막 목격 위치", who: "@static", pr: 120, info: "마지막 목격: 다운타운 북쪽 철교 아래, 03:40. 찢긴 형광 조끼. 네 발로 움직임. 회수팀 미도착." },
  { id: "hunter", cat: "정보 · 간단", t: "스트립 남쪽 사냥꾼 목격담", who: "@watcher", pr: 50, info: "검은 캡, 파란 엠블럼 셋. 모텔 주차장에서 손전등으로 번호판을 비추고 있었음. 이틀 연속." },
  { id: "chron", cat: "정보 · 중요", t: "크로니클 다음 호 1면 미리보기", who: "@static", pr: 160, info: "1면 제목 초안: '새벽 4시 반, 코르부스 트럭은 무엇을 싣나'. 편집장 메모: '아직 아님.'" },
  { id: "bellb", cat: "정보 · 간단", t: "벨 에포크 지하 창고 출입 기록 한 줄", who: "@bellhop", pr: 60, info: "지난 화요일 04:12 — 출입자 R. 단독. 체류 47분. 그 외 기록 없음." },
  { id: "ear", cat: "장비 대여", t: "소음 차단 이어피스 · 1주 (맥박 소리 줄여 줌)", who: "@gearhead", pr: 150 },
  { id: "case", cat: "장비 대여", t: "추적 방지 디바이스 케이스 · 3일", who: "@gearhead", pr: 120 },
  { id: "gun", cat: "장비 대여", t: "소음기 권총 · 1일 대여", who: "@████", pr: 230 },
  { id: "tumb", cat: "아이템 커스텀", t: "혈액팩 위장 텀블러 · 체온 유지형", who: "@ironmoth", pr: 160 },
  { id: "perf", cat: "아이템 커스텀", t: "피 냄새 차단 향수 · 30ml", who: "@ironmoth", pr: 190 },
  { id: "curt", cat: "은신처 커스텀", t: "완전 암막 커튼 시공 · F등급 방 규격", who: "@drape", pr: 220 },
  { id: "pane", cat: "은신처 커스텀", t: "방음 패널 시공 · 이웃이 못 듣게", who: "@drape", pr: 340 },
  { id: "rumor", cat: "기밀", t: "이번 주 들어온 신입의 '피 향'에 대한 소문", who: "@████", pr: 480, info: "'신입 피 향, 하우스 상층부가 따로 보고받는대.' — 출처 불명. 믿거나 말거나." },
  { id: "memo", cat: "기밀", t: "하우스 상층부 회의록 한 장", who: "@████", pr: 420, info: "대부분 검게 칠해져 있다. 읽을 수 있는 건 한 줄뿐: '신입 개체 관찰 유지.'" },
];
const MK_EVERY = 8 * 60000; // 8분마다 매물 교체
function rotateMarket(quiet) {
  const others = MK_POOL.filter(m => m.id !== "pack").sort(() => Math.random() - .5);
  const secret = others.filter(m => m.cat === "기밀"), normal = others.filter(m => m.cat !== "기밀");
  const pick = normal.slice(0, 4).map(m => m.id);
  pick.push(Math.random() < .55 ? secret[0].id : normal[4].id); // 마지막 한 칸이 한정 매물
  ST.mk = { ids: ["pack", ...pick], at: NOW() + MK_EVERY, lim: pick[pick.length - 1], got: [] };
  save();
  if (!quiet) { toast("UNDERLUX · 매물이 교체되었습니다."); if ($("#ux").classList.contains("on")) renderUX(); }
}
if (!ST.mk || !ST.mk.ids) rotateMarket(true);
const MK = () => ST.mk.ids.map(id => MK_POOL.find(m => m.id === id)).filter(Boolean);
const BOARD = [
  { who: "@bellhop", h: "♥ 24", t: "[잡담] 신입 들어왔다며", p: "피 향 장난 아니라던데. 디스패치실 앞 지나가다 다들 고개 돌렸대.",
    cm: [["@static", "공지에 갈증도 79 찍혔던데 ㅋㅋ 첫날부터 위험 구간"], ["@nightjar", "서기장 한숨 소리 여기까지 들림"], ["@bellhop", "벨 에포크 배정이래. 사장님 또 웃고 계시겠네"]] },
  { who: "@watcher", h: "♥ 41", t: "[경고] 프리몬트 쪽 사냥꾼 흔적", p: "뒷골목 배관 밑에서 은 코팅 탄피 수거. 인간 쪽 장비 같음. 당분간 혼자 다니지 마.",
    cm: [["@gearhead", "은탄 쓰는 놈들이면 아마추어 아님"], ["@static", "현상금 목록 갱신됐다는 말도 있던데"]] },
  { who: "@drape", h: "♥ 9", t: "[후기] 거처 암막 시공 끝", p: "F등급 방도 커튼 하나로 사람 사는 데 같아짐. 낮잠이 됨. 강추.",
    cm: [["@ironmoth", "그 방들 원래 창문 방향 엉망이잖아"]] },
  { who: "@static", h: "♥ 17", t: "[질문] 폭주 개체 한 달 넘기면 진짜 끝임?", p: "신입 때문에 다들 이 얘기 하길래.",
    cm: [["@watcher", "한 달 방치되면 오염체. 그 뒤론 말 안 통함. 하우스가 치움"], ["@nightjar", "그 전에 데려오면 돌아와. 대신 기억이 좀 비어"], ["@bellhop", "……이런 건 신입 앞에선 하지 말자"]] },
  { who: "@nightjar", h: "♥ 33", t: "[잡담] 루안 디바이스 또 꺼져 있음", p: "디스패치가 세 번 호출했는데 무응답. 이 사람은 왜 S등급이냐.",
    cm: [["@gearhead", "S니까 끄는 거지"], ["@static", "서기장 펜 부러지는 소리 남"]] },
];
const NOISE = [
  { who: "📰 제보", h: "♥ 112", t: "프리몬트 뒷골목 총성 4발", p: "신고 받고 갔더니 현장이 깨끗했다고. 탄피도 핏자국도 없음. 형사 한 명만 남아 있었다는 목격담.",
    cm: [["익명", "LVMPD는 오발 사고로 처리 중"], ["익명", "그 형사 맨날 야간 혼자 다니는 사람 아님?"]], risk: ["주의", "risk-m", "목격자 1명 · 경찰 기록 존재"] },
  { who: "📰 제보", h: "♥ 58", t: "다운타운 카페에 새 알바생", p: "벨 에포크 사장님 카페. 얼굴 창백하고 손님 목만 본다는 후기 있음 ㅋㅋ",
    cm: [["익명", "거기 사장님이 더 무서움 웃는데 눈이 안 웃어"]], risk: ["낮음", "risk-l", "농담 수준 · 확산 없음"] },
  { who: "📰 제보", h: "♥ 204", t: "스트립 외곽 냉장 트럭이 매일 새벽 같은 시간에", p: "코르부스 로고 붙은 트럭. 새벽 4시 반에 들어갔다 해 뜨기 전에 나감. 뭐 싣는 걸까.",
    cm: [["익명", "그냥 호텔 식자재겠지"], ["익명", "식자재를 왜 해 뜨기 전에만 옮겨"]], risk: ["위험", "risk-h", "반복 관찰 · 사진 첨부 시도 있음"] },
];

// 시간이 지나며 먼저 연락해 오는 한두 줄짜리 메시지
const AMB = {
  jin: [["하우스 공지 확인 부탁드립니다. 읽음 표시가 안 뜹니다."], ["오늘 근무 기록이 비어 있네요.", "출근 체크는 대시보드에서 합니다."], ["갈증도 추이 보고 있습니다.", "올라가는 속도가 평균보다 빠릅니다."],
    ["디스패치 새 건 올라갔습니다. 확인하세요."], ["거처 유지비 자동 차감 안내입니다. 매달 같은 날입니다."], ["……퇴근 후엔 디바이스 꺼도 됩니다.", "업무 연락은 아침에 하겠습니다."]],
  ruan: [["살아 있냐."], ["밤에 혼자 스트립 쪽 가지 마.", "……그냥 하는 말이야."], ["진이 너 찾더라. 난 모른다고 했다."],
    ["밥은. 사람 밥."], ["오늘 C-7 쪽 조용하더라. 너무 조용해."], ["……아니야. 잘못 보냈어."]],
  jenis: [["채혈 일정, 다음 주 화요일로 잡아 두겠습니다."], ["후. 이사회가 길어지네요.", "돌아가면 수치부터 다시 보죠."], ["음, 요즘 잠은 주무십니까?", "알터도 쉬어야 수치가 안정됩니다."],
    ["뉴욕은 비가 와요. 라스베이거스는 맑겠죠."], ["지난번 수치, 다시 봐도 이상합니다.", "나쁜 쪽은 아니에요. 아직은."], ["루안이 연락 안 받으면 저한테 하세요."]],
  rainer: [["오늘 손님 하나가 당신 이름을 물어보더라고요.", "…알려 주진 않았어요."], ["음… 앞치마 끈은 등 뒤로 묶는 거예요."], ["지하 창고 문, 오늘 열려 있었던가요?", "아니, 그냥 궁금해서."],
    ["새 원두 들어왔어요. 맛은 못 보겠지만, 향은 맡아 봐요."], ["오늘 피아노 조율했어요. 다음에 한 곡 쳐 줄게요."], ["음… 문 닫을 때 불 끄는 거 잊지 말고."]],
  anzi: [["흠. 오늘 크로니클 제보 하나 재밌던데.", "너 얘기는 아니야. 아직은."], ["버전 번호, 몇 번 눌러 봤어?"], ["표정 관리 연습 좀 해. 다 보여."],
    ["오늘 1면 뭐로 할지 고민 중이야. 추천 있어?"], ["흠. 네 근무 시간에 카페 앞 지나갔는데.", "앞치마 잘 어울리더라."], ["심심해. 뭐라도 사고 쳐 봐."]],
  minos: [["프리몬트 쪽 오늘 시끄럽다. 오지 마."], ["쯧. 또 수치 올랐더라."], ["……밥은 먹었냐. 사람 음식."],
    ["야간 순찰 중이다. 별일 없지."], ["오늘 현장에서 은 탄피 나왔다. 조심해."], ["……잘 자라고. 그게 다야."]],
  maquia: [["……."], ["네 이름을 묻는 자가 있었다."], ["흠. 아직이군."], ["오늘은 아무 일도 없었다. 그게 이상하다."], ["……보고 있다."]],
};
// 같은 말을 되풀이하지 않게: 보낸 말은 기억해 두고, 다 쓰면 6시간 뒤에야 다시 꺼낸다
// 먼저 오는 메시지는 전체 4분에 한 번, 같은 사람은 15분에 한 번까지만
const AMB_GAP = 4 * 60000, AMB_GAP_EACH = 15 * 60000, AMB_RESET = 6 * 3600000;
const ORDER = ["jin", "ruan", "anzi", "rainer", "jenis", "minos", "maquia"];
const CHAT = ST.chats;
ORDER.forEach(id => CHAT[id] = Object.assign({ log: [], node: "start", done: false, unread: true, started: false }, CHAT[id] || {}));
let cur = null, busy = false;

function renderList() {
  $("#msgList").innerHTML = ORDER.map(id => {
    const c = CH[id], s = CHAT[id], last = s.log.length ? s.log[s.log.length - 1][1] : TALK[id].preview;
    return `<li class="${cur === id ? "on" : ""} ${s.unread ? "new" : ""}" data-chat="${id}" style="--ac:${c.ac}">
      <img src="../../char/${id}-e01.webp" alt=""><div><b>${c.ko}</b><small>${last}</small></div></li>`;
  }).join("");
  $$("[data-chat]").forEach(li => li.onclick = () => openChat(li.dataset.chat));
  const n = ORDER.filter(id => CHAT[id].unread).length;
  $("#unread").textContent = n || "";
}
function bubble(who, text) {
  const p = document.createElement("p");
  p.className = "bub " + who; p.textContent = text;
  $("#chatLog").appendChild(p); $("#chatLog").scrollTop = 1e6;
}
function openChat(id) {
  cur = id; const s = CHAT[id], c = CH[id];
  s.unread = false; save();
  $("#chatWho").innerHTML = `<b>${c.ko}</b> · ${c.code}`;
  $("#chatState").innerHTML = `<span class="live"><i></i>${c.st}</span>${relLabel(id)}`;
  $("#chatLog").innerHTML = "";
  s.log.forEach(([w, t]) => bubble(w, t));
  renderList();
  if (!s.started) { s.started = true; play(id, "start"); } else drawChoices(id);
  syncChatInput();
}
async function say(id, lines) {
  busy = true; $("#chatChoices").innerHTML = ""; syncChatInput();
  for (const line of lines) {
    if (cur !== id || !$("#tab-msg").classList.contains("on")) { CHAT[id].log.push(["them", line]); CHAT[id].unread = cur !== id; continue; }
    const ty = document.createElement("p"); ty.className = "typing"; ty.textContent = CH[id].ko + " 입력 중";
    $("#chatLog").appendChild(ty); $("#chatLog").scrollTop = 1e6;
    await new Promise(r => setTimeout(r, 500 + Math.min(1600, line.length * 38)));
    ty.remove();
    CHAT[id].log.push(["them", line]);
    if (cur === id) bubble("them", line); else CHAT[id].unread = true; // 그사이 다른 대화로 옮겼으면 그쪽 창에 찍지 않는다
  }
  busy = false; save(); renderList(); syncChatInput();
}
async function play(id, node) {
  const n = TALK[id][node]; CHAT[id].node = node;
  await say(id, n.say);
  if (!n.ch) CHAT[id].done = true;
  save();
  if (cur === id) drawChoices(id);
}
function drawChoices(id) {
  const s = CHAT[id], n = TALK[id][s.node], box = $("#chatChoices");
  if (busy) return;
  if (s.done || !n.ch) { box.innerHTML = `<span class="end">— 상대가 디바이스를 내려놓았습니다 —</span>`; return; }
  box.innerHTML = n.ch.map(([t], i) => `<button data-c="${i}">${t}</button>`).join("");
  $$("#chatChoices [data-c]").forEach(b => b.onclick = () => {
    const [t, next] = n.ch[+b.dataset.c], before = tier(id);
    s.log.push(["me", t]); bubble("me", t); save();
    play(id, next).then(() => { if (cur === id) $("#chatState").innerHTML = `<span class="live"><i></i>${CH[id].st}</span>${relLabel(id)}`; checkTierUp(id, before); renderDevices(); });
  });
}
// 다른 화면에서 일어난 일, 또는 시간이 지나 먼저 오는 메시지
function pushMsg(id, lines, silent) {
  const s = CHAT[id];
  if (cur === id && $("#tab-msg").classList.contains("on") && !busy) { say(id, lines).then(() => drawChoices(id)); return; }
  lines.forEach(l => s.log.push(["them", l]));
  s.unread = true; save(); renderList();
  if (!silent) toast(`✉ ${CH[id].ko}: ${lines[0]}`);
}
function ambient(silent, force) {
  if (!ST.amb) ST.amb = { seen: {}, last: 0, each: {}, reset: NOW() + AMB_RESET };
  const A = ST.amb;
  if (NOW() >= A.reset) { A.seen = {}; A.reset = NOW() + AMB_RESET; }
  if (!force && NOW() - A.last < AMB_GAP) return false;
  const ids = (hasFx("case") ? ORDER.filter(x => x !== "jin") : ORDER).filter(id =>
    (force || NOW() - (A.each[id] || 0) >= AMB_GAP_EACH) && ambPool(id).some((_, i) => !(A.seen[id] || []).includes(i)));
  if (!ids.length) return false;
  const id = ids[rand(0, ids.length - 1)], fresh = ambPool(id).map((_, i) => i).filter(i => !(A.seen[id] || []).includes(i));
  const i = fresh[rand(0, fresh.length - 1)];
  (A.seen[id] = A.seen[id] || []).push(i); A.last = NOW(); A.each[id] = NOW(); save();
  pushMsg(id, ambPool(id)[i], silent);
  return true;
}

/* ===================================================================
   직접 메시지 보내기 — 서버·AI 없이, 보낸 글의 단어를 알아보고 캐릭터 말투로 답한다
   =================================================================== */
const INTENTS = [
  ["secret", /앨런|크레인|변이|누가.*(나를|날)|기억|계약자|시조/],
  ["ux", /언더럭스|underlux|암시장|매물/i],
  ["help", /도와|살려|무서|위험|큰일|쫓|사냥꾼|구해/],
  ["thirst", /갈증|배고|목말|피\s?(마시|먹|줘|좀)|혈액|급식|굶/],
  ["like", /좋아|사랑|보고\s?싶|설레|귀여|멋있|잘생/],
  ["thanks", /고마|감사|땡큐|ㄱㅅ/],
  ["sorry", /미안|죄송|잘못/],
  ["mission", /임무|디스패치|출근|일\s?(해|하|시켜)|보고서/],
  ["who", /누구|뭐\s?하는|정체|이름/],
  ["bye", /잘\s?자|굿밤|바이|나중에|끊|들어가/],
  ["greet", /안녕|하이|ㅎㅇ|여보세요|뭐\s?해|^야\b|hello|hi\b/i],
];
const REPLY = {
  jin: { greet: ["네. 무슨 일이십니까."], thirst: [th => `현재 ${th}%. 거처 보관함부터 확인하세요.`], like: ["……업무 채널입니다. 사적인 말은 삼가 주세요.", "기록에 남습니다. 알고 하시는 말입니까."],
    help: ["위치 보내세요. 지금.", "디스패치 연결합니다. 그 자리에서 움직이지 마십시오."], thanks: ["업무입니다."], sorry: ["사과보다 재발 방지가 낫습니다."], mission: ["다음 배정은 디스패치 탭에서 확인하세요."],
    who: ["총괄 서기장입니다. 이미 말씀드렸을 텐데요."], secret: ["그 질문은 제 권한 밖입니다.", "……그 이름은 이 채널에서 꺼내지 마십시오."], ux: ["무슨 말씀인지 모르겠습니다.", "……모르는 척해 드리는 겁니다. 이번만."],
    bye: ["확인했습니다. 쉬십시오."], fallback: ["확인했습니다.", "용건만 말씀해 주세요.", "……네."] },
  ruan: { greet: ["어."], thirst: [th => `${th}? 하. 지금 당장 마셔.`], like: ["……뭐래.", "그런 말은 얼굴 보고 해."], help: ["어디야. 거기 있어.", "움직이지 마. 3분."], thanks: ["됐어."], sorry: ["뭘 또 했는데."],
    mission: ["임무? 귀찮게."], who: ["루안. 몇 번을 말해."], secret: ["……그 얘긴 하지 마."], ux: ["거기 들락거리지 마. 안지 놀이터야."], bye: ["어. 문 잠그고 자."], fallback: ["그래서?", "하.", "……알았어."] },
  jenis: { greet: ["안녕하세요. 말씀하세요."], thirst: [th => `${th}%라니. 후, 수치 관리 좀 하시죠.`], like: ["……그건 데이터로 남겨도 됩니까?", "음. 예상 밖의 변수네요."], help: ["어디세요? 해독제부터 챙겨 가겠습니다."],
    thanks: ["별말씀을요."], sorry: ["사과는 결과로 보여 주세요."], mission: ["임무 중에 다치면 바로 연락 주세요. 처치는 제가 합니다."], who: ["제니스 밀러입니다. 혈액 공급 담당이고요."],
    secret: ["그건 루안에게 물어보시죠. 대답은 안 하겠지만."], ux: ["언더럭스 팩은 성분표가 없습니다. 권하지 않아요."], bye: ["좋은 밤 되세요."], fallback: ["음, 그렇군요.", "메모해 두겠습니다.", "후. 계속 말씀하세요."] },
  rainer: { greet: ["음… 왔어요?"], thirst: [th => `${th}%… 얼굴에 다 보여요. 가게 오기 전에 마시고 와요.`], like: ["착하기도 해라.", "그런 말은 아껴 둬요. 나중에 써먹게."], help: ["벨 에포크로 와요. 뒷문 열어 둘게요."],
    thanks: ["음, 고마운 건 나중에 갚아요."], sorry: ["괜찮아요. 다음엔 안 그러면 되지."], mission: ["임무 끝나면 커피 한 잔 내려 줄게요."], who: ["레이너. 당신 사장님."],
    secret: ["음… 그건 지하 창고만큼 열면 안 되는 얘기예요."], ux: ["거기서 산 건 가게로 들고 오지 마요."], bye: ["잘 자요. 꿈에 손님 목덜미 나오지 말고."], fallback: ["음…", "그래요?", "재밌네."] },
  anzi: { greet: ["흠. 심심했어?"], thirst: [th => `${th}? 그 표정 기사감인데.`], like: ["어라, 진심이야? 그거 녹음해도 돼?", "흠. 그 말, 장난으로 넘겨 줄게. 이번만."], help: ["어디야. ……농담 아니고, 어디야."],
    thanks: ["고맙다는 말은 좋아해. 계속해."], sorry: ["사과할 일이 있었어? 흥미롭네."], mission: ["임무 얘기는 서기장한테. 난 구경만 해."], who: ["안지. 크로니클. 이 도시 구경꾼."],
    secret: ["그건 아직 기사로 못 써. 나도 모르는 게 있거든."], ux: ["잘 찾아갔네."], bye: ["흠. 잘 자. 내일 더 재밌는 거 보여 줘."], fallback: ["흠.", "그래서 그다음은?", "계속해 봐. 듣고 있어."] },
  minos: { greet: ["어. 무슨 일."], thirst: [th => `${th}… 쯧. 사람 많은 데 가지 말라고.`], like: ["……그런 말 함부로 하지 마.", "지금 네 냄새 때문에 하는 말이면, 착각이다."], help: ["위치. 지금 출발한다."],
    thanks: ["됐다."], sorry: ["사과할 거면 다음에 안 하면 돼."], mission: ["현장 나가면 나한테 먼저 보고해."], who: ["형사 미노스. 잊었냐."],
    secret: ["……그건 수사 중이라고."], ux: ["형사가 알면 안 되는 데다. 난 못 들은 걸로 한다."], bye: ["문 잠그고 자라."], fallback: ["……그래.", "쯧.", "알았다고."] },
  maquia: { greet: ["……."], thirst: [th => `${th}. 흠.`], like: ["……이유를 말해 봐.", "증명해."], help: ["어디."], thanks: ["……."], sorry: ["사과는 필요 없다."],
    mission: ["네가 쓸모 있는지 보는 중이다."], who: ["마키아."], secret: ["……그건 네가 먼저 알아내라."], ux: ["……봤다."], bye: ["……."], fallback: ["…….", "흠.", "계속해."] },
};
/* -------------------------------------------------------------------
   더 자연스럽게: 상황 · 기억 · 호감도 · 받아치기 · 말투 · 반복 · 길이와 속도
   ------------------------------------------------------------------- */
if (!ST.rel) ST.rel = {};
const REL = id => (ST.rel[id] = ST.rel[id] || { lastIntent: "", lastText: "", reps: {}, mad: 0 });
// 호감도 = 대화창에서 내가 보낸 메시지 수 (1통에 +3, 시작 5). 욕하면 깎인 만큼 따로 기억한다
// ㅇㅇ·ㄱㄴ·ㅋㅋ·네 같은 짧은 말은 세지 않는다
const counts = t => { const n = String(t).replace(/[\s.!?~,…]/g, ""); return n.length > 1 && !/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(n) && !SHORT_RE.test(n); };
const meCount = id => ((CHAT[id] && CHAT[id].log) || []).filter(m => m[0] === "me" && counts(m[1])).length;
const aff = id => Math.max(0, Math.min(100, 5 + meCount(id) * 3 - (REL(id).pen || 0)));
const tier = id => { const a = aff(id); return a >= 85 ? "bond" : a >= 60 ? "close" : a >= 30 ? "warm" : "cold"; };
const TIER_KO = { cold: "경계", warm: "익숙함", close: "가까움", bond: "각별함" };
const TIER_N = { cold: 0, warm: 1, close: 2, bond: 3 };
function addAff(id, n) { if (n < 0) { const r = REL(id); r.pen = (r.pen || 0) - n; save(); } }
// 단계가 처음 오를 때 한 번 오는 메시지
const MILESTONE = {
  jin: { warm: ["……최근 문의 빈도가 높습니다.", "불만은 아닙니다. 기록상 그렇다는 겁니다."], close: ["업무 외 채널 하나 열어 뒀습니다.", "……여긴 기록 안 남아. 편하게 해."], bond: ["차 내려 둘게. 레지던스로 와.", "……이상입니다."] },
  ruan: { warm: ["너 말 많다.", "……싫다는 건 아니고."], close: ["네 번호, 맨 위에 올려놨다.", "말하지 마. 아무한테도."], bond: ["어디 가면 말하고 가.", "……없으면 찾게 되잖아. 그게 다야."] },
  jenis: { warm: ["대화 로그가 쌓이네요.", "음, 지우진 않겠습니다."], close: ["오늘 회의 중에 당신 메시지부터 확인했어요.", "……비밀입니다."], bond: ["손편지 써 본 적 있으세요?", "……아니에요. 그냥 물어본 거예요."] },
  rainer: { warm: ["음… 이제 당신 발소리 구분돼요."], close: ["가게 구석 자리, 당신 자리로 비워 둘게요."], bond: ["뉴올리언스에 작은 집이 있어요.", "……언젠가 보여 줄게요. 아무한테나 안 보여 주는 데예요."] },
  anzi: { warm: ["흠. 너 기사감보다 재밌어."], close: ["커피 하나 더 시켜 놨어. 와서 마셔.", "……식기 전에."], bond: ["오늘은 아무것도 안 캐물을게.", "그냥 얘기해. 듣고 있을게."] },
  minos: { warm: ["……너 연락 오면 진동 바꿔 놨다.", "헷갈려서. 그게 다야."], close: ["오늘 현장 끝나고 들를게. 필요한 거 있냐."], bond: ["등 맡길 사람 있냐고 누가 물으면.", "……너 이름 댈 거다."] },
  maquia: { warm: ["……예측이 또 빗나갔다.", "네 쪽 문제다."], close: ["질문 하나만 하지.", "……아니. 다음에."], bond: ["목에 흉터가 있다.", "……봤다면, 그걸로 됐다."] },
};
// 단계가 오르면 먼저 오는 메시지가 늘어난다
const AMB_T = {
  jin: { warm: [["오늘 배정, 위험도 낮은 걸로 골라 뒀습니다.", "……특별 대우 아닙니다."], ["갈증도 기록, 지난주보다 안정적입니다."]],
    close: [["디스패치실 커피 머신 고쳤어.", "……와서 마셔도 돼."], ["오늘 서류 다 끝났어. 드물게."]], bond: [["레지던스 비밀번호 바꿨어.", "새 거 보낼게. ……너한테만."], ["오늘은 그냥, 안부."]] },
  ruan: { warm: [["오늘 스트립 남쪽 조용해. 갈 거면 지금 가."], ["……밥 먹었냐. 아니, 피 말고."]],
    close: [["반지 하나 잃어버렸다.", "……네 근처에 떨어졌을 거 같은데."], ["레이너가 너 얘기 하더라. 신경 쓰여서."]], bond: [["지금 어디야.", "……그냥. 알고 싶어서."], ["오늘 꿈 꿨다. 말 안 해."]] },
  jenis: { warm: [["오늘 수치, 처음으로 예측대로 나왔어요.", "……조금 아쉽네요."], ["이사회 중에 하품 참느라 힘들었어요."]],
    close: [["뉴욕에서 작은 선물 샀어요.", "돌아가면 줄게요."], ["오늘 밤은 회사 일 안 해요. 그냥 대화해요."]], bond: [["편지지 하나 샀어요.", "……쓸 사람이 생겨서요."], ["보고 싶네요. 데이터상으로도요."]] },
  rainer: { warm: [["오늘 마감 커피 한 잔 남았어요.", "당신 거로 할게요."], ["손님이 피아노 신청했는데, 당신 오면 치려고 미뤘어요."]],
    close: [["오늘은 가게 일찍 닫을까 봐요.", "……이유는 안 물어보죠?"], ["창고 정리하다 오래된 악보 찾았어요. 같이 봐요."]], bond: [["뉴올리언스는 지금 비 온대요.", "언젠가 같이 가요."], ["음… 그냥 이름 한번 불러 보고 싶어서요."]] },
  anzi: { warm: [["오늘 편집 회의 중에 너 생각나서 웃었어."], ["흠. 네 근무 앞치마, 1면 사진으로 쓰고 싶은데."]],
    close: [["오늘 1면 고민 중. 네 의견 들을래."], ["……어제 보낸 커피 맛있었어?"]], bond: [["오늘은 기사 안 써.", "하루 종일 너 구경할래."], ["흠. 이 채널 너만 알아. 다른 데 말하지 마."]] },
  minos: { warm: [["오늘 현장 끝. 별일 없었다."], ["……밥 먹었냐. 이번엔 진짜로 묻는 거다."]],
    close: [["순찰 경로 네 거처 쪽으로 바꿨다.", "……우연이다."], ["오늘 할머니 댁 다녀왔다.", "……그냥 말하고 싶었다."]], bond: [["다음 비번 날, 비워 둬."], ["등 뒤가 조용하다. 너 있을 때만."]] },
  maquia: { warm: [["……네 행동, 세 번째 예측도 틀렸다."], ["흠. 오늘은 질문 없나."]],
    close: [["외곽 공원 숲길, 밤엔 조용하다.", "……그냥 그렇다고."], ["체스 둘 줄 아나."]], bond: [["……네가 연락 안 하면, 신경이 쓰인다."], ["오늘 밤, 시간 비워 둬라."]] },
};
const ambPool = id => { const n = TIER_N[tier(id)], t = AMB_T[id] || {}; return [...AMB[id], ...(n >= 1 ? t.warm || [] : []), ...(n >= 2 ? t.close || [] : []), ...(n >= 3 ? t.bond || [] : [])]; };
function checkTierUp(id, before) {
  const now = tier(id), r = REL(id);
  if (TIER_N[now] <= TIER_N[before] || (r.ms || []).includes(now)) return;
  (r.ms = r.ms || []).push(now); save();
  toast(`♥ ${CH[id].ko} · 관계 ${TIER_KO[now]}`);
  renderDevices();
  const m = MILESTONE[id] && MILESTONE[id][now];
  if (m) setTimeout(() => pushMsg(id, m, true), rand(4000, 8000));
}
const lvHour = () => +new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }) % 24;
const pick = a => a[rand(0, a.length - 1)];

// 호감도가 오르면 같은 말에도 다르게 답한다
const TIERED = {
  like: {
    jin: { warm: ["……근무 시간 외에 말씀하세요.", "기록에서 지워 두겠습니다. 이번만."], close: ["……알아. 여기선 그만해.", "업무 채널입니다. ……나중에 직접 말해."], bond: ["……나도. 근무 끝나고 다시 말해."] },
    ruan: { warm: ["……하.", "그런 말 쉽게 하지 마. 믿는다."], close: ["알아.", "……나도 그래. 됐지? 이제 자."], bond: ["……알아. 몇 번을 말해.", "나도. 됐냐."] },
    jenis: { warm: ["……후. 계산에 없던 말이네요."], close: ["저도요. 예측은 못 했지만."], bond: ["알아요. 저도 숨길 생각 없어요."] },
    rainer: { warm: ["음… 그 말, 기억해 둘게요."], close: ["알아요. 그래서 놓아줄 생각 없어요."], bond: ["음… 그 말 들으려고 기다렸어요."] },
    anzi: { warm: ["흠. 이번엔 장난으로 안 들리네."], close: ["……알아. 그러니까 장난 그만 치게 만들지 마."], bond: ["……이번엔 기사 안 써. 나만 알 거야."] },
    minos: { warm: ["……그런 말은 맨정신일 때 해."], close: ["알아. ……나도."], bond: ["……알아. 그러니까 다치지 마."] },
    maquia: { warm: ["……기록해 두지."], close: ["……알고 있다."], bond: ["……기억해 두지. 오래."] },
  },
  thanks: {
    jin: { close: ["……천만에."], bond: ["……당연한 거야."] }, ruan: { warm: ["됐어. ……다음에도 불러."], close: ["됐다고. 다음에도 불러."], bond: ["……됐다니까."] }, jenis: { close: ["당신이니까요."], bond: ["고마운 건 저예요."] },
    rainer: { close: ["음, 그 말은 오래 기억할게요."], bond: ["그냥 있어 줘요. 그거면 돼요."] }, anzi: { close: ["……그런 말 들으면 기사 못 쓰잖아."], bond: ["……그 말 좋아. 또 해."] }, minos: { close: ["……됐다. 다치지만 마."], bond: ["됐다. ……근데 듣긴 좋네."] }, maquia: { close: ["……그래."], bond: ["……그래. 기억해 두지."] },
  },
  greet: {
    jin: { close: ["……왔어?"], bond: ["……왔네. 오늘은 어땠어?"] }, ruan: { warm: ["어. 왔냐."], close: ["왔냐. 늦었네."], bond: ["왔냐. 기다린 건 아니고."] }, jenis: { close: ["연락 기다렸어요."], bond: ["왔네요. 오늘 수치부터 같이 봐요."] }, rainer: { close: ["음, 보고 싶었어요."], bond: ["어서 와요. 자리 비워 놨어요."] },
    anzi: { close: ["기다렸어. 아니, 진짜로."], bond: ["왔다. 오늘은 내가 먼저 얘기할래."] }, minos: { close: ["어. 별일 없지."], bond: ["어. ……왔으면 됐다."] }, maquia: { close: ["……왔군."], bond: ["……늦었군."] },
  },
  bye: {
    jin: { warm: ["내일 공지 확인하고 주무십시오."], close: ["……잘 자. 디바이스 무음으로 해."], bond: ["잘 자. 아침에 먼저 연락할게."] },
    ruan: { warm: ["어. 자."], close: ["문 잠갔냐. 확인하고 자."], bond: ["자. 내일 내가 깨운다."] },
    jenis: { warm: ["좋은 밤 되세요. 수치 기록은 내일."], close: ["푹 자요. 아침 회의 전에 연락할게요."], bond: ["잘 자요. ……오늘 대화, 저장해 둘게요."] },
    rainer: { warm: ["잘 자요."], close: ["잘 자요. 문 닫을 때 불 끄고."], bond: ["잘 자요. 내일도 와요. 꼭."] },
    anzi: { warm: ["흠, 벌써?"], close: ["잘 자. 내일 재밌는 거 들고 올게."], bond: ["……좀 더 있다 가면 안 돼? 아냐. 잘 자."] },
    minos: { warm: ["자라."], close: ["문 잠그고 자라. 순찰 그쪽으로 돈다."], bond: ["자. ……무슨 일 있으면 바로 불러. 몇 시든."] },
    maquia: { close: ["……쉬어라."], bond: ["……잘 자라."] },
  },
  help: {
    jin: { close: ["위치만 보내세요. 제가 직접 갑니다."], bond: ["지금 갈게. 연락 끊지 마."] },
    ruan: { close: ["말하지 말고 위치. 가는 중."], bond: ["숨 쉬어. 내가 간다. 아무 데도 가지 마."] },
    jenis: { close: ["어디예요. 처치 키트 들고 바로 갑니다."], bond: ["거기 있어요. ……이번엔 회의 다 버리고 갈게요."] },
    rainer: { close: ["어디예요. 가게 닫고 갈게요."], bond: ["움직이지 마요. ……누가 건드렸는지만 말해요."] },
    anzi: { close: ["……어디. 장난 아니고."], bond: ["위치 찍어. 루안보다 먼저 갈게."] },
    minos: { close: ["위치. 사이렌 켜고 간다."], bond: ["말하지 마, 위치 잡았다. 버텨."] },
    maquia: { close: ["어디."], bond: ["……움직이지 마라. 지금 간다."] },
  },
  fallback: {
    jin: { warm: ["……그렇군요.", "말씀 계속하세요. 듣고 있습니다."], close: ["응. 계속해.", "……듣고 있어. 서류 보면서지만."], bond: ["응. 다 듣고 있어.", "……그 얘기, 차 마시면서 마저 해."] },
    ruan: { warm: ["그래서.", "……듣고 있어."], close: ["응. 그래서?", "……계속해. 안 끊어."], bond: ["응.", "말해. 다 들을게."] },
    jenis: { warm: ["음, 흥미롭네요.", "계속하세요."], close: ["그 얘기 더 해 줘요.", "음, 메모 안 하고 그냥 들을게요."], bond: ["좋아요. 계속해요.", "당신 얘기는 다 재밌어요. 비밀이에요."] },
    rainer: { warm: ["음… 그래요?", "그래서요?"], close: ["음, 더 얘기해 줘요.", "듣고 있어요. 천천히."], bond: ["계속해요. 밤 길잖아요.", "음… 목소리로 들으면 더 좋을 텐데."] },
    anzi: { warm: ["흠, 그래서?", "오, 계속."], close: ["그거 재밌다. 더.", "흠. 너 얘기는 메모 안 해. 그냥 들을래."], bond: ["계속해. 오늘은 내가 들을 차례야.", "……응. 듣고 있어."] },
    minos: { warm: ["……그래.", "음."], close: ["어. 계속해.", "……듣고 있다고."], bond: ["응. 다 말해.", "……그래서 넌 괜찮냐."] },
    maquia: { warm: ["……흠.", "계속."], close: ["……듣고 있다.", "흥미롭군."], bond: ["……계속해라.", "네 얘기는 예측이 안 돼서 좋다."] },
  },
};
// 시간대 (라스베이거스 시각)
const NIGHT = { jin: "이 시간에 업무 채널입니까. ……자세요.", ruan: "이 시간에 왜 깨 있어. 아, 우리 원래 밤이지.", jenis: "새벽이네요. 저도 아직 일합니다.",
  rainer: "가게 닫았어요. 정리 중.", anzi: "새벽 세 시가 제일 재밌는 시간이지.", minos: "야간 순찰. 너는 왜 안 자.", maquia: "……밤이 길군." };
const DAY = { jin: "낮입니다. 휴식 시간이에요. 급한 일 아니면 밤에.", ruan: "낮엔 자. 눈 아프다.", jenis: "낮엔 이사회 때문에 바빠요. 짧게요.",
  rainer: "음… 낮엔 손님 많아요. 이따 봐요.", anzi: "낮에 연락하는 애는 처음이네.", minos: "근무 중이다. 짧게.", maquia: "……낮이다." };
// 내가 산 물건 · 상태를 알고 있다
const AWARE = [
  [() => hasFx("ear"), "jenis", "이어피스 쓰는 중이죠? 수치가 덜 오르네요."],
  [() => hasFx("perf"), "minos", "향수 뿌렸냐. 덮는다고 안 없어진다."],
  [() => hasFx("case"), "jin", "디바이스 신호가 계속 흐립니다. 케이스 바꾸셨습니까."],
  [() => ST.perm.curt, "rainer", "커튼 달았다면서요. 잠은 잘 와요?"],
  [() => ST.intel.length > 0, "anzi", "정보 샀다며? 누구 거 샀어?"],
  [() => hasFx("gun"), "ruan", "권총? 쏘지 마. 쏠 일 있으면 내가 쏴."],
];
const ON_MISSION = { ruan: "지금 그 건 하는 중이잖아. 딴짓하지 마.", minos: "현장에서 디바이스 보지 마.", anzi: "임무 중에 문자라니, 여유 있네?",
  rainer: "일 끝나고 얘기해요.", jenis: "작업 중엔 집중하세요." };
// 다른 사람 이야기를 꺼내면
const NAMES = { ruan: /루안/, jenis: /제니스/, rainer: /레이너|사장님/, anzi: /안지/, minos: /미노스|형사/, jin: /(^|[^가-힣])진(이|은|는|한테|씨|이랑|하고|이가)?([^가-힣]|$)|서기장/, maquia: /마키아/ };
const MENTION = { jin: n => `${n} 건이라면 정식으로 문의하세요.`, ruan: n => `${n}? 걔 얘긴 걔한테 해.`, jenis: n => `${n} 말씀이세요? 직접 물어보시는 게 빠를 거예요.`,
  rainer: n => `${n} 얘기를 나한테 하네요. 재밌다.`, anzi: n => `흠, ${n}? 그 얘기 더 해 봐.`, minos: n => `${n}? ……그 사람 일은 그 사람한테 물어.`, maquia: n => `……${n}. 흠.` };
const PLACES = [[/벨\s?에포크|카페/, "rainer", "벨 에포크? 내 가게 말하는 거죠."], [/크로니클|신문/, "anzi", "크로니클 얘기면 나한테 해야지."], [/채혈|바늘|제약/, "jenis", "채혈 얘기라면 제 담당입니다."],
  [/경찰|LVMPD|사건/, "minos", "그 얘긴 내 쪽이다. 함부로 꺼내지 마."], [/디스패치|규정|공지/, "jin", "디스패치 관련은 제가 처리합니다."]];
// 같은 말 반복 · 같은 감정 두 번째 · 짧은 답 · 질문 · 욕 · 기분 상함 · 덧붙이는 말
const REP = { jin: n => `같은 내용 ${n}번째입니다.`, ruan: () => "……같은 말 몇 번째야.", jenis: () => "같은 문장이 반복되네요. 괜찮으세요?", rainer: () => "음… 그 말 좋아하나 봐요.",
  anzi: () => "고장 났어? 아니면 일부러?", minos: () => "알아들었다고.", maquia: () => "……." };
const AGAIN_LIKE = { jin: "……두 번째입니다. 기록 중입니다.", ruan: "또 그 소리.", jenis: "두 번 말하면 데이터가 됩니다.", rainer: "두 번이나요? 착하기도 해라.",
  anzi: "두 번째네? 이번엔 진짜야?", minos: "……한 번이면 충분하다.", maquia: "……증명은 말로 하는 게 아니다." };
const SHORT = { jin: "용건을 말씀하세요.", ruan: "성의 없네.", jenis: "음, 그게 다예요?", rainer: "음…?", anzi: "그게 다야?", minos: "뭐.", maquia: "……." };
const QUESTION = { jin: ["그건 답변 범위 밖입니다.", "확인 후 회신하겠습니다."], ruan: ["몰라. 왜 나한테 물어.", "그걸 왜 궁금해해."], jenis: ["좋은 질문이네요. 답은 나중에.", "음, 근거부터 모아 보죠."],
  rainer: ["음… 왜 궁금한데요?", "알려 주면 재미없잖아요."], anzi: ["흠, 왜 궁금한데? 그것부터 말해 봐.", "그 질문, 꽤 날카로운데."], minos: ["그건 수사 중이라 말 못 해.", "……모른다. 진짜로."], maquia: ["……네가 먼저 답해 봐.", "흠."] };
const RUDE = { jin: "……그 표현은 기록됩니다.", ruan: "……뭐라고 했냐, 방금.", jenis: "후. 감정적이시네요. 진정되면 연락 주세요.", rainer: "음… 착한 줄 알았는데.",
  anzi: "오, 화났어? 좋네. 계속해 봐.", minos: "말 가려 해.", maquia: "……두 번은 없다." };
const MAD = { jin: "……네.", ruan: "……", jenis: "업무 얘기만 하죠.", rainer: "지금은 별로 얘기하고 싶지 않네요.", anzi: "흠.", minos: "……됐다.", maquia: "……." };
const TAIL = { jin: "……이상입니다.", ruan: "……암튼.", jenis: "음, 그렇다고요.", rainer: "그냥 그렇다고요.", anzi: "흠, 재밌네.", minos: "……알았지." };
const RUDE_RE = /시발|씨발|ㅅㅂ|병신|ㅂㅅ|꺼져|닥쳐|미친놈|미친년|좆|개새|지랄/;
const SHORT_RE = /^(ㅇㅇ|ㅇ|응|웅|ㅋ+|ㅎ+|ㄴㄴ|ㄱㄱ|넵|네|어|음+|\.+|…+)$/;

// 첫 대화(선택지)가 끝난 직후, 그 말에 이어서 답하면 받아 주는 말
// [조건, 답] — 조건이 null이면 아무 말에나 (단, 의도가 뚜렷한 말이면 건너뜀). 대화당 두 번까지, 같은 답은 한 번만
const FOLLOW = {
  jin: { shift: [
    [/어디|위치|주소|가는\s?길/, ["다운타운입니다. 디바이스 지도에 찍어 두겠습니다."]],
    [/싫|안\s?가|귀찮|가기\s?싫|빠지/, ["출근 기록은 대시보드에 남습니다.", "안 남으면 제가 확인 연락 드립니다."]],
    [/위장|왜\s?(일|근무|출근)|꼭/, ["인간 사이에 섞여 사는 것도 규정입니다.", "§4. 하우스 규정 탭에 있습니다."]],
    [null, ["네. 오늘은 여기까지입니다.", "궁금한 건 하우스 규정 탭부터 보세요. 거기 없으면 그때 물으시고요."]] ] },
  ruan: {
    care: [
      [/마셨|다\s?먹|비웠|먹었/, ["……진짜?", "거짓말이면 냄새로 안다."]],
      [/걱정|맞네|챙겨|귀엽|다정/, ["아니라고.", "……한 번 더 하면 차단한다."]],
      [null, ["어.", "……됐으니까 마시기나 해."]] ],
    self: [
      [/눈앞|무슨\s?뜻|뭔\s?뜻|왜/, ["보이는 데 있으라고.", "……사고 치면 치우기 편하게. 그게 다야."]],
      [/몇|치웠|죽였|누구/, ["세다 말았어.", "……궁금해하지 마."]],
      [null, ["그래. 해 봐.", "……보고 있을게."]] ] },
  jenis: {
    no: [
      [/협박|치사|너무|그런\s?게\s?어딨|무섭/, ["협박이라뇨. 일정 안내예요.", "……표현이 차가웠다면 사과할게요. 수치는 여전히 궁금하지만."]],
      [/할게|알겠|해요|뽑아|해\s?드릴/, ["음, 마음 바뀌셨네요. 다행입니다.", "뉴욕에서 돌아가면 바로 연락드릴게요."]],
      [null, ["후. 급할 거 없어요.", "갈증도 오르면 그때 얘기하죠."]] ],
    yes: [
      [/언제|며칠|몇\s?시/, ["이사회가 끝나야 해서요. 이번 주 안엔 돌아가요.", "날짜 잡히면 디바이스로 보낼게요."]],
      [/아파|아프|무서|바늘|주사/, ["따끔한 정도예요. 알터 피부는 금방 아물고요."]],
      [/결과|알려|이상|뭐가/, ["나오면 제일 먼저 알려 드릴게요.", "……좋은 쪽이든 아니든요."]],
      [null, ["네. 그럼 그때 봬요.", "그사이 수치 너무 올리지 마시고요."]] ] },
  rainer: {
    try: [
      [/선|넘으면|무슨\s?뜻|어떻게\s?되/, ["음… 궁금해요?", "궁금해하지 않는 편이 오래 일해요."]],
      [/무서|안\s?웃|웃어/, ["지금은 웃고 있잖아요."]],
      [null, ["그럼 내일 봐요. 열 시.", "늦으면 앞치마 제일 큰 거 줄 거예요."]] ],
    blood: [
      [/창고|지하|뭐가\s?있|뭐\s?있/, ["와인. 악보. 그런 거요.", "……그렇게 믿는 게 편할 거예요."]],
      [/왜|열면|열어/, ["열면 알게 되겠죠.", "근데 그다음엔 여기서 일 못 해요."]],
      [/웃|어떻게/, ["입꼬리만요. 눈은 안 웃어도 돼요.", "손님들은 그 차이 몰라요."]],
      [null, ["그럼 내일 봐요. 열 시.", "늦으면 앞치마 제일 큰 거 줄 거예요."]] ] },
  anzi: { hint: [
    [/눌렀|눌러\s?봤|들어갔|뭐야\s?거기|열렸/, ["흠. 벌써? 손 빠르네."]],
    [/어디|버전|번호|어떻게/, ["화면 제일 아래. HOUSE OS 어쩌고 하는 글자.", "세 번. 빠르게."]],
    [/왜|비밀|진한테|진이/, ["진은 규정 좋아하잖아.", "이건 규정 밖이거든."]],
    [/화|안\s?났|아니/, ["아니면 말고. 표정은 화났던데."]],
    [null, ["흠. 반응 좋네.", "또 말 걸어. 심심할 때."]] ] },
  minos: {
    why: [
      [/진\s?말고|진이|진은|왜\s?진/, ["진은 서류부터 쓴다.", "난 차부터 몬다."]],
      [/알겠|그럴게|연락할/, ["그래. 번호 저장해 둬."]],
      [null, ["……그래.", "이상한 거 보면, 바로."]] ],
    stay: [
      [/냄새|짙/, ["갈증 오른 알터 냄새.", "……사람 많은 데선 티 난다고."]],
      [/언제|그럼|나중|지금은/, ["수치 내려가면.", "……생각해 본다고는 안 했다."]],
      [null, ["쯧.", "그런 말은 수치 내리고 해."]] ] },
  maquia: {
    mean: [
      [/숨기|안\s?숨|모르|뭘/, ["……그 대답도 기록에 남는다."]],
      [/누구|당신|이름/, ["마키아.", "그거면 충분하다."]],
      [null, ["……흠.", "다음엔 네가 먼저 말해라."]] ],
    who: [
      [/뭘|뭐를|봤다|기록/, ["네 기록.", "빈칸이 많더군."]],
      [/필요|왜|언제|찾/, ["때가 되면.", "……그 전에 사라지지는 마라."]],
      [null, ["…….", "기억해 둬라. 두 번 말하지 않는다."]] ] },
};
function followUp(id, t, norm) {
  const s = CHAT[id], list = s.done && FOLLOW[id] && FOLLOW[id][s.node];
  if (!list) return null;
  const r = REL(id), f = r.fu = r.fu || { n: 0, used: [], last: "" };
  if (f.n >= 2) return null;
  // 그사이 다른 말(먼저 온 메시지 등)이 끼었으면 이어지는 대화가 아니다
  const them = [...s.log].reverse().find(m => m[0] === "them");
  const endLine = TALK[id][s.node].say.slice(-1)[0];
  if (!them || (them[1] !== endLine && them[1] !== f.last)) return null;
  const hit = INTENTS.find(([, re]) => re.test(t)), key = hit ? hit[0] : "fallback";
  if (["help", "secret", "ux", "like"].includes(key)) return null; // 뚜렷한 용건은 원래 답으로
  let i = list.findIndex(([re], k) => re && !f.used.includes(k) && re.test(t));
  if (i < 0) { i = list.length - 1; if (f.used.includes(i) || !(key === "fallback" || key === "thanks" || SHORT_RE.test(norm) || norm.length <= 1)) return null; }
  const lines = list[i][1];
  f.used.push(i); f.n++; f.last = lines[lines.length - 1]; r.lastIntent = "follow"; save();
  return lines;
}
// 답장 만들기 — [줄 목록, 기다리는 시간(ms)]
function replyTo(id, text) {
  const r = REL(id), t = text.replace(/\s+/g, " ").trim(), norm = t.replace(/[\s.!?~]/g, "");
  const out = [];
  // 기분 상한 동안엔 짧게만
  if (NOW() < r.mad) return [[MAD[id]], 2500];
  if (RUDE_RE.test(t)) { addAff(id, -8); r.mad = NOW() + 10 * 60000; save(); return [[RUDE[id]], 900]; }
  // 같은 말 반복
  r.reps[norm] = (r.reps[norm] || 0) + 1;
  if (r.reps[norm] >= 3) { save(); return [[REP[id](r.reps[norm])], 900]; }
  const fo = followUp(id, t, norm);
  if (fo) return [fo, rand(900, 1600)];
  if (SHORT_RE.test(norm) || norm.length <= 1) return [[SHORT[id]], 1200];

  const hit = INTENTS.find(([, re]) => re.test(t)), key = hit ? hit[0] : "fallback";
  // 갈증도가 높으면 먼저 그 얘기부터
  if (ST.th >= 80 && key !== "thirst" && Math.random() < .4) out.push(pick(REPLY[id].thirst)(ST.th));
  let line;
  // 다른 사람 이름 · 장소를 집어서 받아치기
  const other = Object.keys(NAMES).find(k => k !== id && NAMES[k].test(t));
  const place = PLACES.find(([re, who]) => who === id && re.test(t));
  if (place) line = place[2];
  else if (other && (key === "fallback" || key === "who")) line = MENTION[id](CH[other].ko);
  // 같은 감정 두 번 연속 (좋아한다는 말)
  else if (key === "like" && r.lastIntent === "like") line = AGAIN_LIKE[id];
  else {
    // 진행 중인 동행 임무
    const mine = ST.ms.find(m => (m.s === "go" || m.s === "rep") && MISSION_POOL[m.k].with === id);
    const aware = AWARE.find(([ok, who]) => who === id && ok());
    const h = lvHour();
    if ((key === "greet" || key === "fallback") && mine && ON_MISSION[id] && Math.random() < .6) line = ON_MISSION[id];
    else if ((key === "greet" || key === "fallback") && aware && !(r.seenAware || []).includes(aware[2]) && Math.random() < .6) { line = aware[2]; (r.seenAware = r.seenAware || []).push(aware[2]); }
    else if (key === "greet" && Math.random() < .5 && (h < 6 || (h >= 8 && h < 17))) line = h < 6 ? NIGHT[id] : DAY[id];
    else if (key === "fallback" && /[?？]$/.test(t)) line = pick(QUESTION[id]);
    else {
      const tiered = TIERED[key] && TIERED[key][id] && TIERED[key][id][tier(id)];
      const pool = tiered || REPLY[id][key] || REPLY[id].fallback;
      line = pick(pool); if (typeof line === "function") line = line(ST.th);
    }
  }
  out.push(line);
  // 가끔 한 줄 더 덧붙이거나, 마키아·미노스는 가끔 "……"만
  if (TAIL[id] && out.length === 1 && Math.random() < .18) out.push(TAIL[id]);
  if ((id === "maquia" || id === "minos") && tier(id) === "cold" && Math.random() < .08) { out.length = 0; out.push("……"); }
  r.lastIntent = key; r.lastText = norm; save();
  // 읽고 한참 있다 답하는 때도 있다
  const wait = Math.random() < .15 ? rand(3000, 5000) : rand(700, 1400);
  return [out, wait];
}
function relLabel(id) { return `<span class="rel rel-${tier(id)}">관계 · ${TIER_KO[tier(id)]} ${aff(id)}</span>`; }
function syncChatInput() {
  const on = !!cur && !busy;
  $("#chatText").disabled = $("#chatIn button").disabled = !on;
  $("#chatText").placeholder = cur ? `${CH[cur].ko}에게 메시지…` : "대화를 고르면 입력할 수 있어요";
}
$("#chatIn").onsubmit = async e => {
  e.preventDefault();
  const id = cur, input = $("#chatText"), text = input.value.trim();
  if (!id || !text || busy) return;
  input.value = "";
  const before = tier(id);
  CHAT[id].log.push(["me", text]); bubble("me", text); save();
  busy = true; syncChatInput();
  const [lines, wait] = replyTo(id, text);
  // 꺼져 있거나 바쁜 사람은 답이 더 늦다
  const slow = /OFFLINE|비공개|방해/.test(CH[id].st);
  if (slow) { const p = document.createElement("p"); p.className = "bub sys"; p.textContent = "— 읽음 표시 없음 —"; $("#chatLog").appendChild(p); }
  await new Promise(r => setTimeout(r, slow ? 6000 : wait));
  busy = false;
  await say(id, lines);
  if (cur === id) $("#chatState").innerHTML = `<span class="live"><i></i>${CH[id].st}</span>${relLabel(id)}`;
  drawChoices(id); syncChatInput();
  checkTierUp(id, before); renderDevices();
};

/* ===================================================================
   탭
   =================================================================== */
function openTab(t) {
  $$(".pt-nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  $$(".tab").forEach(x => x.classList.toggle("on", x.id === "tab-" + t));
  if (t === "msg" && !cur) openChat(ORDER.find(id => CHAT[id].unread) || "jin");
  if (t === "dispatch") { renderDispatch(); markDispatch(false); }
}
$$(".pt-nav button").forEach(b => b.onclick = () => openTab(b.dataset.tab));

/* ===================================================================
   모달 — 공개 사이트 메뉴, 언더럭스 영수증
   =================================================================== */
function modal(html, cls = "") {
  $("#modalBody").innerHTML = html; $("#modal").className = "modal on " + cls;
}
$("#modalX").onclick = () => $("#modal").className = "modal";
$("#modal").onclick = e => { if (e.target.id === "modal") $("#modal").className = "modal"; };
// 공개 사이트 하위 페이지 — 평범한 대기업처럼, 밤 냄새만 살짝
const stat = a => `<div class="cp-stats">${a.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join("")}</div>`;
const sec = (h, p) => `<div class="cp-sec"><h4>${h}</h4><p>${p}</p></div>`;
const PAGES = {
  about: ["ABOUT CORVUS", "We keep the night running.",
    `<p class="cp-lead">코르부스 그룹은 해가 진 뒤에도 멈추지 않는 도시를 위해 일합니다. 호스피탈리티, 바이오, 특수 물류 — 세 개의 축으로 전 세계 12개 도시의 밤을 지탱합니다.</p>` +
    stat([["1906", "라스베이거스 창립"], ["12", "운영 도시"], ["24/7", "무휴 운영"], ["47년", "임원 평균 근속"]]) +
    sec("우리의 시작", "1906년, 라스베이거스 철도 부지의 작은 야간 화물 창고에서 시작했습니다. 낮에는 아무도 오지 않던 그 창고가, 지금의 코르부스입니다.") +
    sec("우리의 원칙", "· <b>신뢰</b> — 고객의 비밀은 회사의 비밀입니다.<br>· <b>지속</b> — 오래 갑니다. 아주 오래.<br>· <b>질서</b> — 모든 직원은 정해진 규정 안에서 보호받습니다.") +
    sec("경영진", "코르부스의 경영진은 언론 노출을 최소화합니다. 이사회 명단은 주주에게만 공개되며, 창립자에 관한 문의는 받지 않습니다.")],
  hospitality: ["HOSPITALITY", "호텔 · 리조트 · 카페",
    `<p class="cp-lead">스트립의 카지노 호텔부터 다운타운의 부티크 카페까지. 코르부스 계열 매장은 손님이 잠들지 않는 시간에 가장 빛납니다.</p>` +
    stat([["3,200+", "객실"], ["9", "카지노 · 라운지"], ["98%", "야간 객실 점유율"]]) +
    sec("더 세이렌 (The Siren)", "스트립 중심의 카지노 호텔. 최상층 VIP 프라이빗 룸은 초대받은 고객만 이용할 수 있습니다. 모든 객실에 완전 암막 커튼을 기본으로 제공합니다.") +
    sec("카페 벨 에포크 (Belle Époque)", "다운타운의 빈티지 카페. 붉은 벽돌 아치와 재즈, 밤늦게까지 이어지는 커피. <small>지하층은 일반 손님에게 개방하지 않습니다.</small>") +
    sec("장기 투숙 · 레지던스", "출장과 이주가 잦은 임직원을 위해 장기 객실과 고층 스위트, 펜트하우스를 운영합니다. 입주는 회사 배정으로만 가능합니다.")],
  biotech: ["BIOTECH", "혈액 · 의약 공급망",
    `<p class="cp-lead">제휴 제약사와 함께 정제 혈액 제제를 안정적으로 수급합니다. 수혈이 필요한 순간, 공급은 끊기지 않아야 하니까요.</p>` +
    stat([["410만 팩", "연간 공급량"], ["−4°C", "콜드체인 유지"], ["0건", "공급 중단 사고"]]) +
    sec("정제 혈액 제제", "헌혈·의료기관 협력망으로 확보한 혈액을 정제·분류해 냉장 보관합니다. 혈액형·성분별로 관리되며 모든 팩에 고유 추적번호가 붙습니다.") +
    sec("연구 협력", "제휴 제약사 연구소와 혈액 대사·장기 보존 분야를 공동 연구합니다. <small>연구 결과는 대외 비공개입니다.</small>") +
    sec("유의 사항", "코르부스는 일반 소비자에게 혈액 제품을 판매하지 않습니다. 개인 간 혈액 거래는 불법이며, 회사와 무관합니다.")],
  logistics: ["LOGISTICS", "야간 특수 물류",
    `<p class="cp-lead">냉장 컨테이너 기반의 심야 배송 네트워크. 해가 뜨기 전에 도착합니다.</p>` +
    stat([["C-1~C-9", "운영 노선"], ["03:00~05:30", "운행 시간"], ["100%", "일출 전 도착률"]]) +
    sec("운영 방식", "모든 차량은 새벽 3시 이후 출발해 일출 전에 복귀합니다. 낮 시간대 배송은 운영하지 않습니다.") +
    sec("보안", "적재물 정보는 발송인과 수령인, 그리고 회사만 압니다. 차량 외부에는 최소한의 로고만 부착합니다.") +
    sec("배송 조회", "배송 조회와 노선 변경은 직원 포털에서만 가능합니다. 외부 문의 번호는 운영하지 않습니다.")],
  careers: ["CAREERS", "야간 근무자 상시 채용",
    `<p class="cp-lead">코르부스는 밤이 편한 사람을 찾습니다.</p>` +
    stat([["일몰~일출", "근무 시간"], ["매달 같은 날", "급여 지급"], ["제공", "거처 · 식사"]]) +
    sec("모집 분야", "· 호텔 · 카페 야간 서비스<br>· 냉장 물류 운송 보조<br>· 보안 · 현장 정리<br>· 행정 · 디스패치") +
    sec("우대 사항", "· 밤에 강한 분<br>· 피를 보고도 침착한 분<br>· 비밀을 잘 지키는 분<br>· 오래 일할 수 있는 분 <small>(정말 오래)</small>") +
    sec("지원 방법", "공개 채용은 하지 않습니다. 추천으로만 선발하며, <b>필요한 인재는 저희가 먼저 찾아갑니다.</b>")],
  privacy: ["PRIVACY", "개인정보 처리방침",
    sec("수집 항목", "이름, 연락처, 근무 기록, 생체 신호(사내 디바이스 착용자에 한함).") +
    sec("보관 기간", "코르부스 그룹은 귀하의 정보를 아주 오래 보관합니다. <small>보관 기간: 무기한.</small>") +
    sec("제3자 제공", "법령에 따른 경우를 제외하고, 귀하의 정보는 '내부'에서만 공유됩니다.")],
  investors: ["INVESTORS", "투자자 정보",
    stat([["+31%", "2026 야간 매출 성장"], ["0", "적자 분기"], ["120년", "무배당 중단 기록"]]) +
    sec("주주총회", "정기 주주총회는 매년 동지(冬至) 자정에 열립니다. 의결권은 대리 행사할 수 없습니다.") +
    sec("공시", "분기 실적은 직원 포털과 주주 전용 채널로만 공시합니다.")],
};
// 하위 페이지 머리 사진 — 없으면 회사 로고 패턴으로 대신
const PAGE_IMG = { about: "../../img/w02.webp",
  hospitality: "../../img/w03.webp", biotech: "../../img/w04.webp", logistics: "../../img/w05.webp" };
const CORP_ORDER = ["about", "hospitality", "biotech", "logistics", "careers", "investors", "privacy"];

/* ===================================================================
   다국어 — 공개 사이트만 KO / EN / JP
   =================================================================== */
const PAGES_L = { ko: PAGES };
PAGES_L.en = {
  about: ["ABOUT CORVUS", "We keep the night running.",
    `<p class="cp-lead">Corvus Group works for cities that never stop after dark. Across hospitality, biotech and specialty logistics, we keep the night running in twelve cities worldwide.</p>` +
    stat([["1906", "Founded in Las Vegas"], ["12", "Cities"], ["24/7", "Operations"], ["47 yrs", "Avg. executive tenure"]]) +
    sec("Our Beginning", "In 1906 we started as a small night-freight depot beside the Las Vegas rail yard. A warehouse nobody visited by day — that is Corvus today.") +
    sec("Our Principles", "· <b>Trust</b> — a client's secret is the company's secret.<br>· <b>Endurance</b> — we last. For a very long time.<br>· <b>Order</b> — every employee is protected within the rules.") +
    sec("Leadership", "Our leadership keeps a minimal public profile. The board roster is disclosed to shareholders only, and we do not answer inquiries about our founder.")],
  hospitality: ["HOSPITALITY", "Hotels · Resorts · Cafés",
    `<p class="cp-lead">From casino hotels on the Strip to a boutique café downtown, Corvus venues shine brightest in the hours our guests stay awake.</p>` +
    stat([["3,200+", "Rooms"], ["9", "Casinos · Lounges"], ["98%", "Night occupancy"]]) +
    sec("The Siren", "A casino hotel in the heart of the Strip. The top-floor VIP private rooms are by invitation only. Every room comes with full blackout curtains as standard.") +
    sec("Café Belle Époque", "A vintage café downtown — red-brick arches, jazz, and coffee late into the night. <small>The basement level is not open to the public.</small>") +
    sec("Long-stay · Residences", "Long-stay rooms, high-rise suites and penthouses for employees who travel or relocate often. Residency is by company assignment only.")],
  biotech: ["BIOTECH", "Blood & Pharmaceutical Supply",
    `<p class="cp-lead">With our partner pharmaceutical companies, we secure a stable supply of refined blood products. When a transfusion is needed, supply must never stop.</p>` +
    stat([["4.1M units", "Annual supply"], ["−4°C", "Cold chain"], ["0", "Supply outages"]]) +
    sec("Refined Blood Products", "Blood secured through donation and medical partners is refined, sorted by type and component, and kept refrigerated. Every unit carries a unique tracking number.") +
    sec("Research Partnership", "Joint research with partner labs on blood metabolism and long-term preservation. <small>Results are not disclosed.</small>") +
    sec("Please Note", "Corvus does not sell blood products to consumers. Private blood trading is illegal and has nothing to do with the company.")],
  logistics: ["LOGISTICS", "Night Specialty Logistics",
    `<p class="cp-lead">A late-night delivery network built on refrigerated containers. We arrive before sunrise.</p>` +
    stat([["C-1–C-9", "Routes"], ["03:00–05:30", "Operating hours"], ["100%", "Pre-dawn arrival"]]) +
    sec("How We Operate", "Every vehicle departs after 3 a.m. and returns before sunrise. We do not run daytime deliveries.") +
    sec("Security", "Cargo details are known only to the sender, the recipient and the company. Vehicles carry minimal exterior branding.") +
    sec("Tracking", "Tracking and route changes are available only through the employee portal. We do not run an external inquiry line.")],
  careers: ["CAREERS", "Night Staff — Always Hiring",
    `<p class="cp-lead">Corvus is looking for people who are comfortable with the night.</p>` +
    stat([["Sunset–Sunrise", "Working hours"], ["Same day monthly", "Payday"], ["Provided", "Housing · Meals"]]) +
    sec("Open Positions", "· Hotel & café night service<br>· Refrigerated logistics assistant<br>· Security & site cleanup<br>· Administration & dispatch") +
    sec("Preferred", "· Strong at night<br>· Calm at the sight of blood<br>· Good at keeping secrets<br>· Able to stay a long time <small>(a really long time)</small>") +
    sec("How to Apply", "We do not hold open recruitment. Selection is by referral only — <b>when we need someone, we find them first.</b>")],
  investors: ["INVESTORS", "Investor Relations",
    stat([["+31%", "FY2026 night revenue growth"], ["0", "Loss-making quarters"], ["120 yrs", "Dividends never suspended"]]) +
    sec("Annual Meeting", "The annual general meeting is held every year at midnight on the winter solstice. Voting rights cannot be exercised by proxy.") +
    sec("Disclosure", "Quarterly results are disclosed only through the employee portal and the shareholder channel.")],
  privacy: ["PRIVACY", "Privacy Policy",
    sec("Data We Collect", "Name, contact details, work records, biometric signals (company-device wearers only).") +
    sec("Retention", "Corvus Group keeps your information for a very long time. <small>Retention period: indefinite.</small>") +
    sec("Third Parties", "Except as required by law, your information is shared only “internally.”")],
};
// 뉴스룸 — 평범한 보도자료처럼, 읽어 보면 어딘가 이상한
const NEWS_META = [{ d: "2026.11.04", big: true, img: "../../img/w02.webp" }, { d: "2026.11.02" }, { d: "2026.10.28" }, { d: "2026.10.21" }, { d: "2026.10.15" }];
// 뉴스룸 본문 — 평범한 기업 보도자료처럼, 읽을수록 어딘가 이상하게
const NEWS_BODY = {
  ko: [
`<p><b>[라스베이거스=코르부스 커뮤니케이션실]</b> 코르부스 그룹이 라스베이거스 야간 경제의 흐름을 분석한 「2026 야간 경제 리포트」를 발간했다.</p>
<p>리포트에 따르면 라스베이거스 야간 소비의 <b>68%</b>가 새벽 1시에서 4시 사이에 발생했다. 같은 시간대 숙박·식음료 결제는 전년 대비 31% 늘었으며, 특히 <b>해가 뜨기 직전 30분</b> 동안 귀가 교통과 객실 체크인이 동시에 몰리는 '역(逆) 출근 시간대'가 처음으로 확인됐다.</p>
<p>조사는 코르부스 계열 호텔·카페·물류 거점에서 수집한 결제·이동 데이터 1억 2천만 건을 바탕으로 했다. 설문 조사는 응답자의 편의를 위해 <b>일몰 이후에만</b> 진행됐다. 응답자 가운데 3%는 나이 기재를 거부했으며, 그룹은 이 응답도 그대로 분석에 포함했다.</p>
<p>그룹 커뮤니케이션실장은 "밤은 더 이상 낮의 연장이 아니다. 밤에만 사는 사람들이 있고, 그들은 우리가 생각하는 것보다 훨씬 오래 이 도시를 지켜 왔다"며 "코르부스는 앞으로도 그들의 시간을 위해 문을 열어 두겠다"고 밝혔다.</p>
<p>그룹은 리포트 결과를 바탕으로 내년 상반기 스트립 남쪽에 <b>창문 없는 장기 투숙 객실</b> 120실을 추가로 열 계획이다. 리포트 전문은 주주와 임직원에게만 공개된다.</p>`,
`<p><b>카페 벨 에포크를 찾아 주시는 손님 여러분께.</b></p>
<p>다운타운 카페 벨 에포크의 지하층이 리모델링을 위해 <b>별도 공지 시까지</b> 일반 손님께 개방되지 않습니다. 1층 카페와 2층 라운지는 평소처럼 오전 10시부터 영업합니다.</p>
<p>공사 기간 중 지하에서 들리는 소리는 모두 공사 소음입니다. 공사는 손님이 적은 <b>새벽 3시부터 5시 사이</b>에만 진행되며, 그 시간대에는 지하 계단 쪽 문이 잠겨 있습니다. 문이 열려 있더라도 내려가지 마시기 바랍니다.</p>
<p>지하 계단 근처에서 발견된 분실물은 카운터에서 보관하고 있습니다.<br>· 은 반지 1점 (안쪽에 각인 있음)<br>· 찢어진 형광 안전 조끼 1점<br>· 주인 없는 손목시계 1점 (아직 작동함)<br>본인 확인 후 돌려 드립니다.</p>
<p>벨 에포크 대표는 "오래된 건물이라 지하에 손볼 곳이 많다. 손님들이 내려올 일은 없을 것"이라며 "그동안 위층에서 커피 향만 즐겨 주시면 된다"고 전했다.</p>
<p>불편을 드려 죄송합니다. 위층의 커피는 그대로입니다.</p>`,
`<p><b>[라스베이거스=코르부스 커뮤니케이션실]</b> 코르부스 그룹 바이오 부문이 뉴욕 소재 제휴 제약사와 <b>정제 혈액의 장기 보존</b>에 관한 공동 연구에 착수했다.</p>
<p>현재 일반적인 적혈구 제제의 보관 기한은 냉장 기준 약 42일이다. 이번 연구는 이를 <b>수년 단위</b>로 늘리는 것을 목표로 한다. 연구진은 "시간이 지나도 굳지 않고, 처음 채혈한 날과 똑같은 상태를 유지하는 혈액"을 만드는 것이 최종 목표라고 설명했다.</p>
<p>제휴사 측 연구 책임자는 "예측할 수 없는 변수가 가장 위험하다. 공급이 끊기는 순간을 원천적으로 없애고 싶다"며 "필요한 사람에게, 필요한 만큼, 언제든 닿는 혈액이 목표"라고 말했다.</p>
<p>연구 결과의 활용 범위를 묻는 질문에 그룹은 "<b>수혈 외의 용도는 검토하지 않는다</b>"고 짧게 답했다. 연구 결과는 학술지에 게재하지 않으며, 그룹 내부와 제휴사 사이에서만 공유된다.</p>
<p>연구는 라스베이거스와 뉴욕의 연구소에서 동시에 진행된다. 두 연구소 모두 <b>야간 근무 연구원</b>을 상시 모집 중이다.</p>`,
`<p><b>냉장 물류 C-7 노선 운행 시간 변경 안내</b></p>
<p>계절에 따른 일출 시각 변화로 C-7 노선의 출발 시간을 다음과 같이 앞당깁니다.<br>· 변경 전: 04:30 출발<br>· 변경 후: <b>04:10 출발</b><br>· 적용: 다음 주 월요일부터</p>
<p>코르부스 특수 물류는 창립 이래 <b>일출 전 도착률 100%</b>를 지켜 왔습니다. 모든 운전원은 일출 30분 전까지 거점으로 복귀해야 하며, 이 원칙에는 예외가 없습니다.</p>
<p>운행 중인 차량은 어떤 경우에도 적재함 문을 열지 않습니다. 길에서 적재함을 열어 달라는 요청을 받으면 운전원은 정중히 거절하고 담당 부서로 연락합니다. 이는 적재물의 온도 유지를 위한 조치입니다.</p>
<p><b>C-7 노선 인근 주민 여러분께.</b> 새벽 시간 냉장 장치의 소음과 차량 불빛에 양해 부탁드립니다. 트럭이 지나간 뒤 길에 남는 찬 공기는 냉장 장치에서 나오는 것으로, 인체에 해롭지 않습니다.</p>
<p>문의: 직원 포털 (외부 문의 창구는 운영하지 않습니다)</p>`,
`<p><b>[라스베이거스=코르부스 커뮤니케이션실]</b> 코르부스 그룹이 라스베이거스 지역 헌혈 캠페인 「밤의 손길」을 후원한다.</p>
<p>캠페인은 매주 금요일 <b>저녁 8시부터 새벽 4시까지</b> 카지노 호텔 더 세이렌 별관에서 열린다. 낮에는 시간을 내기 어려운 야간 근무자와 관광객을 위해 일몰 이후로 시간을 정했다고 그룹은 설명했다.</p>
<p>참여자 전원에게는 더 세이렌 야간 라운지 이용권이 주어진다. 채혈은 그룹이 직접 교육한 숙련 직원이 맡는다. 한 참여자는 "주사를 맞은 줄도 몰랐다. 끝나고 나니 이상하게 기분이 편안했다"고 말했다.</p>
<p>그룹은 혈액형이 드물거나 혈액 상태가 특히 좋은 일부 참여자에게 <b>추가로 연락을 드릴 수 있다</b>고 안내했다. 연락은 대부분 늦은 밤에 간다.</p>
<p>그룹 관계자는 "피는 사람을 살린다. 그 사실을 누구보다 잘 알고 있다"며 "한 사람의 피가 얼마나 귀한지, 앞으로도 오래 기억하겠다"고 말했다.</p>`,
  ],
  en: [
`<p><b>LAS VEGAS — Corvus Communications.</b> Corvus Group has published its <i>2026 Night Economy Report</i>, an analysis of how the Las Vegas night is spent.</p>
<p>According to the report, <b>68%</b> of night-time spending in Las Vegas takes place between 1 and 4 a.m. Lodging and food &amp; beverage payments in those hours rose 31% year on year, and for the first time the report identifies a “reverse rush hour” in <b>the last 30 minutes before sunrise</b>, when traffic home and room check-ins peak together.</p>
<p>The study draws on 120 million payment and movement records from Corvus hotels, cafés and logistics hubs. For respondents' convenience, surveys were conducted <b>only after sunset</b>. Three percent of respondents declined to state their age; the group included their answers anyway.</p>
<p>“The night is no longer an extension of the day,” said the group's head of communications. “There are people who live only at night, and they have watched over this city far longer than most of us imagine. Corvus will keep its doors open for their hours.”</p>
<p>Based on the findings, the group plans to open 120 additional <b>windowless long-stay rooms</b> south of the Strip next year. The full report is available to shareholders and employees only.</p>`,
`<p><b>To our guests at Café Belle Époque.</b></p>
<p>The basement level of Café Belle Époque downtown will be closed to the public for renovation <b>until further notice</b>. The ground-floor café and second-floor lounge remain open from 10 a.m. as usual.</p>
<p>Any sounds you may hear from below during this period are construction noise. Work is carried out only <b>between 3 and 5 a.m.</b>, when the café is quiet, and the door to the basement stairs is locked at those hours. If you find it open, please do not go down.</p>
<p>Items found near the basement stairs are being kept at the counter:<br>· One silver ring (engraved on the inside)<br>· One torn high-visibility safety vest<br>· One unclaimed wristwatch (still running)<br>They will be returned upon proof of ownership.</p>
<p>“It's an old building, and the basement needs a lot of work,” said the café's owner. “Our guests won't need to come down. Just enjoy the smell of coffee upstairs in the meantime.”</p>
<p>We apologize for the inconvenience. The coffee upstairs is unchanged.</p>`,
`<p><b>LAS VEGAS — Corvus Communications.</b> Corvus Group's biotech division has begun joint research with a New York–based partner pharmaceutical company on the <b>long-term preservation of refined blood</b>.</p>
<p>Refrigerated red blood cell products currently keep for about 42 days. The study aims to extend that to <b>years</b>. The ultimate goal, the researchers say, is “blood that never clots with time and stays exactly as it was on the day it was drawn.”</p>
<p>“Unpredictable variables are the greatest risk,” said the partner company's lead researcher. “We want to eliminate the moment supply runs out altogether. Blood that reaches whoever needs it, as much as they need, whenever they need it.”</p>
<p>Asked how the results might be used, the group answered briefly: “<b>We are not considering any use other than transfusion.</b>” The results will not be published in academic journals and will be shared only within the group and its partner.</p>
<p>Research is under way at laboratories in Las Vegas and New York. Both are always recruiting <b>night-shift researchers</b>.</p>`,
`<p><b>Schedule Change for Refrigerated Route C-7</b></p>
<p>Due to the seasonal change in sunrise times, departures on Route C-7 will move earlier:<br>· Before: 04:30<br>· After: <b>04:10</b><br>· Effective: next Monday</p>
<p>Since its founding, Corvus Specialty Logistics has maintained a <b>100% pre-dawn arrival rate</b>. Every driver must return to base at least 30 minutes before sunrise. There are no exceptions to this rule.</p>
<p>Vehicles in service will not open their cargo doors under any circumstances. If asked on the road to open the cargo hold, drivers will politely decline and contact the responsible department. This is to keep the cargo at temperature.</p>
<p><b>To residents along Route C-7:</b> we ask for your understanding regarding refrigeration noise and headlights in the early hours. The cold air left on the road after a truck passes comes from the refrigeration unit and is harmless.</p>
<p>Inquiries: employee portal only (no external inquiry line).</p>`,
`<p><b>LAS VEGAS — Corvus Communications.</b> Corvus Group is sponsoring <i>Hands of the Night</i>, a Las Vegas community blood drive.</p>
<p>The drive runs every Friday <b>from 8 p.m. to 4 a.m.</b> in the annex of The Siren casino hotel. The group says the hours were set after sunset for night-shift workers and visitors who find it hard to make time during the day.</p>
<p>Every donor receives a pass to The Siren's night lounge. Blood is drawn by staff trained by the group itself. “I didn't even feel the needle,” one donor said. “Afterward I felt strangely calm.”</p>
<p>The group notes that donors with rare blood types or especially good samples <b>may be contacted again</b>. Most of these calls are made late at night.</p>
<p>“Blood saves lives. We know that better than anyone,” a group spokesperson said. “We will remember, for a long time, how precious one person's blood can be.”</p>`,
  ],
};
const NEWS_L = {
  ko: [
    ["보도자료", "코르부스 그룹, 2026 야간 경제 리포트 발간", "라스베이거스 야간 소비의 68%가 새벽 1시~4시에 발생한다는 분석. 그룹은 '밤은 더 이상 낮의 연장이 아니다'라고 밝혔다."],
    ["공지", "벨 에포크 지하층 리모델링 안내", "다운타운 카페 벨 에포크 지하층이 당분간 일반 손님에게 개방되지 않습니다."],
    ["보도자료", "제휴 제약사와 혈액 장기 보존 공동 연구 착수", "정제 혈액의 보관 기한을 획기적으로 늘리는 연구. 결과는 대외 비공개."],
    ["공지", "냉장 물류 C-7 노선 운행 시간 변경", "04:30 → 04:10. 일출 전 도착률 100% 유지를 위한 조정입니다."],
    ["사회공헌", "라스베이거스 헌혈 캠페인 '밤의 손길' 후원", "헌혈자 전원에게 더 세이렌 야간 라운지 이용권 제공. 채혈은 일몰 이후에만 진행됩니다."]],
  en: [
    ["Press Release", "Corvus Group Publishes 2026 Night Economy Report", "68% of night-time spending in Las Vegas happens between 1 and 4 a.m., the report finds. “The night is no longer an extension of the day,” the group said."],
    ["Notice", "Belle Époque Basement Renovation", "The basement level of Café Belle Époque downtown will be closed to the public for the time being."],
    ["Press Release", "Joint Research on Long-Term Blood Preservation Begins", "A study to dramatically extend the shelf life of refined blood. Results will not be disclosed."],
    ["Notice", "Schedule Change for Refrigerated Route C-7", "04:30 → 04:10, to keep our 100% pre-dawn arrival rate."],
    ["Community", "Sponsoring the “Hands of the Night” Blood Drive", "Every donor receives a pass to The Siren's night lounge. Blood is drawn only after sunset."]],
};

const UI = {
  ko: { quick: ["인재채용", "투자자 정보", "개인정보처리방침"], menu: ["회사 소개", "호스피탈리티", "바이오", "특수 물류", "인재채용", "뉴스룸", "투자자 정보"],
    none: "검색 결과가 없습니다.", noq: q => `'${q}'에 대한 검색 결과가 없습니다.`, dont: "……찾지 마십시오.", top: "↑ 맨 위로", more: "자세히 보기 →",
    biz: [["호텔 · 리조트 · 카페", "스트립의 카지노 호텔부터 다운타운의 부티크 카페까지. 24시간, 365일."], ["혈액 · 의약 공급망", "제휴 제약사와 함께 정제 혈액 제제의 안정적인 수급을 책임집니다."], ["야간 특수 물류", "냉장 컨테이너 기반 심야 배송 네트워크. 해가 뜨기 전에 도착합니다."]],
    contact: "문의: 코르부스 그룹 커뮤니케이션실 (야간 응대)",
    f: { h: "지원서 제출", sub: "추천 없이도 지원은 받습니다. 검토는 저희가 알아서 합니다.", n: "이름", e: "이메일", fl: "희망 분야", m: "하고 싶은 말", np: "홍길동", mp: "밤에 강합니다. 피도 잘 봅니다.", btn: "지원서 보내기", note: "※ 메시지가 어디로 갈지는 알 수 없습니다.",
      opts: ["호텔 · 카페 야간 서비스", "냉장 물류 운송 보조", "보안 · 현장 정리", "행정 · 디스패치"], done: "지원서가 접수되었습니다.", body: n => `${n} 님, 지원해 주셔서 감사합니다.<br>결과는 따로 안내하지 않습니다. <em>필요하면, 저희가 먼저 찾아갑니다.</em>`, hint: "이미 밤을 아는 분이라면, 입구는 첫 화면에 있습니다." } },
  en: { quick: ["Careers", "Investors", "Privacy Policy"], menu: ["About", "Hospitality", "Biotech", "Logistics", "Careers", "Newsroom", "Investors"],
    none: "No results found.", noq: q => `No results for “${q}”.`, dont: "……Stop looking.", top: "↑ Back to top", more: "Learn more →",
    biz: [["Hotels · Resorts · Cafés", "From casino hotels on the Strip to a boutique café downtown. 24 hours, 365 days."], ["Blood & Pharma Supply", "With partner pharmaceutical firms, we ensure a stable supply of refined blood products."], ["Night Specialty Logistics", "A refrigerated late-night delivery network. We arrive before sunrise."]],
    contact: "Inquiries: Corvus Group Communications (night desk)",
    f: { h: "Submit an Application", sub: "We accept applications without referral. We'll review them our own way.", n: "Name", e: "Email", fl: "Position", m: "Message", np: "Jane Doe", mp: "I'm good at night. I don't mind blood.", btn: "Send Application", note: "※ We cannot tell you where your message will go.",
      opts: ["Hotel & café night service", "Refrigerated logistics assistant", "Security & site cleanup", "Administration & dispatch"], done: "Your application has been received.", body: n => `Thank you for applying, ${n}.<br>We do not announce results. <em>If we need you, we will find you first.</em>`, hint: "If you already know the night, the entrance is on the first page." } },
};
const MENU_KEYS = ["about", "hospitality", "biotech", "logistics", "careers", "news", "investors"];
const MENU_EN = ["About", "Hospitality", "Biotech", "Logistics", "Careers", "Newsroom", "Investors"];
const LANG = () => UI[ST.lang] ? ST.lang : "ko";

function renderFront() {
  const L = LANG(), U = UI[L], P = PAGES_L[L];
  document.documentElement.lang = L;
  $$(".kc-lang [data-lang]").forEach(a => a.classList.toggle("on", a.dataset.lang === L));
  $$(".kc-quick a[data-page]").forEach((a, i) => a.textContent = U.quick[i]);
  $("#kcDrawer ul").innerHTML = MENU_KEYS.map((k, i) => `<li><a data-page="${k}">${U.menu[i]}${L === "en" ? "" : `<small>${MENU_EN[i]}</small>`}</a></li>`).join("");
  $$(".kc-biz > div").forEach((d, i) => { d.querySelector("h3").textContent = U.biz[i][0]; d.querySelector("p").textContent = U.biz[i][1]; d.querySelector(".more").textContent = U.more; });
  $("#kcNews").innerHTML = NEWS_L[L].map(([cat, t, p], i) => { const m = NEWS_META[i]; return `
    <article class="kc-nc ${m.big ? "big" : ""}" data-news="${i}">${m.img ? `<img src="${m.img}" alt="">` : ""}
      <div class="kc-nin"><span class="kc-cat">${cat}</span><h4>${t}</h4><p>${p}</p><span class="kc-d">${m.d}</span></div></article>`; }).join("");
  // 회사 소개 섹션들
  $("#corpPage").innerHTML = CORP_ORDER.map(key => {
    const [k, t, b] = P[key], img = PAGE_IMG[key];
    return `<section class="pg-sec" id="sec-${key}">
        <div class="pg-hero ${img ? "" : "noimg"}">${img ? `<img src="${img}" alt="">` : ""}
          <div class="pg-hero-in"><div class="mp-k">${k}</div><h2 class="pg-t">${t}</h2></div></div>
        <div class="pg-body"><div class="cp">${b}</div></div>
      </section>`;
  }).join("") + `<div class="pg-top"><a data-page="home">${U.top}</a></div>`;
  // 채용 지원서 폼 — 서버로 보내지 않고 이 브라우저에만 저장. 나중에 하우스 디바이스로 답장이 온다
  const F = U.f;
  $("#sec-careers .pg-body").insertAdjacentHTML("beforeend", `
    <form class="apply" id="applyForm" autocomplete="off">
      <h4>${F.h}</h4><p class="ap-sub">${F.sub}</p>
      <label><span>${F.n}</span><input name="n" maxlength="20" required placeholder="${F.np}"></label>
      <label><span>${F.e}</span><input name="e" type="email" maxlength="60" required placeholder="name@example.com"></label>
      <label><span>${F.fl}</span><select name="f">${F.opts.map((o, i) => `<option value="${i}">${o}</option>`).join("")}</select></label>
      <label><span>${F.m}</span><textarea name="m" maxlength="300" rows="4" required placeholder="${F.mp}"></textarea></label>
      <button class="ap-btn" type="submit">${F.btn}</button>
      <p class="ap-note">${F.note}</p>
    </form>
    <div class="ap-done" id="applyDone"></div>`);
  $("#applyForm").onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    ST.app = { n: f.n.value.trim(), fi: +f.f.value, m: f.m.value.trim(), at: NOW(), sent: false };
    save(); renderApply();
  };
  renderApply();
}
function renderApply() {
  if (!ST.app || !$("#applyForm")) return;
  const F = UI[LANG()].f;
  $("#applyForm").style.display = "none";
  $("#applyDone").innerHTML = `<b>${F.done}</b><p>${F.body(ST.app.n)}</p><p class="ap-hint">${F.hint}</p>`;
}
// 지원서를 낸 뒤 하우스 포털에 들어오면, 그 지원서를 읽은 사람들에게서 연락이 온다 (하우스 안은 한국어)
function deliverApply() {
  if (!ST.app || ST.app.sent) return;
  ST.app.sent = true; save();
  const a = ST.app, field = UI.ko.f.opts[a.fi] || a.f || "미기재", quote = a.m.length > 40 ? a.m.slice(0, 40) + "…" : a.m;
  setTimeout(() => pushMsg("jin", ["코르부스 채용 페이지로 지원서가 한 건 들어왔더군요.", `지원자 ${a.n}. 희망 분야 '${field}'.`, `"${quote}"`, "……이미 하우스 소속인 분이 왜 회사에 지원을 하십니까."]), 3000);
  setTimeout(() => pushMsg("anzi", ["흠. 지원서 봤어. 서기장이 회의 시간에 소리 내서 읽더라.", `"${quote}" 이거 크로니클에 실어도 돼?`]), 12000);
}
function setLang(l) { ST.lang = l; save(); renderFront(); $("#kcResult").textContent = ""; }

function corpPage(key) {
  closeDrawer();
  if (key === "home") { scrollTo({ top: 0, behavior: "smooth" }); return; }
  const el = $("#sec-" + key); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
// 다시 그려도 동작하도록 한곳에서 클릭을 받는다
document.addEventListener("click", e => {
  const lang = e.target.closest("[data-lang]"); if (lang) { setLang(lang.dataset.lang); return; }
  const pg = e.target.closest("#front [data-page]"); if (pg) { corpPage(pg.dataset.page); return; }
  const nw = e.target.closest("[data-news]");
  if (nw) { const L = LANG(), i = +nw.dataset.news, [cat, t] = NEWS_L[L][i], d = NEWS_META[i].d;
    modal(`<div class="mp-k">${cat} · ${d}</div><h3 class="mp-t">${t}</h3><div class="mp-art">${NEWS_BODY[L][i]}</div><p class="mp-contact">${UI[L].contact}</p>`, "corp news"); }
});

// 왼쪽 서랍 메뉴
const openDrawer = () => { $("#kcDrawer").classList.add("on"); $("#kcDim").classList.add("on"); };
function closeDrawer() { $("#kcDrawer").classList.remove("on"); $("#kcDim").classList.remove("on"); }
$("#kcBurger").onclick = openDrawer; $("#kcX").onclick = closeDrawer; $("#kcDim").onclick = closeDrawer;

// 스크롤하면 상단 바가 진해지고 가운데에 작은 로고가 나타난다
addEventListener("scroll", () => { if ($("#front").classList.contains("on")) $("#front").classList.toggle("scrolled", scrollY > 120); }, { passive: true });
$("#kcSBtn").onclick = () => { scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => $("#kcQ").focus(), 400); };
// ↓ 버튼: 다음 섹션으로
$("#kcNext").onclick = () => {
  const secs = [$("#sec-news"), ...$$(".pg-sec")], y = scrollY + 90;
  const nx = secs.find(s => s.getBoundingClientRect().top + scrollY > y + 5);
  if (nx) nx.scrollIntoView({ behavior: "smooth", block: "start" });
};

// 검색 — 회사 이야기는 찾아 주고, 찾으면 안 되는 단어는 조용히 지운다
const SEARCH = [[/호텔|카지노|세이렌|카페|벨|리조트|hotel|casino|siren|cafe|café|resort/i, "hospitality"], [/혈액|피|제약|바이오|blood|bio|pharma/i, "biotech"], [/물류|트럭|배송|노선|logistic|truck|delivery|route/i, "logistics"],
  [/채용|지원|입사|career|job|hiring|apply/i, "careers"], [/회사|소개|역사|about|history|company/i, "about"], [/투자|주주|\bir\b|investor|shareholder/i, "investors"], [/개인정보|privacy/i, "privacy"], [/뉴스|공지|news|notice|press/i, "news"]];
const FORBID = /알터|alter|뱀파이어|vampire|하우스|house|언더럭스|underlux|포식자|predator|오염체|흡혈/i;
$("#kcSearch").onsubmit = e => {
  e.preventDefault();
  const q = $("#kcQ").value.trim(), out = $("#kcResult"), U = UI[LANG()];
  if (!q) return;
  if (FORBID.test(q)) {
    out.className = "kc-result warn"; out.textContent = U.none;
    setTimeout(() => { out.textContent = U.dont; glitch(); }, 1200);
    setTimeout(() => { out.className = "kc-result"; out.textContent = U.none; $("#kcQ").value = ""; }, 2600);
    return;
  }
  const hit = SEARCH.find(([re]) => re.test(q));
  if (hit) { out.className = "kc-result"; out.textContent = ""; corpPage(hit[1]); }
  else { out.className = "kc-result"; out.textContent = U.noq(q); }
};
renderFront();

/* ===================================================================
   언더럭스 — 비밀 루트
   =================================================================== */
const BOARD_POOL = [
  { who: "@bellhop", t: "[잡담] 신입이 오늘 출근했대", p: "벨 에포크 앞치마 끈 앞으로 묶었다던데 ㅋㅋ 사장님이 웃으면서 다시 묶어 줬대.", cm: [["@nightjar", "그 사장님이 웃었으면 괜찮은 거임"], ["@static", "아니 그게 더 무서운데"]] },
  { who: "@watcher", t: "[경고] 은탄 재고 도는 중", p: "인간 쪽 장비상에서 은 코팅 탄 대량 출고. 이번 주 혼자 다니지 마.", cm: [["@gearhead", "출처 아는 사람?"], ["@watcher", "알면 이미 말했지"]] },
  { who: "@static", t: "[질문] 크로니클 이번 호 봤냐", p: "1면에 냉장 트럭 사진 실렸던데. 이거 하우스가 그냥 둬?", cm: [["@nightjar", "안지가 실었으면 이유가 있겠지"], ["@bellhop", "서기장 펜 또 부러졌대"]] },
  { who: "@ironmoth", t: "[판매] 텀블러 2차 물량", p: "혈액팩 위장 텀블러 다시 들어옴. 체온 유지형. 이번엔 색 세 가지.", cm: [["@drape", "검정 있음?"], ["@ironmoth", "검정만 있음"]] },
  { who: "@nightjar", t: "[잡담] 마키아 봤다는 사람", p: "지하 3층 복도에서 스쳤는데 말 한마디 안 함. 근데 내 이름 알고 있었음.", cm: [["@static", "그분은 다 앎"], ["@watcher", "……그 얘긴 여기서 하지 말자"]] },
  { who: "@gearhead", t: "[후기] 이어피스 써 봄", p: "맥박 소리 진짜 줄어듦. 버스 탈 수 있게 됨. 신입들한테 추천.", cm: [["@bellhop", "신입 들었냐 이거 사라"]] },
];
const NOISE_LOCAL = typeof NOISE !== "undefined" ? NOISE : [];
// 노이즈 필터에 새로 들어오는 제보 (시간이 지나며 하나씩)
const NOISE_POOL = [
  { who: "📰 제보", h: "♥ 37", t: "새벽 3시 헌혈 버스, 줄 선 사람이 없는데 불이 켜져 있음", p: "더 세이렌 별관 앞. 문 닫혀 있는데 안에서 사람 그림자 셋. 아침엔 버스가 없어짐.",
    cm: [["익명", "그 캠페인 금요일만 한다며?"], ["익명", "오늘 화요일인데"]], risk: ["주의", "risk-m", "반복 목격 · 장소 특정됨"] },
  { who: "📰 제보", h: "♥ 89", t: "프리몬트 모텔 객실 창문이 전부 은박지", p: "2층 끝방 세 개가 창문을 은박지로 막아 둠. 낮에 노크해도 대답 없고 밤 11시에만 불 켜짐.",
    cm: [["익명", "마약 제조 아님?"], ["익명", "경찰 불렀는데 아무도 안 나왔대"]], risk: ["주의", "risk-m", "주민 신고 1건"] },
  { who: "📰 제보", h: "♥ 15", t: "벨 에포크 알바생 손이 차갑지 않았다는 후기", p: "커피 받을 때 손 닿았는데 그냥 따뜻했음. 창백해 보여서 기대했는데 ㅋㅋ 그냥 피곤한 사람인 듯.",
    cm: [["익명", "뭘 기대한 건데"], ["익명", "이 게시판 사람들 상상력 무엇"]], risk: ["낮음", "risk-l", "오히려 의심 해소"] },
  { who: "📰 제보", h: "♥ 142", t: "LVMPD 야간 형사 한 명, 현장마다 혼자 먼저 와 있음", p: "최근 석 달 프리몬트 쪽 사건 다섯 건. 전부 같은 형사가 순찰차보다 먼저 도착. 동료들도 이상하다고 함.",
    cm: [["익명", "그냥 일 잘하는 거 아님?"], ["익명", "새벽 3시에 매번?"]], risk: ["위험", "risk-h", "경찰 내부 소문 · 이름 거론 시도"] },
  { who: "📰 제보", h: "♥ 64", t: "다운타운 철교 밑 개 짖는 소리, 그런데 개가 없음", p: "새벽마다 뭔가 긁는 소리랑 낮은 울음. 노숙인들이 그 구간을 피해서 잠.",
    cm: [["익명", "코요테겠지"], ["익명", "코요테가 형광 조끼를 물고 다니냐"]], risk: ["주의", "risk-m", "물증 1점 · 사진 없음"] },
  { who: "📰 제보", h: "♥ 23", t: "카지노 VIP룸 웨이터가 10년째 얼굴이 똑같다", p: "아빠가 2015년에 찍은 사진에 나온 웨이터랑 어제 본 사람이 똑같음. 쌍둥이일 수도.",
    cm: [["익명", "피부 관리 비법 공유 좀"], ["익명", "사진 올려 봐"]], risk: ["주의", "risk-m", "사진 대조 시도 · 확산 중"] },
  { who: "📰 제보", h: "♥ 51", t: "혈액원 폐기 기록이 한 달에 두 번씩 비어 있음", p: "의료 행정 일하는 친구 말로는, 폐기 예정 팩 수량이 장부랑 안 맞는 날이 꼭 있대. 늘 같은 요일.",
    cm: [["익명", "그냥 행정 실수"], ["익명", "같은 요일이면 실수가 아니지"]], risk: ["위험", "risk-h", "내부자 발언 · 기록 존재"] },
  { who: "📰 제보", h: "♥ 9", t: "스트립에서 송곳니 코스프레한 사람 봄", p: "할로윈도 아닌데 ㅋㅋ 진짜 뱀파이어면 저렇게 티 안 내겠지.",
    cm: [["익명", "맞음 진짜는 송곳니도 없을걸"], ["익명", "↑ 너 뭐 아냐?"]], risk: ["낮음", "risk-l", "농담 · 댓글 하나만 주의"] },
];
function noisePosts() { return [...(ST.extraNoise || []).map(i => ({ ...NOISE_POOL[i], fresh: true })), ...NOISE_LOCAL]; }
function addNoise() {
  ST.extraNoise = ST.extraNoise || [];
  const left = NOISE_POOL.map((_, i) => i).filter(i => !ST.extraNoise.includes(i));
  if (!left.length) return false;
  ST.extraNoise.unshift(left[rand(0, left.length - 1)]); save(); renderUX();
  return true;
}
const escH = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const myH = () => "@" + (ST.name || "신입");
const CM_DRAFT = {};
function boardPosts() { return [...ST.extraPosts.map(i => ({ ...BOARD_POOL[i], fresh: true })), ...BOARD]; }
function renderUX() {
  const left = Math.max(0, Math.ceil((ST.mk.at - NOW()) / 1000));
  if ($("#mkTimer")) $("#mkTimer").textContent = `다음 매물 교체까지 ${Math.floor(left / 60)}분 ${left % 60}초 · 잔액 ${ST.cr} CR`;
  $("#mkList").innerHTML = MK().map((m, i) => {
    const got = ST.mk.got.includes(m.id), lim = m.id === ST.mk.lim && m.id !== "pack";
    return `
    <div class="win mk ${lim ? "lim" : ""} ${got ? "got" : ""}"><span class="no">${"①②③④⑤⑥"[i]}</span>
      <div><div class="cat">${lim ? "⏳ 한정 · " : ""}${m.cat}</div><h4>${m.t}</h4><div class="sel">${m.who}</div></div>
      <span class="pr">${m.pr} CR</span>${FX[m.id] && FX[m.id].perm && ST.perm[m.id] ? `<span class="res">보유 중</span>`
        : FX[m.id] && hasFx(m.id) ? `<span class="res">대여 중 · ${fxLeft(m.id)}분</span>`
        : got && !m.repeat ? `<span class="res">구매함</span>` : `<button class="btn sm" data-buy="${m.id}">구매</button>`}</div>`;
  }).join("");
  $$("[data-buy]").forEach(b => b.onclick = () => buy(b.dataset.buy));
  const when = at => at ? new Date(at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  // 다시 그려도 쓰던 댓글과 커서는 그대로
  const af = document.activeElement, fk = af && af.closest && af.closest(".cm-form") ? af.closest(".cm-form").dataset.cmk : null, fs = fk ? af.selectionStart : 0;
  const post = (x, k, noise) => {
    const lk = parseInt(String(x.h || "♥ 3").replace(/\D/g, "")) + (ST.likes[k] || 0) + ((ST.bump || {})[k] || 0);
    const cms = noise ? x.cm : [...x.cm, ...((ST.liveCm || {})[k] || [])];
    const my = !noise && (ST.myCm || {})[k], ok = noise && (ST.noiseOk || {})[k];
    return `
    <div class="win post ${x.fresh ? "fresh" : ""} ${ok ? "checked" : ""}" data-k="${escH(k)}"><div class="ph"><b>${x.who}</b>${x.fresh ? '<em class="newp">NEW</em>' : ""}<button class="lk" data-like="${escH(k)}">♥ ${lk}</button></div>
      <h4>${x.t}</h4><p>${x.p}</p>
      <div class="cm">${cms.map(([w, t]) => `<div><b>${w}</b>${t}</div>`).join("")}</div>
      ${noise ? "" : my ? `<div class="cm-my"><div class="cm-mine"><b>${escH(myH())}</b>${escH(my.t)}<small>${when(my.at)}</small><button class="cm-x" data-uncm="${escH(k)}" title="지우고 다시 쓰기">✕</button></div>${(my.re || []).map(([w, t]) => `<div class="cm-re"><b>${w}</b>${t}</div>`).join("")}</div>`
        : `<form class="cm-form" data-cmk="${escH(k)}"><input maxlength="80" placeholder="댓글 하나 남기기 (글마다 1개)" value="${escH(CM_DRAFT[k] || "")}"><button class="btn sm">등록</button></form>`}
      ${noise ? `<div class="risk"><span>⚠ 노출 위험｜<b class="${x.risk[1]}">${x.risk[0]}</b> (${x.risk[2]})</span><button class="nz-ok ${ok ? "on" : ""}" data-nzok="${escH(k)}">${ok ? `✓ 확인함 · ${when(ok)}` : "□ 위험 확인"}</button></div>` : ""}</div>`;
  };
  $("#board").innerHTML = `<p class="bd-live"><i></i>LIVE · 지금 <b id="bdOn">${$("#bdOn") ? $("#bdOn").textContent : rand(14, 26)}</b>명 보는 중</p>` + boardPosts().map((x, i) => post(x, "b" + x.t)).join("");
  const nz = noisePosts(), nzN = nz.filter(x => (ST.noiseOk || {})["n" + x.t]).length;
  $("#noise").innerHTML = `<p class="nz-count">위험 확인 <b>${nzN}</b> / ${nz.length}${nzN === nz.length ? " · 전부 확인함" : ""}</p>` + nz.map(x => post(x, "n" + x.t, true)).join("");
  $$(".cm-form").forEach(f => {
    const k = f.dataset.cmk, i = f.querySelector("input");
    i.oninput = () => { CM_DRAFT[k] = i.value; };
    f.onsubmit = e => {
      e.preventDefault(); const t = i.value.trim(); if (!t) return;
      (ST.myCm = ST.myCm || {})[k] = { t, at: NOW(), re: [] }; delete CM_DRAFT[k]; save(); renderUX(); cmReact(k);
    };
    if (k === fk) { i.focus(); try { i.setSelectionRange(fs, fs); } catch {} }
  });
  $$("[data-uncm]").forEach(b => b.onclick = () => { delete ST.myCm[b.dataset.uncm]; save(); renderUX(); });
  $$("[data-nzok]").forEach(b => b.onclick = () => {
    const k = b.dataset.nzok; ST.noiseOk = ST.noiseOk || {};
    if (ST.noiseOk[k]) delete ST.noiseOk[k]; else ST.noiseOk[k] = NOW();
    save(); renderUX();
  });
  // 산 정보 + 산 물건(같은 물건은 한 줄, 개수만 늘어남)을 최근 순으로
  const goods = MK_POOL.filter(m => !m.info && ST.bought[m.id]).map(m => {
    const F = FX[m.id], st = m.id === "pack" ? `남은 팩 ${ST.pack}개` : F && F.perm ? (ST.perm[m.id] ? "설치됨" : "") : F && F.rent ? (hasFx(m.id) ? `대여 중 · ${fxLeft(m.id)}분 남음` : "반납됨") : "";
    return { at: (ST.boughtAt || {})[m.id] || 0, html: `
    <div class="win post goods"><div class="ph"><b>${m.who}</b><span>${when((ST.boughtAt || {})[m.id])}</span></div>
      <h4>${m.t}<em class="cnt">× ${ST.bought[m.id]}</em></h4><p class="rc-info"><span class="cat">${m.cat}</span>${st ? ` · ${st}` : ""}</p></div>` };
  });
  const infos = ST.intel.map(x => ({ at: x.at, html: `
    <div class="win post"><div class="ph"><b>${x.who}</b><span>${when(x.at)}</span></div>
      <h4>${x.t}</h4><p class="rc-info">${x.info}</p></div>` }));
  const all = [...goods, ...infos].sort((a, b) => b.at - a.at);
  $("#intelList").innerHTML = all.length ? all.map(x => x.html).join("") : `<p class="noise-head">아직 산 것이 없습니다. 매물 탭에서 사면 여기 쌓입니다.</p>`;
  $$("[data-like]").forEach(b => b.onclick = () => { const k = b.dataset.like; ST.likes[k] = (ST.likes[k] || 0) ? 0 : 1; save(); renderUX(); });
}
/* 게시판 실시간 — 게시판을 보고 있으면 댓글이 하나씩 달리고 공감 수가 오른다 (달린 댓글은 저장) */
const LIVE_WHO = ["@bellhop", "@static", "@nightjar", "@watcher", "@gearhead", "@drape", "@ironmoth", "@velvet", "@ash_", "@gravelot"];
const LIVE_ANY = ["ㄹㅇ", "↑ 이거 맞음", "출처는?", "나도 들었음", "그건 루머임", "이 글 서기장이 볼까 봐 무서움", "조용히 해. 이 채널 로그 남는다", "삭제 각",
  "방금 디스패치실 지나왔는데 다들 이 얘기 중", "크로니클에 나오겠다 이거", "신입 이거 보고 있냐", "ㅋㅋㅋ 아니 이건 좀", "추천 누르고 감", "아 이 동네 오늘 왜 이래"];
const LIVE_BY = {
  "신입 들어왔다며": ["향 얘기 그만해 배고파진다", "벨 에포크 오늘 줄 섰더라 ㅋㅋ 구경 온 놈들", "루안이 공지 캡처해 갔다는 말이 있음"],
  "프리몬트 쪽 사냥꾼 흔적": ["방금 그쪽 지나왔는데 경찰차 한 대 서 있음", "형사 하나가 혼자 탄피 줍고 있더라", "오늘은 다들 큰길로 다니자"],
  "거처 암막 시공 끝": ["어디 업체임?", "암막 해도 오후 3시 빛은 새던데", "낮잠 된다는 말에 바로 결제함"],
  "폭주 개체 한 달 넘기면": ["……이 글 아직 안 지웠냐", "기억 비는 거 진짜임. 내 동기가 그랬어", "신입 앞에선 하지 말자니까"],
  "루안 디바이스 또 꺼져 있음": ["방금 켜졌다가 다시 꺼짐 ㅋㅋ", "S등급은 퇴근도 S급", "디스패치 네 번째 호출 들어감"],
  "신입이 오늘 출근했대": ["앞치마 끈 ㅋㅋㅋㅋ", "사장님 웃는 거 봤으면 오늘 운 좋은 거임", "카페 앞에 기자 하나 어슬렁거림. 안지 아님?"],
  "은탄 재고 도는 중": ["가격도 내려갔대. 더 무서움", "이번 주는 무조건 둘이 다니자", "@watcher 형 덕에 산다"],
  "크로니클 이번 호 봤냐": ["사진 찍힌 거 C-7 트럭 맞음", "하우스가 안 막은 게 더 이상함", "안지는 다 계산하고 실음"],
  "텀블러 2차 물량": ["검정만이면 의미 없잖아", "체온 유지 진짜 됨? 식으면 맛 없는데", "지난번 거 뚜껑 샜음"],
  "마키아 봤다는 사람": ["……", "이 글 곧 사라질 듯", "나도 스친 적 있음. 그날 밤 잠 못 잠"],
  "이어피스 써 봄": ["신입 이거 진짜 사라", "버스 탈 수 있게 됐다는 말에 울컥함", "대여로 먼저 써 봐. 매물 탭에 있음"],
};
function boardLive() {
  const ok = $("#ux").classList.contains("on") && $("#ux-board").classList.contains("on");
  setTimeout(boardLive, rand(7, 15) * 1000);
  if (!ok) return;
  const on = $("#bdOn"); if (on) on.textContent = Math.max(9, Math.min(48, +on.textContent + rand(-2, 3)));
  const posts = $$("#board .post");
  if (!posts.length) return;
  const el = posts[Math.min(posts.length - 1, Math.random() < .55 ? rand(0, 1) : rand(0, posts.length - 1))], k = el.dataset.k;
  ST.liveCm = ST.liveCm || {}; ST.bump = ST.bump || {};
  // 공감만 오를 때도 있다
  if (Math.random() < .35) { ST.bump[k] = (ST.bump[k] || 0) + 1; save(); const b = el.querySelector(".lk"); if (b) { b.textContent = b.textContent.replace(/\d+/, n => +n + 1); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } return; }
  const mine = ST.liveCm[k] = ST.liveCm[k] || [];
  if (mine.length >= 4) return;
  const title = Object.keys(LIVE_BY).find(t => k.includes(t));
  const said = new Set(mine.map(m => m[1]));
  const pool = [...(title ? LIVE_BY[title] : []), ...(title ? LIVE_BY[title] : []), ...LIVE_ANY].filter(t => !said.has(t));
  if (!pool.length) return;
  const line = pick(pool), who = pick(LIVE_WHO), cm = el.querySelector(".cm");
  const ty = document.createElement("div"); ty.className = "cm-typing"; ty.innerHTML = `<b>${who}</b>입력 중…`; cm.appendChild(ty);
  setTimeout(() => {
    ty.remove(); if (mine.some(m => m[1] === line) || mine.length >= 4) return;
    mine.push([who, line]); save();
    const d = document.createElement("div"); d.className = "cm-new"; d.innerHTML = `<b>${who}</b>${line}<small>방금</small>`; cm.appendChild(d);
  }, rand(1400, 2600));
}
setTimeout(boardLive, 5000);
/* 내 댓글 — 글마다 하나. 달면 다른 사람이 한두 개 반응한다 (반응도 저장) */
const RE_ANY = ["↑ 신입 냄새 나는데 ㅋㅋ", "ㄹㅇ 동의", "그건 아닌 듯", "말 조심해. 이 채널 로그 남는다", "누구냐 너", "ㅋㅋㅋ 이 사람 웃기네", "신입이면 매물 탭부터 봐", "공감 누르고 감", "처음 보는 아이디인데"];
const RE_KEY = [
  [/\?|？|뭐|왜|어떻게|진짜/, ["그건 아무도 모름", "나도 그게 궁금했음", "물어보는 거 보니 신입이네"]],
  [/루안/, ["루안 얘기는 디스패치가 싫어함 ㅋㅋ", "그 사람 또 디바이스 껐겠지"]],
  [/마키아/, ["……그 이름은 쓰지 말자", "이 댓글 곧 사라질 듯"]],
  [/안지|크로니클|기자/, ["안지가 이 댓글 캡처했을걸"]],
  [/서기장|배정|등급/, ["서기장 펜 부러지는 소리 남", "등급 얘기는 신입한테 아픈 데임"]],
  [/배고|갈증|향|팩|피/, ["향 얘기 하지 마 배고파진다", "팩 남았으면 하나 먹고 와"]],
  [/ㅋ|ㅎ/, ["ㅋㅋㅋㅋ", "웃을 때가 아님 ㅋㅋ"]],
];
function cmReact(k) { let d = 0; for (let i = 0, n = Math.random() < .45 ? 2 : 1; i < n; i++) { d += rand(2500, 5000); setTimeout(() => reactOne(k), d); } }
function reactOne(k) {
  const my = (ST.myCm || {})[k]; if (!my || my.re.length >= 2) return;
  const hit = RE_KEY.filter(([re]) => re.test(my.t)).flatMap(x => x[1]), said = new Set(my.re.map(r => r[1]));
  const pool = [...hit, ...hit, ...RE_ANY].filter(t => !said.has(t)), whoP = LIVE_WHO.filter(w => !my.re.some(r => r[0] === w));
  const line = pick(pool), who = pick(whoP);
  const box = () => { const el = $$("#board .post").find(p => p.dataset.k === k); return el && el.querySelector(".cm-my"); };
  const ty = document.createElement("div"); ty.className = "cm-typing"; ty.innerHTML = `<b>${who}</b>입력 중…`;
  if (box()) box().appendChild(ty);
  setTimeout(() => {
    ty.remove(); if ((ST.myCm || {})[k] !== my) return;
    my.re.push([who, line]); save();
    const b = box(); if (!b) return;
    const d = document.createElement("div"); d.className = "cm-re cm-new"; d.innerHTML = `<b>${who}</b>${line}<small>방금</small>`; b.appendChild(d);
  }, rand(1400, 2400));
}
function buy(id) {
  const m = MK_POOL.find(x => x.id === id), pack = id === "pack";
  if (ST.cr < m.pr) { toast(`잔액 부족 · 보유 ${ST.cr} CR / 필요 ${m.pr} CR · 디스패치 임무로 벌 수 있어요`); return; }
  ST.cr -= m.pr; ST.bought[id] = (ST.bought[id] || 0) + 1; (ST.boughtAt = ST.boughtAt || {})[id] = NOW();
  if (!ST.mk.got.includes(id)) ST.mk.got.push(id);
  if (pack) ST.pack += 2;
  const F = FX[id];
  if (F && F.rent) ST.eff[id] = Math.max(NOW(), ST.eff[id] || 0) + F.rent * 60000;
  if (F && F.perm) ST.perm[id] = true;
  if (m.info) ST.intel.unshift({ id, t: m.t, info: m.info, who: m.who, at: NOW() });
  if (id === "gun") { // 특수 임무를 대여 기간 동안 연다
    const k = MISSION_POOL.findIndex(x => x.special), sp = MISSION_POOL[k];
    ST.ms = ST.ms.filter(x => !(x.k === k && x.s === "open"));
    ST.ms.unshift({ id: NOW() + "g", k, pay: Math.round(rand(sp.pay[0], sp.pay[1]) / 10) * 10, s: "open", exp: ST.eff.gun });
    markDispatch(true);
  }
  const REACT = { case: ["jin", ["……위치 신호가 이상하네요.", "기기 점검 받으세요. 이번 주 안에."], 20000], pane: ["ruan", ["방음 공사? 뭘 숨기려고."], 8000],
    curt: ["rainer", ["커튼 달았다면서요.", "이제 낮잠 자도 되겠네. 출근은 늦지 말고."], 8000], gun: ["minos", ["그거 어디서 났어.", "……추적 건 끝나면 바로 반납해. 내가 확인한다."], 6000] };
  if (REACT[id]) { const [who, lines, ms] = REACT[id]; setTimeout(() => pushMsg(who, lines), ms); }
  save(); renderMe(); renderUX(); glitch();
  const no = "UX-" + String(NOW()).slice(-6);
  modal(`
    <div class="rc-top"><span>UNDERLUX · TRANSACTION</span><span class="ok">● COMPLETE</span></div>
    <div class="rc-big">PURCHASE<br>COMPLETE</div>
    <dl class="rc">
      <dt>거래번호</dt><dd>${no}</dd>
      <dt>품목</dt><dd>${m.t}</dd>
      <dt>판매자</dt><dd>${m.who}</dd>
      <dt>결제</dt><dd class="r">−${m.pr} CR</dd>
      <dt>잔액</dt><dd>${ST.cr} CR</dd>
      <dt>수령</dt><dd>${pack ? "거처 냉장 보관함 · 즉시 사용 가능" : m.info ? "정보 · 「구매한 정보」 탭에 보관" : F && F.rent ? `대여 · 지금부터 ${F.rent}분 (${F.label})` : F && F.perm ? "거처 시공·배송 · 즉시 적용" : "직거래 · 아래 암호 확인"}</dd>
    </dl>
    ${F ? `<p class="rc-fx">효과 · ${F.fx}</p>` : ""}
    ${m.info ? `<p class="rc-info">${m.info}</p>` : pack || F ? "" : `<p class="rc-meet">📍 벨 지하, 셋째 밤 02시. 늦으면 없다.</p>`}
    <p class="rc-note">${pack ? "대시보드의 「혈액팩 사용」 버튼으로 마실 수 있습니다." : "이 거래 기록은 하우스가 열람할 수 있습니다."}</p>`, "receipt");
  if (!ST.once.firstBuy) { ST.once.firstBuy = true; save(); setTimeout(() => pushMsg("anzi", ["흠. 첫 구매가 그거야?", "나쁘지 않네. 판매자 닉네임은 외워 둬."]), 5000); }
  else if (m.cat === "기밀" && !ST.once.secretBuy) { ST.once.secretBuy = true; save(); setTimeout(() => pushMsg("maquia", ["……샀군.", "그 정보, 누가 팔게 뒀는지부터 생각해라."]), 7000); }
}
// 매물 교체 시계 (보고 있지 않을 때 바뀌면 조용히)
setInterval(() => {
  Object.keys(ST.eff).forEach(id => { if (ST.eff[id] && ST.eff[id] <= NOW()) {
    delete ST.eff[id]; save(); renderMe(); if ($("#ux").classList.contains("on")) renderUX();
    if ($("#portal").classList.contains("on") || $("#ux").classList.contains("on")) toast(`대여 기간 만료 · ${FX[id].name}`);
  } });
  if (NOW() >= ST.mk.at) rotateMarket(!($("#ux").classList.contains("on") || $("#portal").classList.contains("on")));
  else if ($("#ux").classList.contains("on") && $("#mkTimer")) { const left = Math.max(0, Math.ceil((ST.mk.at - NOW()) / 1000)); $("#mkTimer").textContent = `다음 매물 교체까지 ${Math.floor(left / 60)}분 ${left % 60}초 · 잔액 ${ST.cr} CR`; }
}, 1000);
$$(".ux-nav button").forEach(b => b.onclick = () => {
  $$(".ux-nav button").forEach(x => x.classList.toggle("on", x === b));
  $$(".uxtab").forEach(x => x.classList.toggle("on", x.id === "ux-" + b.dataset.ux));
});
// 언더럭스 접속 연출: 지직거리는 화면 → 로그 → 복호화 바 → 화면이 꺼지듯 사라짐
async function uxBoot() {
  // 지직거리는 화면에 인사 한 줄만, 약 0.9초
  const box = $("#uxboot");
  box.className = "uxboot on";
  await new Promise(r => setTimeout(r, 850));
  glitch(); box.classList.add("out");
  setTimeout(() => { box.className = "uxboot"; toast("암호 채널 접속 · UNDERLUX"); }, 350);
}
function enterUX() {
  if ($("#ux").classList.contains("on")) return;
  glitch(); BGM.setMode("ux");
  setTimeout(() => { show("ux"); renderUX(); uxBoot(); }, 150);
  if (!ST.once.uxIn) { ST.once.uxIn = true; save(); setTimeout(() => pushMsg("anzi", ["흠. 들어갔네.", "거기서 본 건 거기 두고 와. 다들 그렇게 살아."]), 9000); }
}
$("#uxOut").onclick = () => { glitch(); BGM.setMode("house"); setTimeout(() => show("portal"), 300); };
let verClicks = 0, verT;
$("#ver").onclick = () => {
  verClicks++; clearTimeout(verT); verT = setTimeout(() => verClicks = 0, 1500);
  if (verClicks >= 3) { verClicks = 0; enterUX(); }
};
let keys = "";
addEventListener("keydown", e => {
  if (!$("#portal").classList.contains("on") || e.target.tagName === "INPUT") return;
  keys = (keys + e.key.toLowerCase()).slice(-8);
  if (keys === "underlux") enterUX();
});

/* ===================================================================
   실제로 운영되는 것처럼 — 무작위 이벤트
   =================================================================== */
function randomEvent() {
  if (!$("#portal").classList.contains("on") && !$("#ux").classList.contains("on")) return;
  const r = Math.random();
  // 먼저 오는 메시지는 쉬는 시간이 안 지났으면 건너뛰고, 대신 디바이스 상태만 바뀐다
  if (r < .3) { if (!ambient()) shiftDevice(); }
  else if (r < .55) {
    const left = BOARD_POOL.map((_, i) => i).filter(i => !ST.extraPosts.includes(i));
    if (left.length) { ST.extraPosts.unshift(left[rand(0, left.length - 1)]); save(); renderUX(); if ($("#ux").classList.contains("on")) toast("게시판에 새 글이 올라왔습니다."); }
    else shiftDevice();
  } else if (r < .68) { if (addNoise()) { if ($("#ux").classList.contains("on")) toast("NOISE FILTER · 새 제보가 들어왔습니다."); } else shiftDevice(); }
  else if (r < .85) shiftDevice();
  else { const n = NOTICE_POOL[rand(0, NOTICE_POOL.length - 1)]; addNotice(n); toast(`[하우스 공지] ${n[2].slice(0, 26)}…`); }
}
(function loop() { setTimeout(() => { randomEvent(); loop(); }, rand(35, 70) * 1000); })();

/* ===================================================================
   진입 흐름 — 다시 들어오면 자리를 비운 사이의 일이 쌓여 있다
   =================================================================== */
function welcomeBack() {
  const gone = NOW() - ST.last;
  ST.visits++;
  if (ST.visits > 1 && gone > 3 * 60000) {
    let up = Math.min(30, Math.floor(gone / 600000) + 2); if (hasFx("curt")) up = Math.max(1, Math.round(up * .6));
    setTH(ST.th + up, true);
    // 자리를 비운 사이 온 메시지: 쉬는 시간과 상관없이, 안 쓴 말 중에서만 (다 썼으면 0건)
    let n = 0; const want = Math.min(3, 1 + Math.floor(gone / 1800000));
    for (let i = 0; i < want; i++) if (ambient(true, true)) n++;
    const left = BOARD_POOL.map((_, i) => i).filter(i => !ST.extraPosts.includes(i));
    if (left.length) ST.extraPosts.unshift(left[rand(0, left.length - 1)]);
    addNoise();
    addNotice(NOTICE_POOL[rand(0, NOTICE_POOL.length - 1)]);
    shiftDevice();
    setTimeout(() => toast(`자리를 비운 사이 · 갈증도 +${up} · 새 메시지 ${n}건`, 4200), 1300);
  } else setTimeout(() => toast(`새 메시지 ${ORDER.filter(id => CHAT[id].unread).length}건 · 메시지 탭을 확인하세요.`), 1200);
  ST.last = NOW(); save();
  deliverApply();
}
// 직원 포털 입구: 바닥글 링크 · 'night' 글자
$("#toGate").onclick = $("#toGate2").onclick = e => { e.stopPropagation(); BGM.setMode("house"); show("gate"); };
// 공개 사이트에서 처음 무언가를 누르면 로비 음악이 깔린다 (끄면 다시 자동으로 켜지지 않음)
let bgmUserOff = false;
$$("[data-bgm]").forEach(b => b.onclick = e => { e.stopPropagation(); if (BGM.on) bgmUserOff = true; BGM.toggle(); });
// 폰은 스와이프(스크롤)를 '누름'으로 치지 않아 소리를 켤 수 없다. 화면 아무 데나 톡 치면(touchend) 켜지게 한다
const frontBgm = e => {
  if (e.target.closest("[data-bgm], #toGate, #toGate2")) return; // BGM 버튼·포털 입구는 각자 처리
  if (!BGM.on && !bgmUserOff && $("#front").classList.contains("on")) { BGM.setMode("corp"); BGM.start(); }
};
["click", "touchend"].forEach(ev => $("#front").addEventListener(ev, frontBgm, { passive: true }));
if (ST.name) $("#pname").value = ST.name;
$("#sync").onclick = async () => {
  const btn = $("#sync"); btn.disabled = true;
  ST.name = $("#pname").value.trim(); save();
  BGM.setMode("house"); BGM.start();
  const log = $("#bootlog"), lines = [
    "> 손목 디바이스 신호 탐색 …… OK",
    "> 개체 식별: 신입 알터 · F등급",
    `> 이름: ${ST.name || "미배정"}`,
    "> 소속: 라스베이거스 지부",
    "> 생체 신호 동기화 ……",
    `<r>> 갈증도 TH° ${ST.th}% — ${thStage(ST.th)[0]} 구간</r>`,
    "> 하우스 네트워크 접속 승인.",
  ];
  log.innerHTML = ""; $("#bootScreen").classList.add("on");
  const bar = $("#bootBar"), pct = $("#bootPct");
  for (let i = 0; i < lines.length; i++) {
    await new Promise(r => setTimeout(r, 380));
    log.innerHTML += lines[i].replace("<r>", '<span class="r">').replace("</r>", "</span>") + "\n";
    const v = Math.round((i + 1) / lines.length * 100); bar.style.width = v + "%"; pct.textContent = v + "%";
  }
  await new Promise(r => setTimeout(r, 500));
  glitch(); $("#gate").classList.add("out");
  await new Promise(r => setTimeout(r, 500));
  $("#gate").classList.remove("out"); btn.disabled = false;
  show("portal"); renderMe(); welcomeBack();
};
// 초기화: 포털 바닥글 왼쪽 글자를 더블클릭하면 처음부터
$(".pt-foot span").ondblclick = () => { if (confirm("이 브라우저의 진행 상황을 지우고 처음부터 시작할까요?")) { store.set("state", "{}"); location.reload(); } };

tick(); setInterval(tick, 30000);
renderMe(); renderNotices(); renderDevices(); renderDispatch(); renderList(); renderUX(); BGM.sync();
