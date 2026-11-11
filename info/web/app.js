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
   하우스: 느린 마이너 9th 패드 + 워킹 베이스
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
    // latencyHint "playback": 폰에서 버퍼가 모자라 지직거리는 걸 줄인다
    const AC = window.AudioContext || window.webkitAudioContext;
    let c; try { c = new AC({ latencyHint: "playback" }); } catch (e) { c = new AC(); }
    this.ctx = c;
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    // 공간감: 짧은 피드백 딜레이
    this.delay = c.createDelay(); this.delay.delayTime.value = .32;
    const fb = c.createGain(); fb.gain.value = .28;
    this.delay.connect(fb); fb.connect(this.delay);
    const wet = c.createGain(); wet.gain.value = .35;
    this.delay.connect(wet); wet.connect(this.master);
    // 브러시·해머용 짧은 잡음 재료 (계속 흐르던 LP 지직 소리는 폰 스피커에서 거슬려서 뺐다)
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 5000; f.Q.value = .7;
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
    // 브러시(칙칙 소리)는 가스레인지 점화음처럼 들려서 뺐다
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
    this.master.gain.linearRampToValueAtTime(.75, this.ctx.currentTime + 2); // 너무 크면 폰 스피커가 찢어진다
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
// 같은 말을 되풀이하지 않게: 먼저 보낸 말은 기억해 두고 다시 보내지 않는다 (다 쓰면 그 사람은 먼저 연락하지 않음)
// 먼저 오는 메시지는 전체 4분에 한 번, 같은 사람은 15분에 한 번까지만
const AMB_GAP = 4 * 60000, AMB_GAP_EACH = 15 * 60000, AMB_RESET = 6 * 3600000;
const ORDER = ["jin", "ruan", "anzi", "rainer", "jenis", "minos", "maquia"];
const CHAT = ST.chats;
ORDER.forEach(id => CHAT[id] = Object.assign({ log: [], node: "start", done: false, unread: true, started: false }, CHAT[id] || {}));
let cur = null, busy = false;

