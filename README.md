# YMusic

مشغل موسيقى مفتوح المصدر يعتمد على نتائج YouTube، مع نسخة Android تعمل عبر Capacitor ودعم التشغيل في الخلفية.

## محتويات المستودع

- `app/`: سورس التطبيق الكامل React/TypeScript وNode API المحلي.
- `app/android_build/`: مشروع Capacitor وAndroid وخدمة التشغيل في الخلفية.
- `api/`: نسخة API مستقلة جاهزة للنشر على Vercel بدون YouTube API key.
- `releases/Hsjs-YMusic-v1.6.apk`: APK جاهز للتثبيت.
- `ymusic-android (1).zip`: أرشيف كامل للمشروع.

## تشغيل التطبيق محليًا

```bash
cd app
npm install
npm run check
npm test
npm run build
npm start
```

## بناء APK

```bash
cd app/android_build
npm install
npm run build:debug
```

ستجد الملف في `android/app/build/outputs/apk/debug/app-debug.apk`.

## نشر API على Vercel

يمكن نشر مجلد `api` كمشروع Vercel مستقل. الـAPI يدعم مسار tRPC المستخدم في التطبيق:

```text
/api/trpc/youtube.search
/api/trpc/youtube.playlist
/api/trpc/system.health
```

ولا يحتاج إلى YouTube Data API key؛ هو يحلل نتائج YouTube العامة بنفس طريقة المشروع.

## الإصدار الحالي

- App version: `1.6`
- Android versionCode: `7`
- آخر إصلاح: منع تكرار عنوان API داخل طلبات tRPC في Android.

المشروع مفتوح المصدر للاستخدام والتطوير الشخصي.
