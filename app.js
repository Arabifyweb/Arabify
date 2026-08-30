/* ==========================================================================
   Arabify — Shared app runtime (navbar, theme, toasts, modals, mock feed)
   يُحمَّل في كل صفحة عدا المحرر (الذي يحتفظ بمنطقه القديم كما هو).
   ========================================================================== */
import { isBackendConfigured, getCurrentUser, signInWithGoogle, signOut } from "./supabase-client.js";

/* ---------------- Toasts ---------------- */
let toastStack;
export function toast(msg, type = "ok") {
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.appendChild(toastStack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------------- Generic modal open/close ---------------- */
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-modal-open]");
  if (opener) {
    const id = opener.getAttribute("data-modal-open");
    document.getElementById(id)?.classList.add("open");
  }
  const closer = e.target.closest("[data-modal-close]");
  if (closer) {
    closer.closest(".modal-backdrop")?.classList.remove("open");
  }
  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
  }
});

/* ---------------- Auth-aware navbar ---------------- */
async function renderAuthState() {
  const guestSlot = document.getElementById("navGuest");
  const userSlot = document.getElementById("navUser");
  if (!guestSlot || !userSlot) return;

  if (!isBackendConfigured()) {
    // لا يوجد Backend متصل بعد — أظهر واجهة الضيف دائمًا
    guestSlot.style.display = "flex";
    userSlot.style.display = "none";
    return;
  }
  const user = await getCurrentUser();
  if (user) {
    guestSlot.style.display = "none";
    userSlot.style.display = "flex";
    const avatar = document.getElementById("navAvatarImg");
    if (avatar) avatar.src = user.user_metadata?.avatar_url || "assets/default-avatar.svg";
  } else {
    guestSlot.style.display = "flex";
    userSlot.style.display = "none";
  }
}
renderAuthState();

document.addEventListener("click", async (e) => {
  if (e.target.closest("#googleSignInBtn")) {
    if (!isBackendConfigured()) {
      toast("لم يتم ربط Supabase/Google بعد — راجع README لإكمال الإعداد.", "err");
      return;
    }
    try { await signInWithGoogle(); }
    catch { toast("تعذر تسجيل الدخول. حاول مجددًا.", "err"); }
  }
  if (e.target.closest("#logoutBtn")) {
    await signOut();
    toast("تم تسجيل الخروج");
    setTimeout(() => location.reload(), 600);
  }
  if (e.target.closest("#navMenuToggle")) {
    document.getElementById("navUserMenu")?.classList.toggle("open");
  }
});

/* ---------------- Mock feed data ----------------
   بيانات تجريبية لعرض الواجهة فقط. عند ربط Supabase، استبدل loadFeed()
   باستعلام فعلي على جدول public.projects (انظر db/schema.sql). */
const CATEGORIES = ["الكل", "خط عربي", "زخرفة أسماء", "اقتباسات", "قيمنق", "سوشيال ميديا", "شعارات", "خلفيات", "إيموجي"];
const MOCK_NAMES = ["سلمى.", "يوسف بن علي", "نور الهدى", "Team Arabify", "خالد.d", "ريم ✦", "Design.sa", "أحمد التصميم"];

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateMockProjects(count, offset = 0) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const idx = offset + i;
    const rnd = seedRandom(idx + 7);
    const h = 220 + Math.floor(rnd() * 240);
    const w = 300;
    const bg1 = ["#ffb000", "#ff5566", "#39e08a", "#7c6bff", "#00c2ff", "#ff7a00"][idx % 6];
    const bg2 = ["#0d1016", "#161a26", "#08090d"][idx % 3];
    items.push({
      id: "demo-" + idx,
      title: ["زخرفة اسم قيمنق", "شعار متجر", "اقتباس ملهم", "خلفية عيد", "اسم ديسكورد ذهبي", "بوست انستغرام"][idx % 6],
      owner: MOCK_NAMES[idx % MOCK_NAMES.length],
      likes: Math.floor(rnd() * 900) + 12,
      views: (Math.floor(rnd() * 12) + 1) + "." + Math.floor(rnd() * 9) + "K",
      w, h,
      category: CATEGORIES[(idx % (CATEGORIES.length - 1)) + 1],
      bg1, bg2,
    });
  }
  return items;
}

function svgPlaceholder(p) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`)}`;
}

export function projectCardHTML(p) {
  return `
  <article class="card" data-id="${p.id}" tabindex="0">
    <img src="${svgPlaceholder(p)}" width="${p.w}" height="${p.h}" alt="${p.title}" loading="lazy">
    <div class="card-overlay">
      <div class="card-top-actions">
        <button class="card-chip save-btn" title="حفظ" aria-label="حفظ">🔖</button>
        <button class="card-chip share-btn" title="مشاركة" aria-label="مشاركة">↗</button>
      </div>
      <div class="card-bottom">
        <p class="card-title">${p.title}</p>
        <div class="card-meta">
          <img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.owner)}" alt="">
          <span>${p.owner}</span>
          <span class="card-stats">❤ ${p.likes} · 👁 ${p.views}</span>
        </div>
      </div>
    </div>
  </article>`;
}

export function skeletonCardsHTML(n = 10) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const h = 180 + ((i * 53) % 220);
    out += `<div class="skeleton skeleton-card" style="height:${h}px"></div>`;
  }
  return out;
}

/** يملأ أي حاوية .masonry ببيانات تجريبية مع محاكاة تحميل + Infinite scroll */
export function mountMasonryFeed(containerEl, { category = null, pageSize = 16 } = {}) {
  let offset = 0;
  let loading = false;
  containerEl.innerHTML = skeletonCardsHTML(pageSize);

  async function loadMore() {
    if (loading) return;
    loading = true;
    await new Promise((r) => setTimeout(r, 450)); // محاكاة زمن شبكة
    let batch = generateMockProjects(pageSize, offset);
    if (category && category !== "الكل") batch = batch.filter((p) => p.category === category);
    if (offset === 0) containerEl.innerHTML = "";
    containerEl.insertAdjacentHTML("beforeend", batch.map(projectCardHTML).join(""));
    offset += pageSize;
    loading = false;
  }

  loadMore();

  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }, { rootMargin: "600px" });
  const sentinel = document.createElement("div");
  containerEl.after(sentinel);
  io.observe(sentinel);

  containerEl.addEventListener("click", (e) => {
    const saveBtn = e.target.closest(".save-btn");
    if (saveBtn) {
      e.stopPropagation();
      saveBtn.classList.toggle("saved");
      saveBtn.textContent = saveBtn.classList.contains("saved") ? "✔" : "🔖";
      toast(saveBtn.classList.contains("saved") ? "تم الحفظ في مجموعاتك" : "تم إلغاء الحفظ");
      return;
    }
    const shareBtn = e.target.closest(".share-btn");
    if (shareBtn) {
      e.stopPropagation();
      navigator.clipboard?.writeText(location.origin + "/project.html?id=" + shareBtn.closest(".card").dataset.id);
      toast("تم نسخ رابط المشروع");
      return;
    }
    const card = e.target.closest(".card");
    if (card) location.href = "project.html?id=" + card.dataset.id;
  });

  return { reload(newCategory) { offset = 0; category = newCategory; loadMore(); } };
}

export { CATEGORIES };