function renderList() {
  $("#msgList").innerHTML = ORDER.map(id => {
    const c = CH[id], s = CHAT[id], last = s.log.length ? shortTxt(s.log[s.log.length - 1][1]) : TALK[id].preview;
    return `<li class="${cur === id ? "on" : ""} ${s.unread ? "new" : ""}" data-chat="${id}" style="--ac:${c.ac}">
      <img src="../../char/${id}-e01.webp" alt=""><div><b>${c.ko}</b><small>${last}</small></div></li>`;
  }).join("");
  $$("[data-chat]").forEach(li => li.onclick = () => openChat(li.dataset.chat));
  const n = ORDER.filter(id => CHAT[id].unread).length;
  $("#unread").textContent = n || "";
}
function bubble(who, text) {
  const p = document.createElement("p");
  p.className = "bub " + who;
  // "IMG:주소" 는 사진 메시지
  if (String(text).startsWith("IMG:")) {
    const src = text.slice(4), im = new Image(); p.classList.add("photo");
    im.src = src; im.alt = "사진"; im.onload = () => { $("#chatLog").scrollTop = 1e6; };
    im.onclick = () => modal(`<img class="ph-full" src="${src}" alt="">`, "photo");
    p.appendChild(im);
  } else if (String(text).startsWith("VOICE:")) voiceBubble(p, text);
  else p.textContent = text;
  $("#chatLog").appendChild(p); $("#chatLog").scrollTop = 1e6;
}
const shortTxt = t => String(t).startsWith("IMG:") ? "📷 사진" : String(t).startsWith("VOICE:") ? "🎙 음성 메시지" : t;
// "VOICE:캐릭터|대사" 는 음성 메시지. voice/<캐릭터>.mp3(영어)를 틀고, 다 들으면 영어 대사와 한국어 번역이 뜬다
function voiceBubble(p, text) {
  const [vid] = text.slice(6).split("|"), V = VOICE[vid] || [], said = V[1] || text.slice(6).split("|")[1], en = V[3], sec = Math.max(4, Math.min(20, Math.round(said.length / 4)));
  const heard = (ST.vh || {})[vid];
  p.classList.add("voice"); if (heard) p.classList.add("heard");
  let seed = said.length; const h = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  // 대사는 보여 주지 않고, 녹음 파일 이름만 위에 단다 (우연히 녹음돼 간 파일)
  p.innerHTML = `<span class="vfile">${VFILE[vid] || "voice_memo.mp3"}</span><button class="vplay" aria-label="재생">▶</button><span class="wave">${Array.from({ length: 28 }, () => `<i style="height:${25 + Math.round(h() * 75)}%"></i>`).join("")}</span><em class="vdur">0:${String(sec).padStart(2, "0")}</em>`;
  const btn = p.querySelector(".vplay"), bars = [...p.querySelectorAll(".wave i")];
  // 실제 녹음 길이로 표시
  const meta = new Audio(); meta.preload = "metadata";
  meta.onloadedmetadata = () => { if (isFinite(meta.duration)) p.querySelector(".vdur").textContent = `0:${String(Math.round(meta.duration)).padStart(2, "0")}`; };
  meta.src = `../../voice/${vid}.mp3`;
  btn.onclick = () => {
    if (p.classList.contains("playing")) return;
    p.classList.add("playing"); btn.textContent = "❚❚";
    const duck = BGM.on && BGM.master; if (duck) BGM.master.gain.setTargetAtTime(.2, BGM.ctx.currentTime, .3);
    let t0 = performance.now(), len = sec * 1000, timer;
    const done = () => {
      clearInterval(timer); p.classList.remove("playing"); p.classList.add("heard"); btn.textContent = "▶";
      bars.forEach(b => b.classList.remove("on"));
      if (duck && BGM.on) BGM.master.gain.setTargetAtTime(.75, BGM.ctx.currentTime, .5);
      (ST.vh = ST.vh || {})[vid] = true; save(); $("#chatLog").scrollTop = 1e6;
    };
    const run = () => { t0 = performance.now(); timer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / len);
      bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < k));
      if (k >= 1) done();
    }, 80); };
    const a = new Audio(`../../voice/${vid}.mp3`);
    a.onloadedmetadata = () => { if (isFinite(a.duration)) len = a.duration * 1000; };
    a.onended = done;
    a.play().then(run).catch(run);
  };
}
function openChat(id) {
  cur = id; const s = CHAT[id], c = CH[id], r = REL(id);
  s.unread = false;
  // 며칠 만에 열면 첫마디가 다르다
  const gap = r.seenAt ? NOW() - r.seenAt : 0; r.seenAt = NOW(); save();
  $("#chatWho").innerHTML = `<b>${c.ko}</b> · ${c.code}`;
  $("#chatState").innerHTML = `<span class="live"><i></i>${c.st}</span>${relLabel(id)}`;
  $("#chatLog").innerHTML = "";
  s.log.forEach(([w, t]) => bubble(w, t));
  renderList();
  if (!s.started) { s.started = true; play(id, "start"); }
  else if (gap >= 2 * 864e5 && !busy && !REL(id).pend) say(id, [AWAY[id](Math.floor(gap / 864e5))]).then(() => drawChoices(id));
  else drawChoices(id);
  syncChatInput();
}
async function say(id, lines) {
  busy = true; $("#chatChoices").innerHTML = ""; syncChatInput();
  for (const line of lines) {
    if (cur !== id || !$("#tab-msg").classList.contains("on")) { CHAT[id].log.push(["them", line]); CHAT[id].unread = cur !== id; continue; }
    const ty = document.createElement("p"); ty.className = "typing"; ty.textContent = CH[id].ko + (String(line).startsWith("VOICE:") ? " 녹음 중" : " 입력 중");
    $("#chatLog").appendChild(ty); $("#chatLog").scrollTop = 1e6;
    // 가까워진 루안·미노스·마키아는 가끔 쓰다 지운다
    if (["ruan", "minos", "maquia"].includes(id) && TIER_N[tier(id)] >= 2 && line.length > 6 && Math.random() < .3) {
      await new Promise(r => setTimeout(r, 1000)); ty.remove();
      await new Promise(r => setTimeout(r, 1600)); $("#chatLog").appendChild(ty); $("#chatLog").scrollTop = 1e6;
    }
    await new Promise(r => setTimeout(r, /^(IMG|VOICE):/.test(String(line)) ? 2200 : 500 + Math.min(1600, line.length * 38)));
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
  if (!silent) toast(`✉ ${CH[id].ko}: ${shortTxt(lines[0])}`);
}
function ambient(silent, force) {
  if (!ST.amb) ST.amb = { seen: {}, last: 0, each: {}, reset: NOW() + AMB_RESET };
  const A = ST.amb;
  if (!force && NOW() - A.last < AMB_GAP) return false;
  // 내가 했던 말 기억 · 다른 사람한테 들은 소문이 먼저
  const sp = specialAmb(force);
  if (sp) { const [sid, lines] = sp; A.last = NOW(); A.each[sid] = NOW(); save(); pushMsg(sid, lines, silent); return true; }
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
  // 익숙함: 사진(사물·풍경) · 가까움: 음성 메시지 · 각별함: 셀카
  if (now === "close") setTimeout(() => tryVoice(id), rand(25000, 40000));
  else setTimeout(() => tryPhoto(id), rand(25000, 40000));
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
  const kk = kwKey(t); if (kk && !["thanks", "where", "fun"].includes(kk)) return null;
  let i = list.findIndex(([re], k) => re && !f.used.includes(k) && re.test(t));
  if (i < 0) { i = list.length - 1; if (f.used.includes(i) || !(key === "fallback" || key === "thanks" || SHORT_RE.test(norm) || norm.length <= 1)) return null; }
  const lines = list[i][1];
  f.used.push(i); f.n++; f.last = lines[lines.length - 1]; r.lastIntent = "follow"; save();
  return lines;
}
/* -------------------------------------------------------------------
   키워드 대사 — 사랑해·꿈·좋아해·관심·고마워·죽어·보고 싶어·어디야·키스·뽀뽀·껴안기·심심·재밌다·나랑 하자·목말라·위험해·너 갈증도
   lo = 경계·익숙함, hi = 가까움·각별함. 한 줄은 문자열, 여러 줄은 배열, 함수면 상황(c)을 받아 만든다
   c = { me: 내 갈증도, th: 상대 갈증도, loc: 상대 위치, st: 상대 상태 }
   ------------------------------------------------------------------- */
const KW_RE = [
  ["theirth", t => /갈증|수치|TH/i.test(t) && /높|왜\s?(이리|이렇게|그렇게)|많이\s?올/.test(t) && !/(내|나|제|난)\s?(갈증|수치)/.test(t)],
  ["risky", /(너|넌|당신|그쪽|니가|네가)\s?(좀|진짜|되게|너무|참|꽤)?\s?위험/],
  ["danger", /위험해|위험하다|위험한\s?상황|살려|(나|난|내가)\s?죽어|죽겠|죽을\s?것\s?같/],
  ["die", /죽어|죽을래|뒤질래|뒤져/],
  ["love", /사랑/],
  ["dream", /꿈\s?(꿔|꿀|꾸)|꿈에\s?(나와|와|나타)/],
  ["miss", /보고\s?싶/],
  ["like", /좋아\s?해|좋아한|좋아함/],
  ["interest", /관심\s?(있|가|생)/],
  ["kiss", /키스|입\s?맞/],
  ["peck", /뽀뽀/],
  ["hug", /껴안|안아\s?(줘|줄|봐|도|주)|포옹|허그|안기고/],
  ["lets", /나랑\s?(하자|해|할래)/],
  ["bored", /심심|놀아\s?(줘|주)|놀자/],
  ["fun", /재밌|재미있|즐거|신나/],
  ["parched", /목말|목\s?말라|갈증\s?(나|난|심|올라)/],
  ["thanks", /고마|감사|땡큐|ㄱㅅ/],
  ["where", /어디(야|니|냐|임|에\s?있|있어|예요|세요|인데)/],
];
const kwKey = t => { const h = KW_RE.find(([, re]) => typeof re === "function" ? re(t) : re.test(t)); return h ? h[0] : null; };
const LOC = c => /비공개|없음|권한/.test(c.loc || "") ? "" : String(c.loc).split(" · ")[0];
const KW = {
  love: {
    jin: { lo: ["……업무 채널에서 그 단어는 곤란합니다.", "못 본 걸로 하겠습니다."], hi: ["……나도.", "여기 말고, 얼굴 보고 다시 해."] },
    ruan: { lo: ["……미쳤냐.", "농담이면 지금 취소해."], hi: ["……알아.", "그 말은 한 번만 해. 버릇 된다."] },
    jenis: { lo: "음. 그 단어는 아직 데이터가 부족해요.", hi: ["……저도요.", "이건 계산 안 하고 하는 말이에요."] },
    rainer: { lo: "음… 그런 말은 아무한테나 하는 거 아니에요.", hi: ["알아요.", "그러니까 어디 가지 마요."] },
    anzi: { lo: "흠. 그거 헤드라인으로 써도 돼?", hi: ["……이번엔 안 받아칠게.", "나도."] },
    minos: { lo: "……술 마셨냐.", hi: ["……어.", "나도. 두 번은 안 한다."] },
    maquia: { lo: "……그 말의 근거는.", hi: ["……들었다.", "잊지 않겠다."] },
  },
  dream: {
    jin: { lo: "꿈 내용까지 지시하실 권한은 없습니다.", hi: "……알터는 꿈 잘 안 꿔. 꾸면 말해 줄게." },
    ruan: { lo: "꿈에서까지 보기 싫은데.", hi: "……어제 꿨어. 묻지 마." },
    jenis: { lo: "꿈은 통제 변수가 아니에요.", hi: "노력해 볼게요. 자기 전에 이 대화 다시 읽으면 되려나." },
    rainer: { lo: "음… 악몽이면 어떡하려고요.", hi: "좋아요. 꿈에서도 가게 문 열어 둘게요." },
    anzi: { lo: "흠. 네 꿈 꾸면 기삿거리라도 나와?", hi: "꿔 줄게. 내용은 비밀." },
    minos: { lo: "……잠도 제대로 못 자는 놈한테.", hi: "……자면 꾸겠지. 잘 시간이 없어서 그렇지." },
    maquia: { lo: "……꿈은 고르는 게 아니다.", hi: "……이미 꿨다." },
  },
  like: {
    jin: { lo: "……기록에서는 빼 드리겠습니다.", hi: "……나도 싫진 않아. 이건 기록 안 남겨." },
    ruan: { lo: "뭘 좋아해. 나를? ……취향 이상하네.", hi: "……알아. 티 나." },
    jenis: { lo: "음, 좋아한다는 근거가 궁금하네요.", hi: "저도 좋아해요. 생각보다 많이요." },
    rainer: { lo: "음… 커피 맛 때문이죠?", hi: "알아요. 나도 숨길 생각 없어요." },
    anzi: { lo: "흠, 나 좋아하는 사람 많아. 줄 서.", hi: "……그런 말은 반칙이야. 받아칠 말이 안 떠오르잖아." },
    minos: { lo: "……사람 잘못 봤다.", hi: "……어. 나도." },
    maquia: { lo: "……흥미롭군. 이유는 묻지 않겠다.", hi: "……알고 있다. 네 쪽이 먼저였다는 것도." },
  },
  interest: {
    jin: { lo: "관심은 업무 쪽으로 두십시오.", hi: "……나한테? 서류 말고?" },
    ruan: { lo: "관심 끄고 살아. 편해.", hi: "……그럼 계속 둬. 끄지 말고." },
    jenis: { lo: "관찰은 제 일인데, 반대가 됐네요.", hi: "다행이에요. 저만 그런 줄 알았거든요." },
    rainer: { lo: "음… 관심은 받는 쪽이 더 재밌는데.", hi: "알아요. 눈에 다 보여요." },
    anzi: { lo: "흠. 구경꾼을 구경하겠다고?", hi: "좋아. 그럼 오늘부터 서로 취재하는 걸로." },
    minos: { lo: "……수사 대상한테 할 말은 아니군.", hi: "……알았다. 나도 너 신경 쓰인다." },
    maquia: { lo: "……관심은 위험하다. 양쪽 다.", hi: "……나도 너를 보고 있다. 처음부터." },
  },
  thanks: {
    jin: { lo: "업무입니다. 감사는 필요 없습니다.", hi: "……응. 그 말 들으려고 한 건 아니야." },
    ruan: { lo: "됐어. 말로 하지 마.", hi: "……어. 다음에도 불러." },
    jenis: { lo: "별말씀을요. 기록해 둘게요, 감사 1회.", hi: "고맙다는 말, 당신한테 들으면 좀 다르네요." },
    rainer: { lo: "음, 착하네요.", hi: "음… 그 말이면 충분해요." },
    anzi: { lo: "흠. 고맙다는 말은 언제 들어도 좋아.", hi: "……그런 말 자꾸 하면 나 착한 줄 알아." },
    minos: { lo: "됐다.", hi: "……어. 다음엔 다치기 전에 불러." },
    maquia: { lo: "……기억해 두지.", hi: "……그 말은 처음 듣는군. 나쁘지 않다." },
  },
  die: {
    jin: { lo: "업무 채널입니다. 그런 말은 삼가십시오.", hi: "……기분 나쁜 일 있었어? 무슨 일인지부터 말해." },
    ruan: { lo: "해 봐. 네가 먼저 죽는다.", hi: "……그런 말 너한테 듣기 싫다." },
    jenis: { lo: "알터는 그렇게 쉽게 안 죽어요. 실험해 볼까요?", hi: "……농담이죠? 표정이 안 보여서요." },
    rainer: { lo: "음… 무서워라.", hi: "그런 말은 화났을 때만 해요. 지금 화났어요?" },
    anzi: { lo: "오, 살벌하네. 인용해도 돼?", hi: "흠. 오늘 뭐 있었어? 말해 봐. 다 들어 줄게." },
    minos: { lo: "협박이냐. 기록한다.", hi: "……무슨 일 있었냐." },
    maquia: { lo: "……그 말을 한 자는 많았다.", hi: "……네 입에서 나오니 이상하군." },
  },
  miss: {
    jin: { lo: "업무 시간에 디스패치실로 오시면 됩니다.", hi: "……나도. 오늘 일 일찍 끝낼게." },
    ruan: { lo: "……얼굴 보면 할 말도 없잖아.", hi: ["……어디야.", "가면 되잖아."] },
    jenis: { lo: "뉴욕에서 돌아가면 수치 재러 갈게요. 그때 보죠.", hi: "저도요. 이사회 내내 그 생각만 했어요." },
    rainer: { lo: "가게로 와요. 열 시까지 열어요.", hi: "음… 문 닫고 기다릴게요. 와요." },
    anzi: { lo: "편집국으로 와. 문 열려 있어.", hi: "……나도. 장난 아니고." },
    minos: { lo: "……순찰 끝나면 지나가 볼 수는 있다.", hi: "……지금 간다. 문 열어 둬." },
    maquia: { lo: "……보는 건 내가 정한다.", hi: "……오늘 밤, 공원 숲길." },
  },
  // 디바이스에 뜬 지금 위치로 답한다
  where: {
    jin: { lo: c => LOC(c) ? `${LOC(c)}. 용건만 말씀하세요.` : "위치는 비공개입니다.", hi: c => LOC(c) ? [`${LOC(c)}.`, "……데리러 갈까?"] : "……회의 중. 끝나면 연락할게." },
    ruan: { lo: c => LOC(c) ? `${LOC(c)}. 알아서 뭐 하게.` : "알아서 뭐 하게.", hi: c => LOC(c) ? `${LOC(c)}. ……오려면 와.` : ["신호 꺼 놨다.", "……너한테만 말할게. 스트립 외곽."] },
    jenis: { lo: c => LOC(c) ? `지금 ${LOC(c)}. 업무 중이에요.` : "그건 비공개예요.", hi: c => LOC(c) ? `${LOC(c)}. 오시면 시간 낼게요.` : ["비공개인데……", "당신한텐 말할게요. 라스베이거스예요."] },
    rainer: { lo: c => LOC(c) ? `${LOC(c)}. 손님 받는 중이에요.` : "음… 비밀.", hi: c => LOC(c) ? `${LOC(c)}. 와요, 자리 있어요.` : "음… 와요. 뒷문으로." },
    anzi: { lo: c => LOC(c) ? `${LOC(c)}. 왜, 제보할 거 있어?` : "흠. 그건 오프 더 레코드.", hi: c => LOC(c) ? `${LOC(c)}. 와. 구경시켜 줄게.` : "……너한텐 말해 줄게. 편집국 옥상." },
    minos: { lo: c => LOC(c) ? `${LOC(c)}. 근무 중이다.` : "비번이다. 위치는 말 안 해.", hi: c => LOC(c) ? `${LOC(c)}. ……필요하면 간다.` : "집. ……올 거냐." },
    maquia: { lo: "……알 필요 없다.", hi: "……네 근처." },
  },
  kiss: {
    jin: { lo: "……업무 채널에서 그런 단어는 삭제 대상입니다.", hi: "……여기서 말고." },
    ruan: { lo: "……미쳤냐. 정신 차려.", hi: "……말로 하지 마. 그런 건." },
    jenis: { lo: "음. 동의서부터 받아야겠네요.", hi: "……이건 문자로 대답할 질문이 아니네요." },
    rainer: { lo: "음… 그런 건 문 닫은 다음에 물어요.", hi: "와요. 대답은 그때." },
    anzi: { lo: "흠. 특종이다. 근데 안 써 줄게.", hi: "……그런 건 묻는 거 아니야. 와서 해." },
    minos: { lo: "……정신 차려.", hi: "……디바이스로 할 소리냐. 와." },
    maquia: { lo: "……대담하군.", hi: "……가까이 와서 다시 말해라." },
  },
  peck: {
    jin: { lo: "……그 단어, 이 채널에서 처음 봅니다.", hi: "……애도 아니고. ……이따가." },
    ruan: { lo: "애냐.", hi: "……한 번만이다." },
    jenis: { lo: "귀여운 단어를 쓰시네요.", hi: "……볼에요? 그럼 괜찮아요." },
    rainer: { lo: "음… 귀여워라.", hi: "볼 대 줄게요. 오면." },
    anzi: { lo: "흠, 뽀뽀? 나 몇 살로 보여?", hi: "……볼에만 해. 아니, 아무 데나." },
    minos: { lo: "……뭐?", hi: "……쯧. 이리 와." },
    maquia: { lo: "……그 단어는 너와 어울리는군.", hi: "……허락하지." },
  },
  hug: {
    jin: { lo: "물리적 접촉은 규정 외입니다.", hi: "……와. 잠깐이면 돼." },
    ruan: { lo: "붙지 마.", hi: "……와. 오래는 안 해." },
    jenis: { lo: "음, 체온 재는 거면 몰라도요.", hi: "네. 돌아가면 제일 먼저요." },
    rainer: { lo: "음… 앞치마 벗고 와요.", hi: "와요. 오늘은 놔 달라고 해도 안 놔요." },
    anzi: { lo: "흠. 너 오늘 무슨 일 있었구나.", hi: "와. 말 안 해도 돼." },
    minos: { lo: "……무슨 일 있었냐.", hi: "……어. 이리 와." },
    maquia: { lo: "……내 체온은 낮다. 그래도인가.", hi: "……잠깐만이다." },
  },
  bored: {
    jin: { lo: "디스패치 탭에 열린 임무가 있습니다.", hi: "……일 끝나면 놀아 줄게. 조금만 기다려." },
    ruan: { lo: "나한테 왜 말해.", hi: "……바이크 타러 갈래." },
    jenis: { lo: "그럼 수치 측정이나 할까요? 농담이에요.", hi: "저도요. 이사회 너무 길어요. 얘기해요." },
    rainer: { lo: "가게 오면 컵 닦게 해 줄게요.", hi: "피아노 칠 줄 알아요? 가르쳐 줄게요." },
    anzi: { lo: "흠. 언더럭스 게시판 구경해. 오늘 재밌는 거 많아.", hi: "나도 심심했어. 뭐 할래, 말만 해." },
    minos: { lo: "……난 바쁘다.", hi: "……순찰 같이 돌래. 차 안에서 얘기나 하자." },
    maquia: { lo: "……심심함은 나쁜 결정의 시작이다.", hi: "……체스판 펴 두겠다." },
  },
  fun: {
    jin: { lo: "즐거우시다니 다행입니다.", hi: "……나도. 오랜만이야, 이런 거." },
    ruan: { lo: "뭐가.", hi: "……그래. 나도 나쁘지 않았다." },
    jenis: { lo: "즐거움도 수치에 영향을 줘요. 좋은 쪽으로요.", hi: "저도요. 이런 건 기록 안 할래요." },
    rainer: { lo: "음, 다행이네요.", hi: "그 말 들으려고 하는 거예요." },
    anzi: { lo: "흠. 그치? 이 도시 재밌지.", hi: "너랑 있으면 기삿거리가 안 떨어져." },
    minos: { lo: "……뭐가 재밌냐.", hi: "……그래. 다행이다." },
    maquia: { lo: "……흠. 너는 쉽게 즐거워하는군.", hi: "……나도 그렇다. 이상하게." },
  },
  lets: {
    jin: { lo: "무엇을 말씀이십니까. 구체적으로.", hi: "……뭘. 말 끝까지 해." },
    ruan: { lo: "뭘 해.", hi: "……뭘 하자는 건지 말해. 그럼 생각해 볼게." },
    jenis: { lo: "주어와 목적어가 빠졌네요.", hi: "음, 뭘요? ……대충 알 것 같지만." },
    rainer: { lo: "음… 뭘요? 설거지?", hi: "뭘 하든 좋아요. 당신이 하자면." },
    anzi: { lo: "흠. 뭘? 말 흐리면 내 마음대로 해석한다.", hi: "좋아. 뭔지는 몰라도." },
    minos: { lo: "……뭘.", hi: "……말 똑바로 해라. 오해한다." },
    maquia: { lo: "……무엇을.", hi: "……좋다. 네가 정해라." },
  },
  // 내 갈증도(c.me)
  parched: {
    jin: { lo: c => `현재 ${c.me}%. 거처 보관함 확인하세요. 비었으면 보고하시고요.`, hi: c => `${c.me}%. ……몇 팩 남았어? 없으면 내가 보낼게.` },
    ruan: { lo: c => `${c.me}? 마셔. 지금.`, hi: c => [`${c.me}.`, "……참지 마. 참으면 내가 화난다."] },
    jenis: { lo: c => `${c.me}%. 팩 하나 바로 드세요. 기록은 제가 할게요.`, hi: c => `${c.me}%……. 그냥 지금 드세요. 걱정돼요.` },
    rainer: { lo: c => `음… ${c.me}%. 가게 오기 전에 해결하고 와요.`, hi: c => `${c.me}%? 와요. 냉장고에 하나 있어요.` },
    anzi: { lo: c => `${c.me}? 흠, 표정 관리 잘해. 사람들 보고 있어.`, hi: c => `${c.me}. ……농담 안 할게. 지금 마셔.` },
    minos: { lo: c => `${c.me}. 사람 많은 데 피해라.`, hi: c => `${c.me}……. 어디냐. 갖다 줄게.` },
    maquia: { lo: c => `${c.me}. ……참는 법부터 배워라.`, hi: c => `${c.me}. ……무리하지 마라.` },
  },
  danger: {
    jin: { lo: "위치 보내세요. 디스패치 연결합니다.", hi: "어디야. 지금 갈게. 끊지 마." },
    ruan: { lo: "어디야.", hi: "말하지 마. 위치만. 간다." },
    jenis: { lo: "어디세요? 다쳤으면 지혈부터 하세요.", hi: "거기 있어요. 바로 가요." },
    rainer: { lo: "벨 에포크로 와요. 뒷문 열게요.", hi: "움직이지 마요. 내가 가요." },
    anzi: { lo: "……어디야. 농담 아니면.", hi: "위치 찍어. 지금." },
    minos: { lo: "위치. 출발한다.", hi: "버텨. 사이렌 켰다." },
    maquia: { lo: "……어디.", hi: "……숨어 있어라. 간다." },
  },
  // "너 위험해"
  risky: {
    jin: { lo: "위험 등급은 C입니다. 공식 기록상.", hi: "……너한텐 아니야." },
    ruan: { lo: "이제 알았냐.", hi: "……알면서 왜 계속 연락해." },
    jenis: { lo: "위험한 건 제 연구 쪽이죠.", hi: "당신한텐 안 그래요. 약속해요." },
    rainer: { lo: "음… 다들 그러더라고요.", hi: "알면서 왔잖아요." },
    anzi: { lo: "흠, 칭찬으로 들을게.", hi: "위험한 거 좋아하잖아, 너." },
    minos: { lo: "……알면 거리 둬라.", hi: "……그래도 오잖아, 너." },
    maquia: { lo: "……정확한 판단이다.", hi: "……그래도 도망치지 않는군." },
  },
  // 디바이스 탭에서 상대 갈증도(c.th)를 보고 묻는 말 — 마키아는 수치가 비공개
  theirth: {
    jin: { lo: c => `${c.th}%. 정상 범위입니다. 제 수치는 신경 쓰지 마십시오.`, hi: c => [`${c.th}%……. 보고 있었어?`, "서류 때문에 좀 못 마셨어. 오늘 챙길게."] },
    ruan: { lo: c => `${c.th}? 남의 거 보지 마.`, hi: c => ["……봤냐.", `${c.th}면 괜찮아. 신경 꺼.`] },
    jenis: { lo: c => `${c.th}%. 출장 중이라 일정이 꼬여서요.`, hi: c => [`${c.th}%까지 봤어요?`, "……걱정해 주는 거죠. 오늘 챙겨 먹을게요."] },
    rainer: { lo: c => `음… ${c.th}%? 가게 일이 바빠서요.`, hi: c => `${c.th}%. 음… 걱정해 주는 거 좋네요.` },
    anzi: { lo: c => `${c.th}? 흠, 남의 디바이스 훔쳐보는 취미 있네.`, hi: c => [`${c.th}면 양호한 거야.`, "……근데 봐 줘서 고마워."] },
    minos: { lo: c => `${c.th}. ……원래 그렇다. 신경 쓰지 마.`, hi: c => `${c.th}. ……너 앞에선 안 넘는다.` },
    maquia: { lo: "……그 칸은 비어 있을 텐데.", hi: "……내 수치를 보려 했나. 대담하군." },
  },
};
// 원래 답(TIERED·REPLY)이 있는 키워드는, 같은 단계에서 또 쓰면 두 번에 한 번은 원래 답으로 돌린다 (같은 말 되풀이 방지)
const KW_BASE = { love: "like", like: "like", miss: "like", thanks: "thanks", danger: "help", parched: "thirst" };
function kwLine(id, key) {
  const set = KW[key] && KW[key][id]; if (!set) return null;
  const r = REL(id), band = TIER_N[tier(id)] >= 2 ? "hi" : "lo", tag = key + band;
  r.kw = r.kw || {}; const n = r.kw[tag] = (r.kw[tag] || 0) + 1; save();
  if (n % 2 === 0 && KW_BASE[key]) return null;
  let v = set[band];
  if (typeof v === "function") v = v({ me: ST.th, th: CH[id].th, loc: CH[id].loc, st: CH[id].st });
  return Array.isArray(v) ? v : [v];
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
  // 나중에 꺼낼 말 기억해 두기 (배고프다 · 무섭다 · 피곤하다 · 아프다 · 싫다)
  const mk = MEM_KEYS.find(([, re]) => re.test(t));
  if (mk && MEMBACK[id] && MEMBACK[id][mk[0]]) r.mem = { k: mk[0], at: NOW() };
  const fo = followUp(id, t, norm);
  if (fo) return [fo, rand(900, 1600)];
  if (SHORT_RE.test(norm) || norm.length <= 1) return [[SHORT[id]], 1200];

  const hit = INTENTS.find(([, re]) => re.test(t)), kk = kwKey(t);
  const key = kk && KW_BASE[kk] ? KW_BASE[kk] : hit ? hit[0] : "fallback";
  // 가까워지면 가끔 이름을 부른다
  if (ST.name && TIER_N[tier(id)] >= 2 && key !== "bye" && NOW() - (r.nameAt || 0) > 5 * 60000 && Math.random() < .22) { out.push(CALL[id](ST.name, tier(id))); r.nameAt = NOW(); }
  // 갈증도가 높으면 먼저 그 얘기부터
  if (ST.th >= 80 && key !== "thirst" && kk !== "theirth" && Math.random() < .4) out.push(pick(REPLY[id].thirst)(ST.th));
  let line;
  // 키워드 대사 (같은 감정을 연달아 말한 때는 아래 AGAIN_LIKE가 받는다)
  const kl = kk && !(key === "like" && r.lastIntent === "like") ? kwLine(id, kk) : null;
  // 다른 사람 이름 · 장소를 집어서 받아치기
  const other = Object.keys(NAMES).find(k => k !== id && NAMES[k].test(t));
  const place = PLACES.find(([re, who]) => who === id && re.test(t));
  if (other) addGossip(other, id);
  if (kl) { out.push(...kl.slice(0, -1)); line = kl[kl.length - 1]; }
  else if (place) line = place[2];
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
      // 바로 전에 한 말과 같은 답은 피한다 (다른 답이 있을 때)
      const alt = pool.filter(x => (typeof x === "function" ? x(ST.th) : x) !== r.lastLine);
      line = pick(alt.length ? alt : pool); if (typeof line === "function") line = line(ST.th);
    }
  }
  out.push(line);
  // 가끔 한 줄 더 덧붙이거나, 마키아·미노스는 가끔 "……"만
  if (TAIL[id] && out.length === 1 && line !== TAIL[id] && Math.random() < .18) out.push(TAIL[id]);
  if ((id === "maquia" || id === "minos") && tier(id) === "cold" && Math.random() < .08) { out.length = 0; out.push("……"); }
  r.lastIntent = key; r.lastText = norm; r.lastLine = out[out.length - 1]; save();
  // 읽고 한참 있다 답하는 때도 있다
  const wait = Math.random() < .15 ? rand(3000, 5000) : rand(700, 1400);
  return [out, wait];
}
/* -------------------------------------------------------------------
   기억 · 소문 · 늦은 답장 · 오랜만 · 이름 · 사진
   ------------------------------------------------------------------- */
