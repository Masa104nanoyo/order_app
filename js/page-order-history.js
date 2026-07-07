/**
 * 発注履歴画面。
 * 検索（発注番号/発注先/発注日/納期/商品名/品番/製品品番、部分一致）、
 * 閲覧・編集・コピー・PDF再発行への導線を提供する。
 */

const OrderHistoryPage = (function () {
  let currentPage = 1;
  const pageSize = 30;
  let lastSearchParams = {};

  function render(container) {
    container.innerHTML =
      '<h1 class="page-title">発注履歴</h1>' +
      '<div class="card">' +
      '<div class="search-bar">' +
      '<div class="field"><label>キーワード</label><input type="search" id="searchKeyword" placeholder="発注番号・発注先・商品名・品番"></div>' +
      '<div class="field"><label>発注区分</label><select id="searchOrderType"><option value="">すべて</option><option value="MATERIAL">資材発注</option><option value="PROCESSING">製品加工発注</option><option value="FABRIC">生地加工発注</option></select></div>' +
      '<div class="field"><label>発注日(from)</label><input type="date" id="searchDateFrom"></div>' +
      '<div class="field"><label>発注日(to)</label><input type="date" id="searchDateTo"></div>' +
      '<div class="field"><label>納期(from)</label><input type="date" id="searchDueFrom"></div>' +
      '<div class="field"><label>納期(to)</label><input type="date" id="searchDueTo"></div>' +
      '<div class="field"><button class="btn btn--primary" id="btnSearch">検索</button></div>' +
      '</div>' +
      '</div>' +
      '<div class="card" id="resultArea"><div class="empty-state">検索条件を指定して「検索」を押してください（未指定で全件表示）</div></div>';

    document.getElementById('btnSearch').addEventListener('click', function () {
      currentPage = 1;
      runSearch_(container);
    });

    runSearch_(container); // 初期表示: 全件（直近順）
  }

  function runSearch_(container) {
    const params = {
      keyword: document.getElementById('searchKeyword').value,
      order_type: document.getElementById('searchOrderType').value,
      date_from: document.getElementById('searchDateFrom').value,
      date_to: document.getElementById('searchDateTo').value,
      due_from: document.getElementById('searchDueFrom').value,
      due_to: document.getElementById('searchDueTo').value,
      page: currentPage,
      page_size: pageSize
    };
    lastSearchParams = params;

    const resultArea = document.getElementById('resultArea');
    resultArea.innerHTML = '<div class="empty-state"><span class="spinner"></span> 検索中...</div>';

    Api.call('listOrders', params).then(function (data) {
      renderResults_(resultArea, data);
    }).catch(function (err) {
      resultArea.innerHTML = '<div class="empty-state">検索に失敗しました: ' + escapeHtml(err.message) + '</div>';
    });
  }

  function renderResults_(resultArea, data) {
    if (data.items.length === 0) {
      resultArea.innerHTML = '<div class="empty-state">該当する発注書がありません</div>';
      return;
    }

    let html = '<table class="data-table"><thead><tr>' +
      '<th>発注番号</th><th>区分</th><th>発注先</th><th>発注日</th><th>納期</th><th>商品名/品番</th><th>状態</th><th></th>' +
      '</tr></thead><tbody>';

    data.items.forEach(function (o) {
      const def = getOrderTypeDef(o.order_type);
      const statusLabel = { DRAFT: '下書き', ISSUED: '発行済み', CANCELLED: 'キャンセル' }[o.status] || o.status;
      html += '<tr>' +
        '<td class="mono">' + escapeHtml(o.order_id) + '</td>' +
        '<td><span class="type-badge ' + def.badgeClass + '">' + def.label + '</span></td>' +
        '<td>' + escapeHtml(o.supplier_name) + '</td>' +
        '<td>' + escapeHtml(o.order_date) + '</td>' +
        '<td>' + escapeHtml(o.due_date) + '</td>' +
        '<td>' + escapeHtml(o.product_name) + (o.product_sku ? '（' + escapeHtml(o.product_sku) + '）' : '') + '</td>' +
        '<td>' + statusLabel + '</td>' +
        '<td class="btn-row">' +
        '<button class="btn btn--sm" data-open="' + o.order_id + '" data-type="' + o.order_type + '">開く</button>' +
        '<button class="btn btn--sm" data-copy="' + o.order_id + '">コピー</button>' +
        (o.status !== 'CANCELLED' ? '<button class="btn btn--sm btn--danger" data-cancel="' + o.order_id + '">キャンセル</button>' : '') +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';

    const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
    html += '<div class="btn-row" style="margin-top:12px; justify-content:space-between;">' +
      '<span class="text-muted">' + data.total + '件中 ' + ((data.page - 1) * data.page_size + 1) + '〜' + Math.min(data.page * data.page_size, data.total) + '件</span>' +
      '<span class="btn-row">' +
      '<button class="btn btn--sm" id="btnPrevPage"' + (data.page <= 1 ? ' disabled' : '') + '>前へ</button>' +
      '<span>' + data.page + ' / ' + totalPages + '</span>' +
      '<button class="btn btn--sm" id="btnNextPage"' + (data.page >= totalPages ? ' disabled' : '') + '>次へ</button>' +
      '</span>' +
      '</div>';

    resultArea.innerHTML = html;

    resultArea.querySelectorAll('[data-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Router.navigate('order-form', { orderType: btn.getAttribute('data-type'), orderId: btn.getAttribute('data-open') });
      });
    });

    resultArea.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = 'コピー中...';
        Api.call('copyOrder', { source_order_id: btn.getAttribute('data-copy') }).then(function (newOrder) {
          Toast.success('新規発注書としてコピーしました: ' + newOrder.order_id);
          Router.navigate('order-form', { orderType: newOrder.order_type, orderId: newOrder.order_id });
        }).catch(function (e) {
          Toast.error('コピーに失敗しました: ' + e.message);
          btn.disabled = false;
          btn.textContent = 'コピー';
        });
      });
    });

    resultArea.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('この発注書をキャンセル扱いにします。よろしいですか？（削除ではなく履歴には残ります）')) return;
        Api.call('cancelOrder', { order_id: btn.getAttribute('data-cancel') }).then(function () {
          Toast.success('キャンセルしました');
          runSearch_(document.getElementById('mainContent'));
        }).catch(function (e) {
          Toast.error('キャンセル処理に失敗しました: ' + e.message);
        });
      });
    });

    const prevBtn = document.getElementById('btnPrevPage');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      currentPage--;
      runSearch_(document.getElementById('mainContent'));
    });
    const nextBtn = document.getElementById('btnNextPage');
    if (nextBtn) nextBtn.addEventListener('click', function () {
      currentPage++;
      runSearch_(document.getElementById('mainContent'));
    });
  }

  return { render: render };
})();
