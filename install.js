// نمایش دکمه نصب PWA
let deferredPrompt;
const installButton = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  // جلوگیری از نمایش خودکار پیام نصب
  e.preventDefault();
  // ذخیره رویداد برای استفاده بعدی
  deferredPrompt = e;
  // نمایش دکمه نصب
  installButton.style.display = 'block';
  
  installButton.addEventListener('click', () => {
    // نمایش پیام نصب
    deferredPrompt.prompt();
    // بررسی انتخاب کاربر
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('کاربر نصب را پذیرفت');
      } else {
        console.log('کاربر نصب را رد کرد');
      }
      deferredPrompt = null;
    });
  });
});

// بررسی اینکه آیا اپلیکیشن نصب شده است
window.addEventListener('appinstalled', () => {
  console.log('PWA نصب شد');
  installButton.style.display = 'none';
  deferredPrompt = null;
});