// 내가 한 말 중 나중에 다시 꺼낼 것
const MEM_KEYS = [["thirst", /배고|목말|갈증/], ["fear", /무서|겁나|불안/], ["tired", /피곤|졸려|힘들|지쳐/], ["sick", /아파|아프|다쳤|다침/], ["hate", /싫어|하기\s?싫|짜증/]];
const MEMBACK = {
  jin: { thirst: ["아까 배고프다고 하셨죠.", "급식 기록이 아직 없습니다."], fear: ["아까 무섭다고 하신 건.", "……지금은 괜찮습니까."], tired: ["피곤하다고 하셨죠. 오늘 배정은 비워 뒀습니다."],
    sick: ["다쳤다고 하신 곳, 제니스에게 넘겼습니다."], hate: ["싫다고 하신 건 기록하지 않았습니다.", "……이번만."] },
  ruan: { thirst: ["아까 배고프다며.", "마셨냐."], fear: ["무섭다던 거.", "……아직이야?"], tired: ["피곤하다며. 자."], sick: ["아프다던 데. 어디야."], hate: ["아까 싫다던 거.", "하지 마. 진한테는 내가 말해."] },
  jenis: { thirst: ["아까 갈증 얘기 하셨죠. 수치 확인했어요."], fear: ["무섭다고 하셨던 거요.", "지금은요?"], tired: ["피곤하다고 하셨죠. 철분 수치 때문일 수도 있어요."],
    sick: ["다친 데, 사진 보내 주세요. 처치는 제가 해요."], hate: ["싫다고 하셨던 거, 안 해도 되는 방법 찾아볼게요."] },
  rainer: { thirst: ["배고프다고 했죠. 뒷문 냉장고에 하나 넣어 뒀어요."], fear: ["아까 무섭다던 거.", "음… 오늘은 가게 2층에서 쉬다 가요."], tired: ["피곤하다면서요. 내일은 늦게 와요."],
    sick: ["다쳤다면서요. 오늘 출근 안 해도 돼요."], hate: ["싫다던 거, 안 해도 돼요. 대신 컵은 닦고요."] },
  anzi: { thirst: ["배고프다던 애가 조용하네. 마셨어?"], fear: ["무섭다던 거, 아직이야?", "……장난 아니고 묻는 거야."], tired: ["피곤하다며. 오늘은 아무것도 안 캐물을게."],
    sick: ["다쳤다며. 어디서. 누구한테."], hate: ["싫다던 거 아직도 싫어? 흠, 고집 있네."] },
  minos: { thirst: ["배고프다며. 사람 많은 데 가지 마라."], fear: ["무섭다던 거.", "……순찰 그쪽으로 돈다."], tired: ["피곤하다며. 자라."], sick: ["다쳤다며. 누가 그랬어."], hate: ["싫다던 거. 억지로 하지 마."] },
  maquia: { thirst: ["……갈증 얘기를 했었지."], fear: ["무섭다고 했었지.", "……아직인가."], tired: ["쉬어라. 피곤하다고 했으니."], sick: ["다친 곳. 보여라."], hate: ["싫다고 했던 것.", "……기억해 두지."] },
};
// 다른 사람 얘기를 하면, 나중에 그 사람이 안다
const GOSSIP = {
  jin: n => [`${n}에게 제 얘기를 하셨다고요.`, "……정정할 부분은 없습니까."],
  ruan: n => [`${n}한테 내 얘기 했냐.`, "……뭐라고 했는데."],
  jenis: n => [`${n} 씨한테 제 얘기 하셨다면서요.`, "좋은 얘기였길 바라요."],
  rainer: n => [`${n}한테 내 얘기 했다면서요.`, "음… 뭐라고 했는지는 안 물어볼게요."],
  anzi: n => [`${n}한테 내 얘기 했지?`, "흠, 그 녀석 표정이 이상하더라."],
  minos: n => [`${n}한테 내 얘기 했냐.`, "……쓸데없는 소리 하지 마라."],
};
function addGossip(to, from) {
  if (!GOSSIP[to]) return;
  ST.gossip = ST.gossip || [];
  if (ST.gossip.some(g => g.to === to) || (REL(to).heard || []).includes(from)) return;
  ST.gossip.push({ to, from, at: NOW() }); if (ST.gossip.length > 6) ST.gossip.shift(); save();
}
// 먼저 오는 메시지 중 특별한 것: 기억(8분~3일 뒤) → 소문(15분 뒤)
function specialAmb(force) {
  const A = ST.amb, okId = id => (force || NOW() - (A.each[id] || 0) >= AMB_GAP_EACH) && !(hasFx("case") && id === "jin");
  for (const id of ORDER) {
    const r = REL(id), m = r.mem;
    if (m && okId(id) && NOW() - m.at >= 8 * 60000 && NOW() - m.at <= 3 * 864e5) { delete r.mem; return [id, MEMBACK[id][m.k]]; }
    if (m && NOW() - m.at > 3 * 864e5) delete r.mem;
  }
  const g = (ST.gossip || []).find(g => okId(g.to) && NOW() - g.at >= 15 * 60000);
  if (g) { ST.gossip = ST.gossip.filter(x => x !== g); const r = REL(g.to); (r.heard = r.heard || []).push(g.from); return [g.to, GOSSIP[g.to](CH[g.from].ko)]; }
  return null;
}
// 바쁜 상태 — 자동 답장이 있으면 그 한 줄, 없으면 읽지도 않음
const DEFER = {
  ruan: { OFFLINE: null, "임무중": null }, jenis: { "회의중": "회의 중이에요. 끝나면 연락할게요." }, rainer: { "방해 금지": null },
  anzi: { OFFLINE: null, "취재중": "취재 중. 이따." }, minos: { "현장 출동": "현장. 나중에." },
  jin: { "방해 금지": "방해 금지 중입니다. 확인 후 회신하겠습니다.", "회의중": "회의 중입니다. 끝나고 회신합니다." },
};
const busyNow = id => DEFER[id] && CH[id].st in DEFER[id] ? { auto: DEFER[id][CH[id].st] } : null;
const DEFER_OPEN = { jin: "확인했습니다. 늦었습니다.", ruan: "이제 봤다.", jenis: "끝났어요. 아까 말씀하신 거요.", rainer: "음, 이제 봤어요.", anzi: "왔어.", minos: "끝났다. 봤다." };
const MANY = { jin: "메시지가 여러 건이네요.", ruan: "……몇 개를 보낸 거야.", jenis: "여러 개 보내셨네요. 마지막 것만 답할게요.", rainer: "음… 많이도 보냈네.", anzi: "흠, 나 없는 사이에 수다 떨었네.", minos: "……많이도 보냈네." };
function deliverPending(id) {
  const r = REL(id), p = r.pend; if (!p) return;
  delete r.pend; save();
  const [lines] = replyTo(id, p.last || "");
  pushMsg(id, [DEFER_OPEN[id], ...(p.n >= 3 ? [MANY[id]] : []), ...lines]);
}
setInterval(() => ORDER.forEach(id => { const p = REL(id).pend; if (p && !busy && (!busyNow(id) || NOW() >= p.due)) deliverPending(id); }), 20000);
// 며칠 만에 대화창을 열면
const AWAY = { jin: d => `${d}일 만입니다.`, ruan: () => "어디 갔다 왔어.", jenis: d => `${d}일 동안 기록이 비었네요.`, rainer: () => "음… 오랜만이네요.",
  anzi: d => `${d}일. 흠, 실종 기사 쓸 뻔했잖아.`, minos: () => "……살아 있었냐.", maquia: () => "……돌아왔군." };
