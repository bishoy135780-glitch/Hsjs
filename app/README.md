# YMusic

مشغّل موسيقى من YouTube بتصميم شبيه Spotify (واجهة عربية RTL، موبايل + ديسكتوب).

## التشغيل

```bash
npm install        # أو pnpm install
npm run dev        # تطوير: http://localhost:3000 (حدّث الصفحة بعد التعديل)
npm run build      # بناء الإنتاج
npm start          # تشغيل الإنتاج
npm test           # اختبارات الـ API والسيرفر
npm run check      # فحص TypeScript
```

على Termux: `pkg install nodejs` ثم نفس الأوامر.

## المميزات

- الرئيسية: شرائح، شبكة وصول سريع، رفوف أغاني تتحمّل عند الوصول إليها.
- بحث: اقتراحات أثناء الكتابة، سجل بحث، 12 تصنيف بصفحات خاصة.
- مشغّل مصغّر + مشغّل كامل (عشوائي، تكرار، قائمة انتظار، وضع الفيديو، شريط تقدم) + التحكم من إشعارات الجهاز.
- المكتبة: الأغاني المفضلة، قوائم تشغيل، استيراد قوائم YouTube، آخر ما شغّلته. كله محفوظ في المتصفح.
- ديسكتوب: سايدبار + شريط مشغّل سفلي + مسافة (Space) للإيقاف/التشغيل.

## الهيكل

- `server/youtube.ts` منطق YouTube (بحث، قوائم، اقتراحات + كاش) — مصدر واحد للسيرفر المحلي ولـ Vercel.
- `server/api.ts` مسارات `/api/search|playlist|suggest|health`.
- `server/index.ts` سيرفر Node بدون أي مكتبات.
- `api/index.ts` نقطة دخول Vercel.
- `client/src` واجهة React (بدون مكتبات إضافية غير React).

## النشر

- Docker: `docker build -t ymusic . && docker run -p 3000:3000 ymusic`
- Vercel: يشتغل مباشرة (`vercel.json` جاهز).

## ملاحظة

يعتمد على واجهات YouTube الداخلية (بدون API key). لو يوتيوب غيّرها أو حظر الـ IP، عدّل `server/youtube.ts`
(يمكن ضبط `YT_CLIENT_VERSION` كمتغير بيئة).

## Android
`android_build/` wraps this app with Capacitor. Run `npm run build`, then in `android_build/`: `npm install && npm run setup && npm run build:debug`.
The APK talks to the API at `PUBLIC_API_BASE_URL` in `client/src/config.ts` — **redeploy this project to Vercel first** so the API matches.
Playback problems? Tap the avatar → Diagnostics shows what the YouTube player reports.
