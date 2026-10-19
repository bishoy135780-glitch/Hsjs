# YMusic Android

هذه مجلد نسخة Android من YMusic باستخدام Capacitor. الهدف هو إبقاء WebView ومشغل YouTube فعالين عند ضغط Home أو فتح تطبيق آخر أو قفل الشاشة.

## المتطلبات

- Node.js 20 أو أحدث
- Android Studio
- Android SDK وAndroid SDK Platform 35
- Java 17

## إنشاء مشروع Android أول مرة

من داخل هذا المجلد:

```bash
npm install
npm run setup
```

بعدها افتح المشروع:

```bash
npm run open
```

## مزامنة التعديلات وبناء APK تجريبي

```bash
npm run build:debug
```

سيتم إنشاء الملف داخل:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## ملاحظة مهمة عن API

واجهة الموقع تستخدم خادم Express/tRPC للبحث في YouTube. عند تشغيل الواجهة داخل APK، يجب أن يكون خادم المشروع منشورًا على HTTPS، ثم يتم ضبط عنوانه كعنوان API/الموقع قبل البناء. تشغيل الواجهة محليًا داخل APK وحده لا يجعل `/api/trpc` متاحًا على الهاتف.

## حدود الحل

نسخة Android هي التي توفر الاستمرار بعد مغادرة واجهة الموقع، مع صلاحيات `FOREGROUND_SERVICE_MEDIA_PLAYBACK` و`WAKE_LOCK` وإشعار الوسائط. إغلاق التطبيق بالقوة من إعدادات النظام قد يوقف الصوت، وهذا سلوك أمني من Android ولا يمكن للتطبيق تجاوزه.