// 이름 부르기 (가까움부터)
const CALL = { jin: (n, t) => t === "bond" ? `${n}.` : `${n} 씨.`, jenis: n => `${n} 씨.`, ruan: n => `${n}.`, rainer: n => `${n}.`, anzi: n => `${n}.`, minos: n => `${n}.`, maquia: n => `……${n}.` };
// 다른 화면에서 내 이름이 나오면 (게시판 댓글)
const BOARD_REACT = {
  jin: ["게시판 로그 확인했습니다.", "제 이름은 빼 주십시오."], ruan: ["게시판에 내 얘기 쓴 거 너냐."],
  jenis: ["언더럭스 게시판에 제 얘기가 있던데요.", "……쓴 사람이 당신이라니 흥미롭네요."], rainer: ["음, 게시판에 내 얘기 썼다면서요.", "가게 홍보는 고마워요."],
  anzi: ["게시판 댓글 봤어.", "흠. 내 이름 들어가니까 다들 몰려들더라."], minos: ["게시판에 내 이름 올리지 마. 형사다."], maquia: ["……게시판.", "그 댓글, 지워지기 전에 봤다."],
};
function boardMention(t) {
  const id = [...Object.keys(NAMES), "maquia"].find(k => (k === "maquia" ? /마키아/ : NAMES[k]).test(t));
  if (!id || ST.once["bd_" + id]) return;
  ST.once["bd_" + id] = true; save();
  setTimeout(() => pushMsg(id, BOARD_REACT[id]), rand(20000, 40000));
}
// 사진 메시지 (이미지가 올라와 있을 때만 보낸다)
// 루안·제니스·미노스는 가까움에 찍은 것, 각별함에 셀카. 나머지는 각별함에 한 장
// 익숙함(30): 사물·풍경 사진 / 각별함(85): 셀카. 파일이 아직 없으면 올라올 때까지 기다린다
const PHOTO = {
  ruan: { warm: ["ruan", ["새벽에 달리다 찍었다."], ["……다음엔 뒤에 타."]], bond: ["ruan2", ["어디냐고 물어볼까 봐."], ["……여기."]] },
  jenis: { warm: ["jenis", ["책상 정리하다가요."], ["……아직 한 줄도 못 썼어요."]], bond: ["jenis2", ["편지 대신이에요."], ["……한 줄은 썼어요."]] },
  minos: { warm: ["minos", ["끝났다. 다이너."], ["……네 자리 비어 있다."]], bond: ["minos02", ["……이렇게 찍는 거 맞냐."], ["지우지 마라."]] },
  rainer: { warm: ["rainer1", ["마감했어요."], ["……컵 하나는 당신 거로 남겨 뒀어요."]], bond: ["rainer", ["뉴올리언스 왔어요. 비 와요."], ["문 앞 화분, 아직 살아 있더라고요."]] },
  anzi: { warm: ["anzi1", ["내일 1면 교정본."], ["……아직 아무도 못 본 거야."]], bond: ["anzi", ["1면 사진 아님. 그냥 찍었어."], ["흠. 저장해 둬도 돼."]] },
  jin: { warm: ["jin1", ["오늘 처리한 서류입니다."], ["……보고는 아닙니다. 그냥."]], bond: ["jin", ["새로 들였어."], ["……같이 들을 거면 와."]] },
  maquia: { warm: ["maquia1", ["……."], ["여기 자주 온다."]], bond: ["maquia", ["네 차례다."], ["……서두를 필요는 없다."]] },
};
// 가까움(60): 디바이스가 우연히 녹음해서 보내 버린 일상 한 토막 [앞말, 한국어 번역, 알아챈 뒤 하는 말, 실제 녹음(영어, voice/<캐릭터>.mp3)]
const VOICE = {
  ruan: [[], "좀, 걸려라. 좀. ……고물 같으니. 알았어, 알았다고. 그럼 끌고 가 줄게.", ["……방금 뭐 보냈냐.", "지워."],
    "Come on, start. Come on. ...Piece of junk. Fine. Fine. I'll walk you home, then."],
  anzi: [[], "아니, 아니, 아니. 이름은 필요 없어. 새벽 세 시에 어디 있었는지가 필요하지. ……어. 알아내면 전화해. 오, 이거 재밌어지겠네.", ["흠. 들었어?", "……기사 나가기 전까진 비밀이야."],
    "No, no, no. I don't need his name. I need where he was at three in the morning. ...Yeah. Call me when you have it. Oh, this is gonna be good."],
  jenis: [[], "아홉 시 건은 내일로 옮겨 줘요. ……아뇨, 괜찮아요. 잠을 못 잤을 뿐이에요. 그리고 커피요. 블랙으로. 고마워요.", ["……녹음이 켜져 있었네요.", "못 들은 걸로 해 주세요."],
    "Move the nine o'clock to tomorrow. ...No, no, I'm fine. I just haven't slept. And coffee. Black. Thank you."],
  minos: [[], "본부, 4호차. 현장 정리됐다. ……아니. 목격자 없다. 알았다. 복귀한다. ……커피부터.", ["……주머니에서 눌렸다.", "신경 쓰지 마."],
    "Dispatch, unit four. Scene's clear. ...No. No witnesses. Copy. Heading back. ...Coffee first."],
  rainer: [[], "문 닫았어요, 미안해요. ……아, 당신이구나. 들어와요, 들어와. 편한 데 앉아요. 따뜻한 거 하나 만들어 줄게요.", ["음… 이게 왜 갔지.", "……단골손님이에요. 오해하지 마요."],
    "We're closed, sorry... oh. It's you. Come in, come in. Sit wherever you like. I'll make you something warm."],
  jin: [[], "또군요. 이 보고서…… 세 시간 늦게 올렸습니다. 또. 변명은 필요 없습니다. 제 책상 위에. 해 뜨기 전까지.", ["……잘못 전송됐습니다.", "당신한테 한 말 아닙니다."],
    "Again. You filed this report... three hours late. Again. I don't want excuses. On my desk. Before sunrise."],
  maquia: [[], "혼자 왔군. ……좋다. 곁에 앉아라. 밤은 길다.", ["……들었나.", "잊어라."],
    "You came alone. ...Good. Sit with me. The night is long."],
};
// 말풍선 위에 뜨는 녹음 파일 이름 (녹음된 시각)
const VFILE = { ruan: "Ruan_REC_0412.mp3", anzi: "Anzi_REC_0258.mp3", jenis: "Jenis_REC_2347.mp3", minos: "Minos_REC_0446.mp3",
  rainer: "Rainer_REC_2318.mp3", jin: "Jin_REC_0521.mp3", maquia: "Maquia_REC_0303.mp3" };
