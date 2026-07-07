/**
 * 画面右上に一時的なメッセージを表示するトースト通知。
 */
const Toast = (function () {
  function ensureContainer() {
    let el = document.querySelector('.toast-container');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, type) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast--' + type : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 4000);
  }

  return {
    success: function (msg) { show(msg, 'success'); },
    error: function (msg) { show(msg, 'error'); },
    info: function (msg) { show(msg, ''); }
  };
})();
