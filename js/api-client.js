/**
 * GAS Web App との通信を担うAPIクライアント。
 * デプロイURLは api-config.js で設定する（環境ごとに差し替えやすくするため分離）。
 */

const Api = (function () {
  function call(action, params) {
    params = params || {};
    const body = Object.assign({ action: action }, params);

    return fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS側のContent-Type制約回避のためtext/plainで送りJSON.parseする
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) {
          throw new Error(json.error || '不明なエラーが発生しました');
        }
        return json.data;
      });
  }

  return { call: call };
})();