function tryVoice(id) {
  const r = REL(id), V = VOICE[id];
  if (!V || r.voice || TIER_N[tier(id)] < 2) return;
  r.voice = true; save();
  pushMsg(id, [...V[0], `VOICE:${id}|${V[1]}`]);
  if (V[2].length) setTimeout(() => pushMsg(id, V[2]), rand(20000, 35000)); // 잘못 보낸 걸 조금 뒤에 알아챈다
}
function tryPhoto(id) {
  const r = REL(id), P = PHOTO[id]; if (!P) return;
  // 예전 저장분: 각별함 사진 하나를 받았던 사람은 첫 사진을 받은 걸로
  if (!r.photos) { r.photos = {}; if (r.photo) r.photos[Object.keys(P)[0]] = true; }
  // 예전 저장분: 가까움 사진(close)은 이제 익숙함 사진(warm)
  if (r.photos.close) { r.photos.warm = true; delete r.photos.close; save(); }
  const st = Object.keys(P).find(k => !r.photos[k] && TIER_N[tier(id)] >= TIER_N[k]);
  if (!st) return;
  const [file, pre, post] = P[st], src = `../../photo/${file}.webp`, im = new Image();
  im.onload = () => {
    if (r.photos[st]) return; r.photos[st] = true; save();
    pushMsg(id, [...pre, "IMG:" + src, ...post]);
    if (Object.keys(P).some(k => !r.photos[k] && TIER_N[tier(id)] >= TIER_N[k])) setTimeout(() => tryPhoto(id), rand(60000, 120000));
  };
  im.src = src;
}
setTimeout(() => ORDER.forEach(id => tryPhoto(id)), 15000);
setTimeout(() => ORDER.forEach(id => tryVoice(id)), 45000);
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
  // 바쁜 상태면 지금은 답하지 않고, 상태가 바뀌거나 몇 분 뒤에 답이 온다 (도와 달라는 말은 바로)
  const bz = busyNow(id), r = REL(id);
  if (bz && !(INTENTS.find(([k]) => k === "help")[1].test(text))) {
    if (!r.pend) {
      r.pend = { n: 0, due: NOW() + rand(3, 8) * 60000 };
      await new Promise(res => setTimeout(res, 1500));
      busy = false;
      if (bz.auto) await say(id, [bz.auto]);
      else { const p = document.createElement("p"); p.className = "bub sys"; p.textContent = "— 읽음 표시 없음 —"; $("#chatLog").appendChild(p); $("#chatLog").scrollTop = 1e6; }
    }
    r.pend.n++; r.pend.last = text; save();
    busy = false; drawChoices(id); syncChatInput();
    return;
  }
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
  { who: "@drape", t: "[후기] 벨 에포크 마감 직전", p: "사장님이 피아노 치고 있었음. 손님 나밖에 없었는데 끝까지 다 침.", cm: [["@bellhop", "그거 아무한테나 안 쳐 주는데"], ["@static", "너 찍혔다"]] },
  { who: "@ironmoth", t: "[판매] 피 향 덮는 향수 재입고", p: "신입용. 미노스 형사 근처에선 소용없다는 후기 있음.", cm: [["@watcher", "그 형사 코는 반칙임"], ["@drape", "검정 병 있음?"]] },
  { who: "@static", t: "[목격] 루안이 웃는 거 봄", p: "스트립 남쪽에서 신입이랑 있었는데 웃었음. 진짜로.", cm: [["@nightjar", "사진 없으면 무효"], ["@bellhop", "……세상 끝나는 날인가"]] },
  { who: "@nightjar", t: "[질문] 디스패치 거절해도 괜찮음?", p: "임무 하나 거절했더니 서기장한테 '확인했습니다' 한 줄 옴. 이게 더 무서움.", cm: [["@watcher", "평가표에 남음. 조용히."], ["@static", "그 한 줄이 제일 무서운 거 맞음"]] },
  { who: "@watcher", t: "[경고] 더 레저 쪽 움직임", p: "현상금 목록에 새 얼굴 올라왔다는 말 있음. 신입 쪽이라는 소문.", cm: [["@gearhead", "……누구"], ["@watcher", "모르는 게 나아"]] },
  { who: "@bellhop", t: "[잡담] 제니스 출장 언제 끝남", p: "공급 라인 결재 밀려서 의료국 난리. 크레인 국장님만 평온함.", cm: [["@drape", "국장님은 늘 평온함"], ["@nightjar", "그게 제일 신기"]] },
  { who: "@ironmoth", t: "[공구] 암막 커튼 같이 살 사람", p: "낮잠 제대로 자고 싶은 사람. 4명 모이면 진행.", cm: [["@drape", "나 낌"], ["@static", "신입 거처에도 달 수 있음?"]] },
  { who: "@static", t: "[잡담] 크로니클 편집국 불", p: "새벽 4시에도 켜져 있음. 안지는 언제 자는 거임?", cm: [["@nightjar", "안 잠"], ["@bellhop", "잔다는 기록이 없음"]] },
  { who: "@drape", t: "[후기] 첫 급식 기억나냐", p: "난 울었음. 맛있어서.", cm: [["@gearhead", "다들 그럼"], ["@watcher", "그 얘긴 신입한테 하지 마. 아직이면."]] },
  { who: "@nightjar", t: "[목격] 서기장 사석 모드", p: "퇴근 후 바에서 봤는데 반말 쓰더라. 상대는 못 봄.", cm: [["@static", "서기장도 퇴근을 함?"], ["@bellhop", "그 바 어디냐"]] },
  { who: "@gearhead", t: "[질문] 낮에 눈 아픈 거 정상임?", p: "신입이 물어봄. 햇빛 보면 눈이 시리대.", cm: [["@drape", "신입 때만 그럼"], ["@ironmoth", "한 달 지나면 괜찮아짐"]] },
  { who: "@watcher", t: "[경고] 프리몬트 폭주 개체 회수", p: "어젯밤 디바이스 응답 없는 개체 하나 회수됨. 미노스 형사가 먼저 와 있었다고.", cm: [["@nightjar", "또 그 형사"], ["@gearhead", "회수됐으면 다행이지"]] },
  { who: "@bellhop", t: "[잡담] 펜트하우스 꼭대기 불", p: "새벽 3시에 한 번 켜졌다 꺼짐. 매일 같은 시각.", cm: [["@static", "체스 두는 시간이래"], ["@nightjar", "누구랑?"]] },
  { who: "@drape", t: "[잡담] 옆자리 신입 디바이스", p: "손목에서 계속 진동 옴. 인기 많네.", cm: [["@bellhop", "일곱 중 몇 명이냐"], ["@static", "부럽다 진짜"]] },
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
// 새 제보가 위에 붙는다. 다 나왔으면 제일 오래된 제보를 내리고, 내려갔던 제보 중 하나가 다시 올라온다 (계속 순환)
const NOISE_SHOW = 6; // 기본 3건 + 새 제보 최대 6건
function addNoise() {
  ST.extraNoise = ST.extraNoise || [];
  let left = NOISE_POOL.map((_, i) => i).filter(i => !ST.extraNoise.includes(i));
  if (!left.length || ST.extraNoise.length >= NOISE_SHOW) {
    const out = ST.extraNoise.pop();
    if (ST.noiseOk && out != null) delete ST.noiseOk["n" + NOISE_POOL[out].t]; // 다시 올라오면 새 제보처럼 확인 안 한 상태로
    left = NOISE_POOL.map((_, i) => i).filter(i => !ST.extraNoise.includes(i) && i !== out);
  }
  if (!left.length) return false;
  ST.extraNoise.unshift(left[rand(0, left.length - 1)]); save(); renderUX();
  return true;
}
const escH = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const myH = () => "@" + (ST.name || "신입");
const CM_DRAFT = {};
// 게시판 새 글: 위에 붙고, 최대 POST_SHOW개. 다 나왔거나 꽉 차면 제일 오래된 새 글을 내리고 내려간 글 중 하나가 다시 올라온다 (계속 순환)
const POST_SHOW = 6;
function addPost() {
  const E = ST.extraPosts;
  let left = BOARD_POOL.map((_, i) => i).filter(i => !E.includes(i));
  if (!left.length || E.length >= POST_SHOW) {
    const out = E.pop();
    if (out != null) { const k = "b" + BOARD_POOL[out].t; if (ST.liveCm) delete ST.liveCm[k]; if (ST.bump) delete ST.bump[k]; } // 다시 올라오면 새 글처럼
    left = BOARD_POOL.map((_, i) => i).filter(i => !E.includes(i) && i !== out);
  }
  if (!left.length) return false;
  E.unshift(left[rand(0, left.length - 1)]); save(); renderUX();
  return true;
}
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
        : `<form class="cm-form" data-cmk="${escH(k)}"><input maxlength="80" placeholder="댓글 남기기" value="${escH(CM_DRAFT[k] || "")}"><button class="btn sm">등록</button></form>`}
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
      (ST.myCm = ST.myCm || {})[k] = { t, at: NOW(), re: [] }; delete CM_DRAFT[k]; save(); renderUX(); cmReact(k); boardMention(t);
    };
    if (k === fk) { i.focus(); try { i.setSelectionRange(fs, fs); } catch {} }
  });
  $$("[data-uncm]").forEach(b => b.onclick = () => { delete ST.myCm[b.dataset.uncm]; save(); renderUX(); });
  $$("[data-nzok]").forEach(b => b.onclick = () => {
    const k = b.dataset.nzok; ST.noiseOk = ST.noiseOk || {};
    if (ST.noiseOk[k]) delete ST.noiseOk[k]; else ST.noiseOk[k] = NOW();
    save(); renderUX();
    // 처음 확인하면 크로니클(안지)이, 전부 확인하면 진이 알아챈다
    if (ST.noiseOk[k] && !ST.once.nzFirst) { ST.once.nzFirst = true; save(); setTimeout(() => pushMsg("anzi", ["노이즈 필터 보고 있네.", "위험도는 내가 매긴 거야. 맞는 것 같아?"]), rand(8000, 15000)); }
    const all = noisePosts(); if (all.length >= 5 && all.every(x => ST.noiseOk["n" + x.t]) && !ST.once.nzAll) { ST.once.nzAll = true; save(); setTimeout(() => pushMsg("jin", ["제보 확인 기록 봤습니다.", "신입치고 꼼꼼하네요."]), rand(8000, 15000)); }
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
    if (addPost()) { if ($("#ux").classList.contains("on")) toast("게시판에 새 글이 올라왔습니다."); }
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
    addPost();
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
