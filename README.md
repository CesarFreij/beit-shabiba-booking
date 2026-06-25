# حجوزات بيت الشبيبة

نظام حجز غرف بيت الشبيبة يعمل باللغة العربية بالكامل ويدعم RTL وواجهة موبايل أولاً.

## هيكل الملفات

- `index.html` - صفحة الحجز الرئيسية
- `admin.html` - صفحة لوحة الأدمن
- `style.css` - أنماط التصميم والـ RTL
- `app.js` - منطق واجهة الحجز وإدارة الجدول
- `admin.js` - منطق لوحة الأدمن وتعديل الحجوزات
- `config.js` - إعدادات التطبيق مثل كلمة المرور وقائمة الغرف
- `firebase-config.js.example` - مثال إعدادات Firebase
- `README.md` - دليل الإعداد والتشغيل

## كيفية إعداد Firebase

### 1. إنشاء مشروع Firebase جديد

1. افتح https://console.firebase.google.com
2. اضغط على "إضافة مشروع" أو "Create project".
3. املأ اسم المشروع واختر الدولة، ثم اضغط "متابعة".
4. تابع الخطوات حتى انتهاء إنشاء المشروع.

### 2. تفعيل Firestore

1. في لوحة Firebase، اختر "Firestore Database".
2. اضغط "إنشاء قاعدة بيانات".
3. اختر الوضع التجريبي أو وضع الإنتاج.
4. حدد المنطقة الأقرب لك ثم اضغط إنشاء.

### 3. تفعيل Firebase Authentication

1. في لوحة Firebase، اختر "Authentication".
2. اذهب إلى تبويب "طرق تسجيل الدخول" أو "Sign-in method".
3. فعّل طريقة "Email/Password".
4. احفظ التغييرات.

### 4. إعداد `firebase-config.js`

1. انسخ الملف `firebase-config.js.example` وسمّه `firebase-config.js`.
2. افتح الملف واملأ القيم التالية بالمعلومات الخاصة بمشروعك:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

مثال:
```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### 5. تغيير كلمة المرور المشتركة

كلمة المرور المستخدمة للدخول إلى صفحة الحجز موجودة في ملف `config.js`:

```js
export const BOOKING_PASSWORD = 'بيت1234!';
```

يمكنك تعديلها لأي قيمة تريدها.

## إنشاء حساب الأدمن

1. اذهب إلى Firebase Console.
2. اختر "Authentication" ثم تبويب "Users".
3. اضغط "Add user".
4. ضع البريد الإلكتروني وكلمة المرور الخاصة بالأدمن.
5. استخدم هذه البيانات للدخول إلى `admin.html`.

## تشغيل المشروع في VS Code باستخدام Live Server

1. افتح المجلد `c:\Users\USER\Desktop\ai` في VS Code.
2. تأكد من تثبيت إضافة Live Server.
3. اضغط زر "Go Live" في شريط الحالة أو انقر بزر الفأرة الأيمن على `index.html` واختر "Open with Live Server".
4. افتح أيضًا `admin.html` بنفس الطريقة للوصول إلى لوحة الأدمن.

## نشر المشروع مجانًا

### Firebase Hosting

1. ثبت Firebase CLI إذا لم يكن مثبتًا:
   ```bash
   npm install -g firebase-tools
   ```
2. سجل الدخول إلى Firebase:
   ```bash
   firebase login
   ```
3. داخل المجلد المشروع، ابدأ إعداد الاستضافة:
   ```bash
   firebase init hosting
   ```
4. اختر المشروع، وحدد المجلد `.` كمجلد للنشر.
5. بعد ذلك، نشر المشروع:
   ```bash
   firebase deploy
   ```

### GitHub Pages

1. ادفع الملفات إلى مستودع GitHub.
2. فعّل GitHub Pages من إعدادات المستودع.
3. اختر الفرع الرئيسي (`main` أو `master`) كمصدر.
4. سيتم نشر الموقع تلقائيًا.

> ملاحظة: إذا استخدمت GitHub Pages، تأكد من أن `firebase-config.js` موجود في المستودع أو أضف نفس معلومات Firebase ضمن `firebase-config.js`.

## قواعد أمان Firestore المقترحة

في قسم قواعد Firestore، استخدم القواعد التالية لتحسين الأمان:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bookings/{bookingId} {
      allow read: if true;
      allow create: if request.auth == null || request.auth != null;
      allow update, delete: if request.auth != null;
    }

    match /notifications/{notificationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }

    match /settings/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## ملاحظة حول قواعد الأمان

- هذه القواعد تجعل الحجز قابلًا للقراءة للجميع.
- التعديل والحذف مقصور للأدمن فقط عند استخدام Firebase Auth.
- إذا كنت تحتاج تحكمًا أدق، فعّل حقل `role` في بيانات المستخدم واحقق منه في القواعد.

## نصائح إضافية

- تأكد من إنشاء ملف `firebase-config.js` قبل فتح الموقع.
- إذا أردت تغيير الغرف، عدّل المصفوفة في `config.js`.
- إذا أردت تحسين قواعد الأمان، أضف شرطًا على `request.auth.uid` وحقول الرول.

بالتوفيق! كان هذا المشروع معدًا ليعمل كنظام حجوزات عملي وجاهز للاستخدام الفوري.
