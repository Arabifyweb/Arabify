# Arabify — دليل المرحلة الأولى وخارطة الطريق

## ما الذي تم بناؤه فعليًا في هذه المرحلة

بنية موقع متعدد الصفحات (بدل ملف واحد)، بهوية Arabify نفسها (الأسود + تدرج
ذهبي/برتقالي، خط Tajawal/Cairo)، تعمل بالكامل على GitHub Pages بدون أي سيرفر:

| الملف | الوظيفة |
|---|---|
| `index.html` | الصفحة الرئيسية: Hero + أقسام Masonry (الأحدث/الأكثر شعبية/مميزة) |
| `explore.html` | استكشاف Pinterest-style مع فلاتر تصنيف + Infinite scroll |
| `editor.html` | **محرر Arabify الأصلي كما هو تمامًا** (لم تُحذف أي ميزة) + زر "نشر" جديد |
| `project.html` | صفحة مشروع فردي: إعجاب/حفظ/مشاركة/تعليقات/مشابهة |
| `profile.html` | ملف مستخدم عام: تبويبات مشاريع/محفوظات/إعجابات + متابعة |
| `dashboard.html` | لوحة تحكم بعد تسجيل الدخول: إحصائيات + مشاريعك |
| `saved.html` | المجموعات (Collections) والمحفوظات |
| `settings.html` | الحساب/الملف الشخصي/المظهر/الخصوصية/الإشعارات |
| `notifications.html` | صفحة الإشعارات |
| `css/tokens.css` | نظام تصميم مشترك (Dark/Light، أزرار، بطاقات، Modals، Toasts، Masonry) |
| `js/app.js` | منطق الواجهة المشترك: الثيم، القوائم، الإشعارات المؤقتة، تغذية Masonry |
| `js/supabase-client.js` | **هيكل جاهز** لتسجيل الدخول عبر Google وSupabase (يحتاج مفاتيحك) |
| `db/schema.sql` | **قاعدة بيانات كاملة وجاهزة للتشغيل**: مستخدمون، مشاريع، إعجابات، حفظ، متابعة، تعليقات، إشعارات، بلاغات — مع Row Level Security و Triggers للعدّادات |

⚠️ **مهم:** كل بيانات المشاريع الظاهرة الآن (الصور، الأسماء، الأرقام) هي
بيانات تجريبية (mock) مولّدة في `js/app.js` لعرض التصميم والتفاعل فقط.
لا يوجد Backend متصل بعد.

---

## خطوات ربط Backend حقيقي (تأخذ ~20-30 دقيقة)

### 1) أنشئ مشروع Supabase
1. اذهب إلى https://supabase.com → أنشئ حسابًا ومشروعًا جديدًا (مجاني).
2. من **SQL Editor** الصق محتوى `db/schema.sql` كاملاً واضغط Run.
3. من **Storage** أنشئ Bucket باسم `project-images` وآخر باسم `avatars`، واجعلهما Public.
4. من **Project Settings → API** انسخ `Project URL` و `anon public key`.

### 2) فعّل تسجيل الدخول بـ Google
1. في [Google Cloud Console](https://console.cloud.google.com) أنشئ OAuth Client ID (نوع Web application).
2. أضف كـ Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. انسخ Client ID و Client Secret.
4. في Supabase: **Authentication → Providers → Google** — الصق القيمتين وفعّل المزوّد.

### 3) اربط المفاتيح بالكود
افتح `js/supabase-client.js` وعدّل:
```js
export const CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  GOOGLE_CLIENT_ID: "xxxx.apps.googleusercontent.com",
};
```
لا تضع مفتاح `service_role` هنا أبدًا — فقط `anon key` (آمن للـ frontend لأن RLS مفعّل).

### 4) انشر على GitHub Pages كالمعتاد
لا حاجة لأي تغيير في إعدادات GitHub Pages — الموقع بأكمله ملفات ثابتة، وكل التواصل مع القاعدة يتم مباشرة من المتصفح عبر PostgREST/Supabase JS SDK.

---

## خارطة الطريق المتبقية (بصراحة تامة)

ما بنيته هو **الأساس الكامل** (تصميم + هيكلة + قاعدة بيانات جاهزة)، لكن ربط
كل صفحة فعليًا بالبيانات الحقيقية بدل mock هو عمل إضافي يحتاج تنفيذًا
تدريجيًا لأن كل جزء يحتاج اختبارًا حقيقيًا مع حساب Supabase فعلي (لا أملك
حسابًا لأختبر عليه بدلاً منك). الخطوات المتبقية بالترتيب المقترح:

1. **ربط تسجيل الدخول الفعلي** — استبدال المحاكاة في `app.js` باستدعاءات `supabase-client.js` الحقيقية بعد إدخال مفاتيحك.
2. **ربط `editor.html` بالنشر الفعلي** — حفظ `design_json` وصورة PNG مُصدَّرة في جدول `projects` (مكان الـ TODO موجود بالفعل في كود زر النشر).
3. **استبدال `generateMockProjects` باستعلامات Supabase حقيقية** في `app.js` (استعلام واحد فقط يتغير، الواجهة جاهزة).
4. **صفحات ديناميكية حقيقية** لـ `project.html?id=` و `profile.html?username=` بدل mock حالي.
5. **البحث الفعلي** عبر `to_tsvector` المُجهّز مسبقًا في `schema.sql`.
6. **Sitemap ديناميكي** يُولَّد من قاعدة البيانات (Edge Function أو GitHub Action مجدول).

أنا جاهز للبدء في أي بند من هذه فور تجهيزك لحساب Supabase — فقط أخبرني.
