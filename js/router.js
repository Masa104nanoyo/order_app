/**
 * 簡易ルーター。URLのハッシュに画面名とパラメータを載せて画面遷移を管理する。
 * 例: #order-form?orderType=MATERIAL&orderId=RL-M-20260707-0001
 */

const Router = (function () {
  const pages = {
    'dashboard': { label: 'ダッシュボード', render: function (c) { return DashboardPage.render(c); } },
    'order-form': { label: '発注書作成', render: function (c, p) { return OrderFormPage.render(c, p); } },
    'order-history': { label: '発注履歴', render: function (c) { return OrderHistoryPage.render(c); } },
    'master': { label: 'マスタ管理', render: function (c) { return MasterPage.render(c); } }
  };

  function parseHash() {
    const hash = window.location.hash.replace(/^#/, '');
    const [pageName, queryStr] = hash.split('?');
    const params = {};
    if (queryStr) {
      queryStr.split('&').forEach(function (pair) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { pageName: pageName || 'dashboard', params: params };
  }

  function buildHash(pageName, params) {
    const query = Object.keys(params || {})
      .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return '#' + pageName + (query ? '?' + query : '');
  }

  function navigate(pageName, params, replace) {
    const hash = buildHash(pageName, params);
    if (replace) {
      history.replaceState(null, '', hash);
      renderCurrent_();
    } else {
      window.location.hash = hash;
    }
  }

  function renderCurrent_() {
    const { pageName, params } = parseHash();
    const page = pages[pageName] || pages['dashboard'];

    document.querySelectorAll('.sidenav__link').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-page') === pageName);
    });

    const container = document.getElementById('mainContent');
    page.render(container, params);
  }

  function init() {
    document.querySelectorAll('.sidenav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        navigate(link.getAttribute('data-page'), {});
      });
    });
    window.addEventListener('hashchange', renderCurrent_);
    renderCurrent_();
  }

  return { navigate: navigate, init: init };
})();
