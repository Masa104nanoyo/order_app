/**
 * ダッシュボード画面。
 * 新規発注へのショートカットと、最近の発注履歴を表示する。
 */

const DashboardPage = (function () {
  function render(container) {
    container.innerHTML =
      '<h1 class="page-title">ダッシュボード</h1>' +
      '<div class="card">' +
      '<div class="card__title">新規発注</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn--primary" data-new="MATERIAL">資材発注を作成</button>' +
      '<button class="btn btn--primary" data-new="PROCESSING">製品加工発注を作成</button>' +
      '<button class="btn btn--primary" data-new="FABRIC">生地加工発注を作成</button>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card__title">最近の発注履歴</div>' +
      '<div id="recentOrders"><div class="empty-state"><span class="spinner"></span> 読み込み中...</div></div>' +
      '</div>';

    container.querySelectorAll('[data-new]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Router.navigate('order-form', { orderType: btn.getAttribute('data-new') });
      });
    });

    Api.call('listOrders', { page: 1, page_size: 10 }).then(function (data) {
      const el = document.getElementById('recentOrders');
      if (data.items.length === 0) {
        el.innerHTML = '<div class="empty-state">まだ発注履歴がありません</div>';
        return;
      }
      el.innerHTML = '<table class="data-table"><thead><tr><th>発注番号</th><th>区分</th><th>発注先</th><th>発注日</th><th>状態</th><th></th></tr></thead><tbody>' +
        data.items.map(function (o) {
          const def = getOrderTypeDef(o.order_type);
          const statusLabel = { DRAFT: '下書き', ISSUED: '発行済み', CANCELLED: 'キャンセル' }[o.status] || o.status;
          return '<tr>' +
            '<td class="mono">' + escapeHtml(o.order_id) + '</td>' +
            '<td><span class="type-badge ' + def.badgeClass + '">' + def.label + '</span></td>' +
            '<td>' + escapeHtml(o.supplier_name) + '</td>' +
            '<td>' + escapeHtml(o.order_date) + '</td>' +
            '<td>' + statusLabel + '</td>' +
            '<td><button class="btn btn--sm" data-open="' + o.order_id + '" data-type="' + o.order_type + '">開く</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table>';

      el.querySelectorAll('[data-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Router.navigate('order-form', { orderType: btn.getAttribute('data-type'), orderId: btn.getAttribute('data-open') });
        });
      });
    });
  }

  return { render: render };
})();
