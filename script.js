/* ============================================================
   Arabify — Editor Engine
   ============================================================ */
"use strict";

const $ = id => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const stageWrap = $("stageWrap"), stageInner = $("stageInner");
const APPLE_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";
const AUTOSAVE_KEY = "arabify_project_autosave_v2";
const LETTERSPACING_SUPPORTED = (() => { try { return "letterSpacing" in ctx; } catch (e) { return false; } })();

/* ---------- Emoji data (grouped) ---------- */
const emojiGroups = [
  { key: "faces", label: "وجوه", list: "😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🫡🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕".match(/\p{Emoji}\uFE0F?/gu) || [] },
  { key: "hands", label: "أيدي وقلوب", list: "👍👎👏🙌👐🤲🤝🙏✍️💪👀🫶❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥💕💞💓💗💖💘💝💟🩷🩵🩶".match(/\p{Emoji}\uFE0F?(\u200D\p{Emoji}\uFE0F?)*/gu) || [] },
  { key: "fx", label: "تأثيرات", list: "🔥✨⭐🌟💫💥💯💢💦💨🎉🎊🎯🏆🥇👑💎💰💵🚀⚡☀️🌈☁️❄️🌙💡📌🔔💬".match(/\p{Emoji}\uFE0F?/gu) || [] },
  { key: "objects", label: "أدوات", list: "🍕🍔🍟🎮🎧📱💻📸🎥🎬🎵🎶🎸🎹🎤🎁🎈⚽🏀🏈💀☠️👽🤖🎃💩👻".match(/\p{Emoji}\uFE0F?/gu) || [] },
  { key: "nature", label: "طبيعة", list: "🐱🐶🦊🐻🐼🐨🐯🦁🐸🐵🙈🙉🙊🐔🐧🐦🦄🐝🦋🌸🌹🌺🌻🌼🍀🌴🍎🍓🍉🍌🥑🍩🍪🍫".match(/\p{Emoji}\uFE0F?/gu) || [] },
  { key: "more", label: "أخرى", list: "🫠🫣🫢🤠🥸😈👿👹👺🤡😺😸😹😻😼😽🙀😿😾".match(/\p{Emoji}\uFE0F?/gu) || [] },
];
const emojiList = emojiGroups.flatMap(g => g.list);

/* ---------- State ---------- */
let layers = [defaultTextLayer(1, "فيديو جديد", 600, 325)];
let selected = 1, nextId = 2;
let drag = null, transform = null, marquee = null;
let history = [], future = [];
let clipboard = null;
let zoom = 1;
let showGrid = false, snapEnabled = true;
let guideX = null, guideY = null;
let bgImageObj = null, bgImageData = null;
let saveTimer = null;

function defaultTextLayer(id, text, x, y) {
  return {
    id, type: "text", name: text || "نص", text, x, y,
    size: 150, font: "Cairo", c1: "#fff200", c2: "#ff7800", gradient: "vertical",
    stroke: 12, strokeColor: "#111111", shadow: 20, blur: 6, glow: 0, glowColor: "#ffd400",
    shine: 0, depth: 0, rotate: 0, bold: true, italic: false, align: "center",
    letterSpacing: 0, lineHeight: 120, opacity: 100, flipH: false, flipV: false,
    locked: false, hidden: false,
  };
}
function defaultEmojiLayer(id, e, x, y) {
  return {
    id, type: "emoji", name: e, emoji: e, x, y, size: 170,
    shadow: 12, blur: 3, rotate: 0, opacity: 100, locked: false, hidden: false,
  };
}

