/**
 * 発注書作成画面の下書き自動保存（localStorage）を担うモジュール。
 *
 * 要件:
 * - 入力途中でブラウザを閉じても復元できる
 * - 復元するかどうかをユーザーが選べる
 * - サーバー保存前の内容であることが分かる
 * - 正式なサーバー保存は「保存」ボタンで行う（ここでは一切GAS通信をしない）
 */

const DraftStore = (function () {
  const PREFIX = 'orderapp_draft_';

  function keyFor(orderType, orderIdOrNew) {
    return PREFIX + orderType + '_' + (orderIdOrNew || 'new');
  }

  function save(orderType, orderIdOrNew, formState) {
    const key = keyFor(orderType, orderIdOrNew);
    const payload = {
      saved_at: new Date().toISOString(),
      form_state: formState
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return payload.saved_at;
  }

  function load(orderType, orderIdOrNew) {
    const key = keyFor(orderType, orderIdOrNew);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clear(orderType, orderIdOrNew) {
    localStorage.removeItem(keyFor(orderType, orderIdOrNew));
  }

  return { save: save, load: load, clear: clear };
})();
