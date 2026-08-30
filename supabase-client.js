/* ==========================================================================
   Arabify — Supabase client & auth scaffold
   -----------------------------------------------------------------------
   هذا الملف "جاهز للربط" — لا يعمل فعليًا حتى تملأ SUPABASE_URL و
   SUPABASE_ANON_KEY و GOOGLE_CLIENT_ID أدناه بقيمك الحقيقية.
   لا تضع أبدًا service_role key هنا — anon key فقط آمن للـ frontend،
   بشرط تفعيل Row Level Security (انظر db/schema.sql).
   ========================================================================== */

// ⚠️ عدّل هذه القيم بعد إنشاء مشروعك على supabase.com وربط Google OAuth
export const CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
  GOOGLE_CLIENT_ID: "YOUR-GOOGLE-CLIENT-ID.apps.googleusercontent.com",
};

const CONFIGURED =
  !CONFIG.SUPABASE_URL.includes("YOUR-PROJECT") &&
  !CONFIG.SUPABASE_ANON_KEY.includes("YOUR-ANON");

let supabase = null;

/** يحمّل Supabase JS SDK من CDN ويهيّئ العميل (مرة واحدة فقط) */
export async function getSupabase() {
  if (!CONFIGURED) return null;
  if (supabase) return supabase;
  const mod = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = mod.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return supabase;
}

export function isBackendConfigured() {
  return CONFIGURED;
}

/** تسجيل الدخول عبر Google (Supabase Auth + Google Identity Services) */
export async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) throw new Error("NOT_CONFIGURED");
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/dashboard.html" },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const sb = await getSupabase();
  if (!sb) throw new Error("NOT_CONFIGURED");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password, username) {
  const sb = await getSupabase();
  if (!sb) throw new Error("NOT_CONFIGURED");
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function getCurrentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.user ?? null;
}

/* ==========================================================================
   ملاحظة معمارية:
   - عند أول تسجيل دخول (Google أو Email)، يجب إنشاء صف في جدول public.profiles
     تلقائيًا. أفضل مكان لذلك هو Postgres trigger على auth.users (موجود في
     db/schema.sql: handle_new_user) بدل الاعتماد على كود الواجهة، حتى يعمل
     الإنشاء حتى لو فشل الفرونت إند في استدعاء لاحق.
   - كل عمليات القراءة/الكتابة على projects/likes/saves/follows... تمر عبر
     PostgREST مباشرة من المتصفح، ومحمية بسياسات RLS في db/schema.sql —
     لا حاجة لسيرفر Backend منفصل طالما GitHub Pages يستضيف فقط ملفات ثابتة.
   ========================================================================== */