/* ---------- Helpers ---------- */
function cp(s) { return [...s].map(ch => ch.codePointAt(0).toString(16)).join("-"); }
function emojiURL(e) { return APPLE_CDN + cp(e) + ".png"; }
function imgFor(e) { let im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async"; im.src = emojiURL(e); im.onload = () => draw(); return im; }
function selectedLayer() { return layers.find(x => x.id === selected); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function isTyping() { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); }

function applyFont(o) {
  const weight = o.bold ? 900 : 400;
  const style = o.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${o.size}px "${o.font}"`;
  if (LETTERSPACING_SUPPORTED) ctx.letterSpacing = (o.letterSpacing || 0) + "px";
}
function textLines(o) { return (o.text || " ").split("\n"); }
function lineWidths(o) { applyFont(o); return textLines(o).map(l => ctx.measureText(l || " ").width); }
function gradientFor(o, w) {
  if (o.gradient === "solid") return o.c1;
  let g = o.gradient === "horizontal"
    ? ctx.createLinearGradient(o.x - w / 2, o.y, o.x + w / 2, o.y)
    : ctx.createLinearGradient(o.x, o.y - o.size, o.x, o.y + o.size);
  g.addColorStop(0, o.c1); g.addColorStop(1, o.c2); return g;
}

function drawText(o) {
  const lh = o.size * ((o.lineHeight || 120) / 100);
  const lines = textLines(o);
  const widths = lineWidths(o);
  const maxW = Math.max(...widths, 1);
  const blockH = lh * lines.length;

  ctx.save();
  ctx.globalAlpha = (o.opacity ?? 100) / 100;
  ctx.translate(o.x, o.y); ctx.rotate((o.rotate || 0) * Math.PI / 180); ctx.translate(-o.x, -o.y);
  ctx.translate(o.x, o.y); ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1); ctx.translate(-o.x, -o.y);

  applyFont(o);
  ctx.textAlign = o.align === "left" ? "right" : o.align === "right" ? "left" : "center";
  ctx.textBaseline = "middle"; ctx.direction = "rtl"; ctx.lineJoin = "round";

  lines.forEach((line, i) => {
    const t = line || " ";
    const ly = o.y - blockH / 2 + lh / 2 + i * lh;
    if (o.depth) { for (let d = o.depth; d > 0; d--) { ctx.strokeStyle = "#080808"; ctx.lineWidth = o.stroke; ctx.strokeText(t, o.x + d * .7, ly + d * .7); } }
    ctx.shadowColor = "rgba(0,0,0,.84)"; ctx.shadowBlur = o.blur; ctx.shadowOffsetX = o.shadow * .5; ctx.shadowOffsetY = o.shadow;
    ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor; if (o.stroke) ctx.strokeText(t, o.x, ly);
    ctx.shadowColor = "transparent"; ctx.fillStyle = gradientFor(o, maxW); ctx.fillText(t, o.x, ly);
    if (o.shine) {
      const sh = o.shine / 100, g = ctx.createLinearGradient(o.x - maxW / 2, ly - o.size / 2, o.x + maxW / 2, ly + o.size / 2);
      g.addColorStop(0, `rgba(255,255,255,${sh})`); g.addColorStop(.45, "rgba(255,255,255,0)");
      g.addColorStop(.55, `rgba(255,255,255,${sh * .75})`); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillText(t, o.x, ly);
    }
    if (o.glow) {
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.shadowColor = o.glowColor; ctx.shadowBlur = o.glow;
      ctx.fillStyle = "rgba(255,255,255,.01)"; ctx.fillText(t, o.x, ly); ctx.restore();
    }
  });
  ctx.restore();
}

function drawEmoji(o) {
  if (!o.img || !o.img.complete || !o.img.naturalWidth) { o.img = imgFor(o.emoji); return; }
  ctx.save();
  ctx.globalAlpha = (o.opacity ?? 100) / 100;
  ctx.translate(o.x, o.y); ctx.rotate((o.rotate || 0) * Math.PI / 180);
  const s = o.size;
  ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = (o.shadow || 0) * .4; ctx.shadowOffsetY = (o.shadow || 0) * .5;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(o.img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function bounds(o) {
  if (o.type === "emoji") return { w: o.size, h: o.size };
  const lh = o.size * ((o.lineHeight || 120) / 100);
  const widths = lineWidths(o);
  return { w: Math.max(...widths, 1) + 30, h: lh * textLines(o).length + o.size * .25 };
}
function localPoint(o, p) {
  const a = -(o.rotate || 0) * Math.PI / 180, dx = p.x - o.x, dy = p.y - o.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

/* ---------- Background ---------- */
function drawBackground(W, H) {
  if ($("transparent").checked) return;
  if (bgImageObj && bgImageObj.complete && bgImageObj.naturalWidth) {
    const ir = bgImageObj.naturalWidth / bgImageObj.naturalHeight, cr = W / H;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(bgImageObj, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = $("bgColor").value || "#15171d"; ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- Main draw ---------- */
function draw(opts = {}) {
  const forExport = !!opts.forExport;
  const W = +$("W").value || 1200, H = +$("H").value || 650;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  drawBackground(W, H);

  if (showGrid && !forExport) drawGridLines(W, H);

  layers.forEach(o => { if (o.hidden) return; o.type === "text" ? drawText(o) : drawEmoji(o); });

  if (!forExport) {
    drawGuides(W, H);
    drawSelection();
  }
  renderLayers();
  syncPosFields();
}

function drawGridLines(W, H) {
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}
function drawGuides(W, H) {
  if (guideX === null && guideY === null) return;
  ctx.save(); ctx.strokeStyle = "#ff3d6e"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
  if (guideX !== null) { ctx.beginPath(); ctx.moveTo(guideX, 0); ctx.lineTo(guideX, H); ctx.stroke(); }
  if (guideY !== null) { ctx.beginPath(); ctx.moveTo(0, guideY); ctx.lineTo(W, guideY); ctx.stroke(); }
  ctx.restore();
}
function drawSelection() {
  const o = selectedLayer(); if (!o || o.hidden) return;
  const b = bounds(o), handle = 12;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate((o.rotate || 0) * Math.PI / 180);
  ctx.strokeStyle = o.locked ? "#5c6577" : "#ffb000"; ctx.fillStyle = "#0e1117"; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
  ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.setLineDash([]);
  if (!o.locked) {
    const pts = [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]];
    pts.forEach(([x, y]) => { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#ffb000"; ctx.beginPath(); ctx.arc(x, y, handle / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(0, -b.h / 2); ctx.lineTo(0, -b.h / 2 - 34); ctx.stroke();
    ctx.fillStyle = "#ffb000"; ctx.beginPath(); ctx.arc(0, -b.h / 2 - 40, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function hitHandle(p, o) {
  if (o.locked) return null;
  const b = bounds(o), lp = localPoint(o, p), h = 18;
  const corners = { nw: { x: -b.w / 2, y: -b.h / 2 }, ne: { x: b.w / 2, y: -b.h / 2 }, se: { x: b.w / 2, y: b.h / 2 }, sw: { x: -b.w / 2, y: b.h / 2 } };
  for (const [k, c] of Object.entries(corners)) if (Math.hypot(lp.x - c.x, lp.y - c.y) < h) return k;
  if (Math.hypot(lp.x, lp.y + (b.h / 2 + 40)) < 18) return "rotate";
  return null;
}
function hit(p) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const o = layers[i]; if (o.hidden) continue;
    const lp = localPoint(o, p), b = bounds(o);
    if (Math.abs(lp.x) <= b.w / 2 && Math.abs(lp.y) <= b.h / 2) return o;
  }
  return null;
}

/* ---------- History ---------- */
function snapshot() {
  history.push(serialize()); if (history.length > 60) history.shift(); future = [];
  scheduleAutosave();
}
function serialize() {
  return JSON.stringify({
    layers: layers.map(({ img, ...rest }) => rest), selected, nextId,
    W: $("W").value, H: $("H").value, transparent: $("transparent").checked,
    bgColor: $("bgColor").value, bgImageData, projectName: $("projectName").value,
  });
}
function loadState(json) {
  const a = JSON.parse(json);
  layers = a.layers.map(l => l.type === "emoji" ? { ...l, img: imgFor(l.emoji) } : l);
  selected = a.selected; nextId = a.nextId || (Math.max(0, ...layers.map(l => l.id)) + 1);
  if (a.W) $("W").value = a.W; if (a.H) $("H").value = a.H;
  $("transparent").checked = !!a.transparent;
  if (a.bgColor) $("bgColor").value = a.bgColor;
  if (a.projectName) $("projectName").value = a.projectName;
  bgImageData = a.bgImageData || null;
  if (bgImageData) { bgImageObj = new Image(); bgImageObj.onload = draw; bgImageObj.src = bgImageData; } else bgImageObj = null;
  syncPanel(); draw();
}
function restore(s) { loadState(s); }

function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(AUTOSAVE_KEY, serialize()); } catch (e) { } }, 600);
}

/* ---------- Layer ops ---------- */
function addText() {
  const c = selectedLayer();
  const o = defaultTextLayer(nextId++, "نص جديد", canvas.width / 2, canvas.height / 2);
  if (c && c.type === "text") { o.font = c.font; o.gradient = "solid"; o.c1 = "#ffffff"; o.c2 = "#ffffff"; o.size = 120; o.stroke = 10; o.shadow = 15; o.blur = 5; }
  layers.push(o); selected = o.id; snapshot(); syncPanel(); draw();
  toast("تمت إضافة نص جديد");
}
function addEmoji(e) {
  const o = defaultEmojiLayer(nextId++, e, canvas.width / 2, canvas.height / 2);
  layers.push(o); selected = o.id; snapshot(); syncPanel(); draw();
}
function duplicateSelected() {
  const o = selectedLayer(); if (!o) return;
  const clone = JSON.parse(JSON.stringify(o, (k, v) => k === "img" ? undefined : v));
  clone.id = nextId++; clone.x += 24; clone.y += 24;
  if (clone.type === "emoji") clone.img = imgFor(clone.emoji);
  layers.push(clone); selected = clone.id; snapshot(); syncPanel(); draw();
  toast("تم تكرار العنصر");
}
function copySelected() { const o = selectedLayer(); if (!o) return; clipboard = JSON.parse(JSON.stringify(o, (k, v) => k === "img" ? undefined : v)); toast("تم النسخ"); }
function pasteClipboard() {
  if (!clipboard) return toast("لا يوجد عنصر منسوخ", "err");
  const clone = JSON.parse(JSON.stringify(clipboard));
  clone.id = nextId++; clone.x += 30; clone.y += 30;
  if (clone.type === "emoji") clone.img = imgFor(clone.emoji);
  layers.push(clone); selected = clone.id; snapshot(); syncPanel(); draw();
  toast("تم اللصق");
}
function deleteSelected() {
  if (layers.length <= 1) return toast("لا يمكن حذف آخر عنصر", "err");
  layers = layers.filter(o => o.id !== selected); selected = layers.at(-1).id;
  snapshot(); syncPanel(); draw();
}
function toggleLock() { const o = selectedLayer(); if (!o) return; o.locked = !o.locked; snapshot(); draw(); }
function toggleHide(id) {
  const o = id ? layers.find(l => l.id === id) : selectedLayer(); if (!o) return;
  o.hidden = !o.hidden; snapshot(); draw();
}
function renameLayer(id, name) { const o = layers.find(l => l.id === id); if (!o) return; o.name = name || o.name; snapshot(); renderLayers(); }
function moveLayer(dir) {
  const i = layers.findIndex(o => o.id === selected); if (i < 0) return;
  const j = i + dir; if (j < 0 || j >= layers.length) return;
  [layers[i], layers[j]] = [layers[j], layers[i]]; snapshot(); draw();
}
function moveExtreme(top) {
  const o = layers.find(x => x.id === selected); layers = layers.filter(x => x !== o);
  top ? layers.push(o) : layers.unshift(o); snapshot(); draw();
}
function reorderTo(id, targetIndexFromEnd) {
  const i = layers.findIndex(o => o.id === id); if (i < 0) return;
  const [o] = layers.splice(i, 1);
  layers.splice(targetIndexFromEnd, 0, o); snapshot(); draw();
}

/* ---------- Panel sync ---------- */
function syncPanel() {
  const o = selectedLayer(); if (!o) return;
  if (o.type === "text") {
    $("text").value = o.text; $("font").value = o.font; $("size").value = o.size; $("rotate").value = o.rotate;
    $("c1").value = o.c1; $("c2").value = o.c2; $("gradient").value = o.gradient;
    $("stroke").value = o.stroke; $("strokeColor").value = o.strokeColor; $("shadow").value = o.shadow; $("blur").value = o.blur;
    $("glow").value = o.glow; $("glowColor").value = o.glowColor; $("shine").value = o.shine; $("depth").value = o.depth;
    $("letterSpacing").value = o.letterSpacing; $("lineHeight").value = o.lineHeight; $("opacity").value = o.opacity;
    $("boldBtn").classList.toggle("active", !!o.bold); $("italicBtn").classList.toggle("active", !!o.italic);
    ["Right", "Center", "Left"].forEach(a => $("align" + a).classList.toggle("active", o.align === a.toLowerCase()));
  } else {
    $("text").value = o.emoji; $("size").value = o.size; $("rotate").value = o.rotate;
    $("shadow").value = o.shadow; $("blur").value = o.blur; $("opacity").value = o.opacity ?? 100;
  }
  ["size", "rotate", "stroke", "shadow", "blur", "glow", "shine", "depth", "letterSpacing", "opacity"].forEach(id => {
    const e = $(id), out = $(id + "Out"); if (e && out) out.textContent = id === "rotate" ? e.value + "°" : e.value;
  });
  const lhOut = $("lineHeightOut"); if (lhOut) lhOut.textContent = (o.lineHeight ? (o.lineHeight / 100).toFixed(2) : "1.20");
  syncPosFields();
}
function syncPosFields() {
  const o = selectedLayer(); if (!o) return;
  if (document.activeElement !== $("posX")) $("posX").value = Math.round(o.x);
  if (document.activeElement !== $("posY")) $("posY").value = Math.round(o.y);
}
function renderLayers() {
  const box = $("layerList"); box.innerHTML = "";
  if (!layers.length) { box.innerHTML = `<div class="emptyState">لا توجد عناصر بعد<br>أضف نصًا أو إيموجي للبدء</div>`; return; }
  [...layers].reverse().forEach(o => {
    const d = document.createElement("div");
    d.className = "layer" + (o.id === selected ? " selected" : "") + (o.hidden ? " hidden-layer" : "");
    d.draggable = true; d.dataset.id = o.id;
    d.innerHTML = `
      <div class="layerInfo">
        <span>${o.type === "emoji" ? "😀" : "T"} ${escapeHtml(o.name)}</span>
        <small>${o.type === "emoji" ? "إيموجي" : "نص"}${o.locked ? " · مقفل" : ""}</small>
      </div>
      <div class="layerActs">
        <button data-act="hide" title="إخفاء/إظهار">${o.hidden ? "🙈" : "👁"}</button>
        <button data-act="lock" title="قفل/فتح">${o.locked ? "🔒" : "🔓"}</button>
        <button data-act="dup" title="تكرار">⧉</button>
        <button data-act="del" title="حذف">🗑</button>
      </div>`;
    d.addEventListener("click", (e) => { if (e.target.closest("[data-act]")) return; selected = o.id; syncPanel(); draw(); });
    d.querySelector('[data-act="hide"]').onclick = (e) => { e.stopPropagation(); toggleHide(o.id); };
    d.querySelector('[data-act="lock"]').onclick = (e) => { e.stopPropagation(); selected = o.id; toggleLock(); };
    d.querySelector('[data-act="dup"]').onclick = (e) => { e.stopPropagation(); selected = o.id; duplicateSelected(); };
    d.querySelector('[data-act="del"]').onclick = (e) => { e.stopPropagation(); selected = o.id; confirmDialog("حذف العنصر", `هل تريد حذف "${o.name}"؟`, () => deleteSelected()); };
    d.addEventListener("dragstart", () => d.classList.add("dragging"));
    d.addEventListener("dragend", () => { d.classList.remove("dragging"); });
    d.addEventListener("dragover", (e) => e.preventDefault());
    d.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = +document.querySelector(".layer.dragging")?.dataset.id; if (!draggedId || draggedId === o.id) return;
      const idxVisual = [...box.children].indexOf(d);
      const targetIndex = layers.length - 1 - idxVisual;
      reorderTo(draggedId, targetIndex);
    });
    box.appendChild(d);
  });
}

/* ---------- Pointer interaction ---------- */
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
canvas.addEventListener("pointerdown", (e) => {
  const p = pos(e); let o = selectedLayer();
  if (o && !o.hidden) {
    const h = hitHandle(p, o);
    if (h) {
      transform = { type: h, o, start: { x: p.x, y: p.y }, startSize: o.size, startRotate: o.rotate || 0, startDist: Math.hypot(p.x - o.x, p.y - o.y), startAngle: Math.atan2(p.y - o.y, p.x - o.x) };
      canvas.setPointerCapture(e.pointerId); return;
    }
  }
  o = hit(p);
  if (o && !o.locked) {
    selected = o.id; drag = { o, px: p.x, py: p.y }; syncPanel(); draw(); canvas.setPointerCapture(e.pointerId);
  } else if (o) { selected = o.id; syncPanel(); draw(); }
});
canvas.addEventListener("pointermove", (e) => {
  const p = pos(e);
  if (transform) {
    const o = transform.o;
    if (transform.type === "rotate") {
      const ang = Math.atan2(p.y - o.y, p.x - o.x);
      let deg = (ang - transform.startAngle) * 180 / Math.PI + transform.startRotate;
      while (deg > 180) deg -= 360; while (deg < -180) deg += 360;
      o.rotate = Math.round(deg);
    } else {
      const dist = Math.hypot(p.x - o.x, p.y - o.y);
      const ratio = dist / Math.max(1, transform.startDist);
      o.size = Math.max(10, Math.min(600, Math.round(transform.startSize * ratio)));
    }
    syncPanel(); draw(); return;
  }
  if (drag) {
    let nx = drag.o.x + (p.x - drag.px), ny = drag.o.y + (p.y - drag.py);
    guideX = null; guideY = null;
    if (snapEnabled) {
      const cx = canvas.width / 2, cy = canvas.height / 2, T = 10;
      if (Math.abs(nx - cx) < T) { nx = cx; guideX = cx; }
      if (Math.abs(ny - cy) < T) { ny = cy; guideY = cy; }
    }
    drag.o.x = nx; drag.o.y = ny; drag.px = p.x; drag.py = p.y; draw();
    return;
  }
  if (!drag && !transform) {
    const o = selectedLayer();
    if (o && !o.hidden) {
      const h = hitHandle(p, o);
      canvas.style.cursor = h === "rotate" ? "crosshair" : h ? "nwse-resize" : (hit(p) ? "move" : "default");
    } else canvas.style.cursor = "default";
  }
});
canvas.addEventListener("pointerup", () => {
  if (transform) { snapshot(); transform = null; return; }
  if (drag) { guideX = null; guideY = null; snapshot(); drag = null; draw(); }
});
canvas.addEventListener("dblclick", (e) => {
  const o = hit(pos(e)); if (o && o.type === "text" && !o.locked) { selected = o.id; syncPanel(); document.querySelector('[data-tab="textTab"]').click(); $("text").focus(); }
});

/* ---------- Field bindings ---------- */
function bind(id, prop, parse = v => v) {
  const e = $(id);
  e.addEventListener("input", () => {
    const o = selectedLayer(); if (!o) return; o[prop] = parse(e.value); draw();
    const out = $(id + "Out"); if (out) out.textContent = id === "rotate" ? e.value + "°" : e.value;
    if (id === "lineHeight") $("lineHeightOut").textContent = (e.value / 100).toFixed(2);
  });
  e.addEventListener("change", snapshot);
}
$("text").oninput = () => { const o = selectedLayer(); if (o && o.type === "text") { o.text = $("text").value; o.name = (o.text || "نص").split("\n")[0].slice(0, 24); draw(); renderLayers(); } };
$("text").onchange = snapshot;
["font", "gradient", "c1", "c2", "strokeColor", "glowColor"].forEach(id => $(id).addEventListener("input", () => { const o = selectedLayer(); if (!o || o.type !== "text") return; o[id] = $(id).value; draw(); }));
["font", "gradient", "c1", "c2", "strokeColor", "glowColor"].forEach(id => $(id).addEventListener("change", snapshot));
["size", "rotate", "stroke", "shadow", "blur", "glow", "shine", "depth", "letterSpacing", "lineHeight", "opacity"].forEach(id => bind(id, id, Number));

$("boldBtn").onclick = () => { const o = selectedLayer(); if (!o || o.type !== "text") return; o.bold = !o.bold; snapshot(); syncPanel(); draw(); };
$("italicBtn").onclick = () => { const o = selectedLayer(); if (!o || o.type !== "text") return; o.italic = !o.italic; snapshot(); syncPanel(); draw(); };
[["alignRight", "right"], ["alignCenter", "center"], ["alignLeft", "left"]].forEach(([id, val]) => {
  $(id).onclick = () => { const o = selectedLayer(); if (!o || o.type !== "text") return; o.align = val; snapshot(); syncPanel(); draw(); };
});
$("flipH").onclick = () => { const o = selectedLayer(); if (!o) return; o.flipH = !o.flipH; snapshot(); draw(); };
$("flipV").onclick = () => { const o = selectedLayer(); if (!o) return; o.flipV = !o.flipV; snapshot(); draw(); };
$("posX").onchange = () => { const o = selectedLayer(); if (!o) return; o.x = +$("posX").value || 0; snapshot(); draw(); };
$("posY").onchange = () => { const o = selectedLayer(); if (!o) return; o.y = +$("posY").value || 0; snapshot(); draw(); };

$("addText").onclick = addText;
$("delete").onclick = () => confirmDialog("حذف العنصر", "هل تريد حذف العنصر المحدد؟", deleteSelected);
$("center").onclick = () => { const o = selectedLayer(); if (o) { o.x = canvas.width / 2; o.y = canvas.height / 2; snapshot(); draw(); } };
$("reset").onclick = () => { const o = selectedLayer(); if (o) { o.x = canvas.width / 2; o.y = canvas.height / 2; o.rotate = 0; o.flipH = false; o.flipV = false; snapshot(); syncPanel(); draw(); } };
$("up").onclick = () => moveLayer(1); $("down").onclick = () => moveLayer(-1);
$("top").onclick = () => moveExtreme(true); $("bottom").onclick = () => moveExtreme(false);
$("duplicateBtn").onclick = duplicateSelected;
$("lockBtn").onclick = toggleLock;
$("hideBtn").onclick = () => toggleHide();
$("copyBtn").onclick = copySelected;
$("pasteBtn").onclick = pasteClipboard;
$("undo").onclick = () => { if (history.length > 1) { future.push(history.pop()); restore(history.at(-1)); } };
$("redo").onclick = () => { if (future.length) { const s = future.pop(); history.push(s); restore(s); } };
$("transparent").oninput = () => { draw(); snapshot(); };
$("bgColor").oninput = () => { draw(); };
$("bgColor").onchange = snapshot;
$("W").oninput = draw; $("H").oninput = draw; $("W").onchange = snapshot; $("H").onchange = snapshot;
$("gridToggle").onchange = () => { showGrid = $("gridToggle").checked; draw(); };
$("snapToggle").onchange = () => { snapEnabled = $("snapToggle").checked; };

$("bgImageBtn").onclick = () => $("bgImageInput").click();
$("bgImageInput").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { bgImageData = reader.result; bgImageObj = new Image(); bgImageObj.onload = () => { draw(); snapshot(); }; bgImageObj.src = bgImageData; };
  reader.readAsDataURL(f);
};

/* ---------- Presets & templates ---------- */
const presetMap = {
  youtube: ["#fff200", "#ff7600", 12, 20, 6, 0, 8], gold: ["#fff6a0", "#e8a900", 10, 14, 4, 5, 10],
  ice: ["#ffffff", "#48c9ff", 10, 10, 5, 8, 4], neon: ["#ff65df", "#6c5cff", 8, 5, 12, 30, 0],
  comic: ["#ffea00", "#ff3d00", 18, 25, 3, 0, 12], cyberpunk: ["#00fff2", "#ff00c8", 9, 8, 4, 26, 6],
  rainbow: ["#ff5e5e", "#7c5eff", 6, 12, 5, 10, 0], metallic: ["#e8e8e8", "#7c8290", 8, 16, 4, 0, 14],
  glass: ["#e9fbff", "#8fd8ff", 4, 10, 8, 12, 0], gaming: ["#c6ff00", "#00e0a0", 11, 18, 5, 14, 8],
  mlg: ["#39ff14", "#0a3d0a", 16, 26, 2, 24, 12],
};
document.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => {
  const o = selectedLayer(); if (!o || o.type !== "text") return;
  const p = presetMap[b.dataset.preset]; if (!p) return;
  [o.c1, o.c2, o.stroke, o.shadow, o.blur, o.glow, o.depth] = p;
  syncPanel(); snapshot(); draw();
});

const templates = [
  { key: "youtube", label: "يوتيوب", sub: "Thumbnail", text: "اشترك الآن", preset: "youtube", font: "Cairo" },
  { key: "gaming", label: "قيمنق", sub: "Gaming", text: "برو قيمر", preset: "gaming", font: "Changa" },
  { key: "minecraft", label: "Minecraft", sub: "لعبة", text: "ماين كرافت", preset: "comic", font: "Reem Kufi" },
  { key: "discord", label: "Discord", sub: "سيرفر", text: "سيرفري", preset: "neon", font: "Tajawal" },
  { key: "tiktok", label: "TikTok", sub: "فيديو", text: "تيك توك", preset: "rainbow", font: "El Messiri" },
  { key: "instagram", label: "Instagram", sub: "بايو", text: "حسابي", preset: "glass", font: "Lemonada" },
  { key: "names", label: "أسماء عربية", sub: "زخرفة", text: "اسمك هنا", preset: "gold", font: "Noto Kufi Arabic" },
  { key: "neon2", label: "نيون", sub: "Neon", text: "نيون", preset: "cyberpunk", font: "Readex Pro" },
  { key: "fire", label: "ناري", sub: "Fire", text: "نار 🔥", preset: "youtube", font: "Changa" },
  { key: "ice2", label: "جليدي", sub: "Ice", text: "جليد ❄️", preset: "ice", font: "IBM Plex Sans Arabic" },
  { key: "mlg", label: "MLG", sub: "360 Noscope", text: "MLG 360°", preset: "mlg", font: "Changa" },
];
function renderTemplates() {
  const grid = $("templatesGrid"); grid.innerHTML = "";
  templates.forEach(t => {
    const b = document.createElement("button"); b.type = "button";
    b.innerHTML = `${escapeHtml(t.label)}<small>${escapeHtml(t.sub)}</small>`;
    b.onclick = () => {
      const o = defaultTextLayer(nextId++, t.text, canvas.width / 2, canvas.height / 2);
      const p = presetMap[t.preset]; [o.c1, o.c2, o.stroke, o.shadow, o.blur, o.glow, o.depth] = p; o.font = t.font;
      layers.push(o); selected = o.id; snapshot(); syncPanel(); draw();
      document.querySelector('[data-tab="textTab"]').click();
      toast(`تم تطبيق قالب "${t.label}"`);
    };
    grid.appendChild(b);
  });
}

/* ---------- Emoji grid ---------- */
function renderEmojiCats() {
  const box = $("emojiCats"); box.innerHTML = "";
  const allBtn = document.createElement("button"); allBtn.textContent = "الكل"; allBtn.className = "active"; allBtn.onclick = () => selectCat(null, allBtn);
  box.appendChild(allBtn);
  emojiGroups.forEach(g => {
    const b = document.createElement("button"); b.textContent = g.label;
    b.onclick = () => selectCat(g.key, b); box.appendChild(b);
  });
  function selectCat(key, btn) { [...box.children].forEach(c => c.classList.remove("active")); btn.classList.add("active"); renderEmojiGrid($("emojiSearch").value, key); }
}
function renderEmojiGrid(filter = "", cat = null) {
  const grid = $("emojiGrid"); grid.innerHTML = "";
  let list = cat ? (emojiGroups.find(g => g.key === cat)?.list || []) : emojiList;
  if (filter) list = list.filter(e => e.includes(filter));
  if (!list.length) { grid.innerHTML = `<div class="emptyState" style="grid-column:1/-1">لا توجد نتائج</div>`; return; }
  list.forEach(e => {
    const b = document.createElement("button"); b.type = "button"; b.title = e; b.setAttribute("role", "listitem");
    const im = new Image(); im.src = emojiURL(e); im.alt = e; im.loading = "lazy";
    b.appendChild(im); b.onclick = () => addEmoji(e); grid.appendChild(b);
  });
}
$("emojiSearch").oninput = e => renderEmojiGrid(e.target.value);

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
  document.querySelectorAll(".tabcontent").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); b.setAttribute("aria-selected", "true"); $(b.dataset.tab).classList.add("active");
});

/* ---------- Zoom / Pan ---------- */
function setZoom(z) {
  zoom = Math.max(.25, Math.min(3, z));
  stageInner.style.transform = `scale(${zoom})`;
  $("zoomLevel").textContent = Math.round(zoom * 100) + "%";
}
$("zoomIn").onclick = () => setZoom(zoom + .1);
$("zoomOut").onclick = () => setZoom(zoom - .1);
$("zoomReset").onclick = () => setZoom(1);
stageWrap.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? .08 : -.08)); }, { passive: false });

/* ---------- Toasts ---------- */
function toast(msg, type = "ok") {
  const wrap = $("toastWrap"); const t = document.createElement("div");
  t.className = "toast " + type; t.textContent = msg; wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .25s"; setTimeout(() => t.remove(), 260); }, 2200);
}

/* ---------- Confirm dialog ---------- */
function confirmDialog(title, msg, onConfirm, danger = true) {
  const overlay = document.createElement("div"); overlay.className = "overlay";
  overlay.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true">
      <h3>${escapeHtml(title)}</h3><p>${escapeHtml(msg)}</p>
      <div class="dialogBtns">
        <button data-a="cancel">إلغاء</button>
        <button data-a="ok" class="${danger ? "danger" : ""}">تأكيد</button>
      </div></div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="cancel"]').onclick = () => overlay.remove();
  overlay.querySelector('[data-a="ok"]').onclick = () => { overlay.remove(); onConfirm(); };
  document.body.appendChild(overlay);
}

/* ---------- Project: new / save / clear ---------- */
function resetToBlank(withSample) {
  layers = withSample ? [defaultTextLayer(1, "فيديو جديد", canvas.width / 2, canvas.height / 2)] : [];
  selected = layers[0]?.id ?? null; nextId = 2;
  $("W").value = 1200; $("H").value = 650; $("transparent").checked = false; $("bgColor").value = "#15171d";
  $("projectName").value = "مشروع بدون اسم"; bgImageData = null; bgImageObj = null;
  if (!layers.length) layers = [defaultTextLayer(1, "فيديو جديد", 600, 325)], selected = 1, nextId = 2;
  history = []; future = []; snapshot(); syncPanel(); draw();
}
$("newProject").onclick = () => confirmDialog("مشروع جديد", "سيتم فقد أي تعديلات غير محفوظة. هل تريد المتابعة؟", () => { resetToBlank(true); toast("تم إنشاء مشروع جديد"); });
$("clearProject").onclick = () => confirmDialog("مسح المشروع", "سيتم حذف جميع العناصر والإعدادات. هل أنت متأكد؟", () => { resetToBlank(true); toast("تم مسح المشروع"); });
$("saveProject").onclick = () => { try { localStorage.setItem(AUTOSAVE_KEY, serialize()); toast("تم حفظ المشروع"); } catch (e) { toast("تعذر الحفظ", "err"); } };

$("exportJson").onclick = () => {
  const blob = new Blob([serialize()], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = (($("projectName").value || "arabify-project").trim() || "arabify-project") + ".json"; a.click();
  toast("تم تصدير المشروع");
};
$("importJsonBtn").onclick = () => $("importJsonInput").click();
$("importJsonInput").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { loadState(reader.result); history = [serialize()]; future = []; toast("تم استيراد المشروع"); } catch (err) { toast("ملف غير صالح", "err"); } };
  reader.readAsText(f); e.target.value = "";
};

/* ---------- Export (download) dialog ---------- */
function openExportDialog() {
  const overlay = document.createElement("div"); overlay.className = "overlay";
  overlay.innerHTML = `<div class="dialog exportDialog" role="dialog" aria-modal="true">
    <h3>تحميل التصميم</h3>
    <div class="exportGrid">
      <div>
        <label for="expFormat">الصيغة</label>
        <select id="expFormat">
          <option value="png">PNG</option>
          <option value="jpeg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </div>
      <div id="expQualityWrap">
        <label for="expQuality">الجودة <output id="expQualityOut">90</output></label>
        <input id="expQuality" type="range" min="10" max="100" value="90">
      </div>
      <div>
        <label for="expScale">الدقة</label>
        <select id="expScale">
          <option value="1">1x (${canvas.width}×${canvas.height})</option>
          <option value="2" selected>2x (${canvas.width * 2}×${canvas.height * 2})</option>
          <option value="3">3x (${canvas.width * 3}×${canvas.height * 3})</option>
        </select>
      </div>
    </div>
    <div class="dialogBtns">
      <button data-a="cancel">إلغاء</button>
      <button data-a="ok" class="primary" style="border:0">⬇ تحميل</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const qWrap = overlay.querySelector("#expQualityWrap"), fmt = overlay.querySelector("#expFormat");
  const toggleQ = () => qWrap.style.display = fmt.value === "png" ? "none" : "block";
  fmt.onchange = toggleQ; toggleQ();
  overlay.querySelector("#expQuality").oninput = (e) => overlay.querySelector("#expQualityOut").textContent = e.target.value;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="cancel"]').onclick = () => overlay.remove();
  overlay.querySelector('[data-a="ok"]').onclick = () => {
    const format = fmt.value, quality = (+overlay.querySelector("#expQuality").value) / 100, scale = +overlay.querySelector("#expScale").value;
    overlay.remove();
    exportImage(format, quality, scale);
  };
}
function exportImage(format, quality, scale) {
  const W = +$("W").value || 1200, H = +$("H").value || 650;
  const off = document.createElement("canvas"); off.width = W * scale; off.height = H * scale;
  const octx = off.getContext("2d"); octx.scale(scale, scale);
  const realCtx = ctx, realCanvas = canvas;
  // Temporarily render onto offscreen using same draw logic
  const savedSel = selected; selected = null;
  const backupW = canvas.width, backupH = canvas.height;
  draw({ forExport: true });
  octx.drawImage(canvas, 0, 0, W, H);
  selected = savedSel; canvas.width = backupW; canvas.height = backupH; draw();

  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const ext = format === "jpeg" ? "jpg" : format;
  off.toBlob((blob) => {
    if (!blob) return toast("تعذر إنشاء الصورة", "err");
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (($("projectName").value || "arabic-text").trim() || "arabic-text") + "." + ext; a.click();
    toast("تم تحميل التصميم");
  }, mime, format === "png" ? undefined : quality);
}
$("download").onclick = openExportDialog;

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener("keydown", (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); $("undo").click(); return; }
  if (ctrl && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); $("redo").click(); return; }
  if (isTyping()) return;
  if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
  if (ctrl && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); return; }
  if (ctrl && e.key.toLowerCase() === "v") { e.preventDefault(); pasteClipboard(); return; }
  if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); $("saveProject").click(); return; }
  if (ctrl && e.key.toLowerCase() === "e") { e.preventDefault(); openExportDialog(); return; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); confirmDialog("حذف العنصر", "هل تريد حذف العنصر المحدد؟", deleteSelected); return; }
});

/* ---------- Boot ---------- */
function boot() {
  renderTemplates(); renderEmojiCats(); renderEmojiGrid();
  let restored = false;
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) { loadState(saved); history = [saved]; future = []; restored = true; }
  } catch (e) { /* ignore */ }
  if (!restored) { history = [serialize()]; }
  syncPanel(); draw();
  if (restored) toast("تم استرجاع مشروعك السابق");
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(() => {}); }
}
boot();
