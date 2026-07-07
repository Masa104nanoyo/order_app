/**
 * マスタ管理画面。
 * タブ: 発注先 / 納品先 / 資材マスタ / 自社製品マスタ
 * 発注先タブにはmyBridgeインポート機能を含む。
 */

const MasterPage = (function () {
  let activeTab = 'suppliers';

  function render(container) {
    container.innerHTML =
      '<h1 class="page-title">マスタ管理</h1>' +
      '<div class="tabs">' +
      tabButton_('suppliers', '発注先') +
      tabButton_('deliveryPoints', '納品先') +
      tabButton_('materials', '資材マスタ') +
      tabButton_('products', '自社製品マスタ') +
      '</div>' +
      '<div id="tabContent"></div>';

    container.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTab = btn.getAttribute('data-tab');
        render(container);
      });
    });

    renderTabContent_(document.getElementById('tabContent'));
  }

  function tabButton_(key, label) {
    return '<button class="tab' + (activeTab === key ? ' is-active' : '') + '" data-tab="' + key + '">' + label + '</button>';
  }

  function renderTabContent_(el) {
    if (activeTab === 'suppliers') return renderSuppliersTab_(el);
    if (activeTab === 'deliveryPoints') return renderDeliveryPointsTab_(el);
    if (activeTab === 'materials') return renderMaterialsTab_(el);
    if (activeTab === 'products') return renderProductsTab_(el);
  }

  // ==================== 発注先タブ ====================

  function renderSuppliersTab_(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="card__title">myBridgeインポート</div>' +
      '<p class="text-muted">myBridgeから出力したxlsxファイルを取り込み、発注先マスタに一括登録します。名刺単位で登録されるため、同じ会社に複数の担当者がいる場合はそれぞれ登録されます。</p>' +
      '<input type="file" id="myBridgeFile" accept=".xlsx">' +
      '<button class="btn btn--primary btn--sm" id="btnImportMyBridge" style="margin-left:8px;">インポート実行</button>' +
      '<div id="importResult" style="margin-top:10px;"></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card__title">発注先を新規登録</div>' +
      '<div class="form-grid">' +
      '<div><label>会社名</label><input type="text" id="newSupplierName"></div>' +
      '<div style="align-self:end;"><button class="btn btn--primary" id="btnCreateSupplier">登録</button></div>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card__title">発注先一覧</div>' +
      '<input type="search" id="supplierSearch" placeholder="会社名で検索" style="max-width:280px; margin-bottom:10px;">' +
      '<div id="supplierList"><div class="empty-state"><span class="spinner"></span> 読み込み中...</div></div>' +
      '</div>';

    document.getElementById('btnImportMyBridge').addEventListener('click', function () {
      const fileInput = document.getElementById('myBridgeFile');
      const file = fileInput.files[0];
      if (!file) { Toast.error('ファイルを選択してください'); return; }
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = reader.result.split(',')[1];
        const resultEl = document.getElementById('importResult');
        resultEl.textContent = 'インポート中...';
        Api.call('importMyBridge', { file_base64: base64, file_name: file.name }).then(function (data) {
          resultEl.innerHTML = '取込完了: 新規発注先 ' + data.created_suppliers + '件 / 新規担当者 ' + data.created_contacts + '件' +
            (data.skipped_rows > 0 ? ' / スキップ ' + data.skipped_rows + '件' : '');
          Toast.success('myBridgeインポートが完了しました');
          loadSupplierList_('');
        }).catch(function (err) {
          resultEl.textContent = '';
          Toast.error('インポートに失敗しました: ' + err.message);
        });
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btnCreateSupplier').addEventListener('click', function () {
      const name = document.getElementById('newSupplierName').value.trim();
      if (!name) { Toast.error('会社名を入力してください'); return; }
      Api.call('createSupplier', { company_name: name }).then(function () {
        Toast.success('登録しました');
        document.getElementById('newSupplierName').value = '';
        loadSupplierList_('');
      }).catch(function (e) { Toast.error('登録に失敗しました: ' + e.message); });
    });

    document.getElementById('supplierSearch').addEventListener('input', function (ev) {
      loadSupplierList_(ev.target.value);
    });

    loadSupplierList_('');
  }

  function loadSupplierList_(keyword) {
    const listEl = document.getElementById('supplierList');
    Api.call('listSuppliers', { keyword: keyword }).then(function (data) {
      if (data.items.length === 0) {
        listEl.innerHTML = '<div class="empty-state">該当する発注先がありません</div>';
        return;
      }
      let html = '<table class="data-table"><thead><tr><th>会社名</th><th>最近使用</th><th>直近90日利用回数</th><th>登録元</th><th></th></tr></thead><tbody>';
      data.items.forEach(function (s) {
        html += '<tr>' +
          '<td>' + escapeHtml(s.company_name) + '</td>' +
          '<td>' + (s.last_used_at ? escapeHtml(s.last_used_at.substring(0, 10)) : '-') + '</td>' +
          '<td>' + s.usage_count_90d + '</td>' +
          '<td>' + (s.source === 'MYBRIDGE' ? 'myBridge' : '手動') + '</td>' +
          '<td><button class="btn btn--sm" data-view-contacts="' + s.supplier_id + '">担当者一覧</button></td>' +
          '</tr>' +
          '<tr class="contacts-row" id="contacts-' + s.supplier_id + '" style="display:none;"><td colspan="5"></td></tr>';
      });
      html += '</tbody></table>';
      listEl.innerHTML = html;

      listEl.querySelectorAll('[data-view-contacts]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const supplierId = btn.getAttribute('data-view-contacts');
          const row = document.getElementById('contacts-' + supplierId);
          const cell = row.querySelector('td');
          if (row.style.display === 'table-row') {
            row.style.display = 'none';
            return;
          }
          cell.innerHTML = '読み込み中...';
          row.style.display = 'table-row';
          Api.call('listSupplierContacts', { supplier_id: supplierId }).then(function (data) {
            if (data.items.length === 0) {
              cell.innerHTML = '<span class="text-muted">担当者が登録されていません</span>';
              return;
            }
            cell.innerHTML = data.items.map(function (c) {
              return '<div style="padding:4px 0; border-bottom:1px solid #eee;">' +
                '<strong>' + escapeHtml(c.contact_name) + '</strong>' +
                (c.title ? '（' + escapeHtml(c.title) + '）' : '') +
                ' ' + escapeHtml(c.department || '') +
                '<br><span class="text-muted">' + escapeHtml(c.email || '') + ' / ' + escapeHtml(c.tel || '') + '</span>' +
                '</div>';
            }).join('');
          });
        });
      });
    });
  }

  // ==================== 納品先タブ ====================

  function renderDeliveryPointsTab_(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="card__title">納品先を新規登録</div>' +
      '<div class="form-grid">' +
      '<div><label>会社名</label><input type="text" id="dp_company_name"></div>' +
      '<div><label>担当者</label><input type="text" id="dp_contact_name"></div>' +
      '<div><label>住所</label><input type="text" id="dp_address"></div>' +
      '<div><label>TEL</label><input type="text" id="dp_tel"></div>' +
      '</div>' +
      '<div style="margin-top:10px;"><button class="btn btn--primary" id="btnCreateDeliveryPoint">登録</button></div>' +
      '</div>' +
      '<div class="card"><div class="card__title">納品先一覧</div><div id="deliveryPointList"><div class="empty-state"><span class="spinner"></span></div></div></div>';

    document.getElementById('btnCreateDeliveryPoint').addEventListener('click', function () {
      const payload = {
        company_name: document.getElementById('dp_company_name').value.trim(),
        contact_name: document.getElementById('dp_contact_name').value.trim(),
        address: document.getElementById('dp_address').value.trim(),
        tel: document.getElementById('dp_tel').value.trim()
      };
      if (!payload.company_name) { Toast.error('会社名を入力してください'); return; }
      Api.call('createDeliveryPoint', payload).then(function () {
        Toast.success('登録しました');
        renderDeliveryPointsTab_(el);
      }).catch(function (e) { Toast.error('登録に失敗しました: ' + e.message); });
    });

    Api.call('listDeliveryPoints', {}).then(function (data) {
      const listEl = document.getElementById('deliveryPointList');
      if (data.items.length === 0) { listEl.innerHTML = '<div class="empty-state">登録がありません</div>'; return; }
      listEl.innerHTML = '<table class="data-table"><thead><tr><th>会社名</th><th>担当者</th><th>住所</th><th>TEL</th></tr></thead><tbody>' +
        data.items.map(function (d) {
          return '<tr><td>' + escapeHtml(d.company_name) + '</td><td>' + escapeHtml(d.contact_name) + '</td><td>' + escapeHtml(d.address) + '</td><td>' + escapeHtml(d.tel) + '</td></tr>';
        }).join('') + '</tbody></table>';
    });
  }

  // ==================== 資材マスタタブ ====================

  function renderMaterialsTab_(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="card__title">資材マスタを新規登録</div>' +
      '<div class="form-grid">' +
      '<div><label>メーカー</label><input type="text" id="mat_maker"></div>' +
      '<div><label>資材品番</label><input type="text" id="mat_sku"></div>' +
      '<div><label>資材名</label><input type="text" id="mat_name"></div>' +
      '<div><label>規格</label><input type="text" id="mat_spec"></div>' +
      '<div><label>標準単位</label><input type="text" id="mat_unit"></div>' +
      '<div><label>標準単価</label><input type="number" id="mat_price"></div>' +
      '</div>' +
      '<div style="margin-top:10px;"><button class="btn btn--primary" id="btnCreateMaterial">登録</button></div>' +
      '</div>' +
      '<div class="card"><div class="card__title">資材マスタ一覧</div><input type="search" id="materialSearch" placeholder="品番・品名で検索" style="max-width:280px; margin-bottom:10px;"><div id="materialList"><div class="empty-state"><span class="spinner"></span></div></div></div>';

    document.getElementById('btnCreateMaterial').addEventListener('click', function () {
      const payload = {
        maker: document.getElementById('mat_maker').value.trim(),
        material_sku: document.getElementById('mat_sku').value.trim(),
        material_name: document.getElementById('mat_name').value.trim(),
        spec: document.getElementById('mat_spec').value.trim(),
        default_unit: document.getElementById('mat_unit').value.trim(),
        standard_unit_price: Number(document.getElementById('mat_price').value) || 0
      };
      if (!payload.material_sku) { Toast.error('資材品番を入力してください'); return; }
      Api.call('createMaterial', payload).then(function () {
        Toast.success('登録しました');
        loadMaterialList_('');
      }).catch(function (e) { Toast.error('登録に失敗しました: ' + e.message); });
    });

    document.getElementById('materialSearch').addEventListener('input', function (ev) { loadMaterialList_(ev.target.value); });
    loadMaterialList_('');
  }

  function loadMaterialList_(keyword) {
    Api.call('listMaterials', { keyword: keyword }).then(function (data) {
      const listEl = document.getElementById('materialList');
      if (data.items.length === 0) { listEl.innerHTML = '<div class="empty-state">該当する資材がありません</div>'; return; }
      listEl.innerHTML = '<table class="data-table"><thead><tr><th>メーカー</th><th>品番</th><th>資材名</th><th>規格</th><th>単位</th><th class="text-right">標準単価</th></tr></thead><tbody>' +
        data.items.map(function (m) {
          return '<tr><td>' + escapeHtml(m.maker) + '</td><td class="mono">' + escapeHtml(m.material_sku) + '</td><td>' + escapeHtml(m.material_name) + '</td><td>' + escapeHtml(m.spec) + '</td><td>' + escapeHtml(m.default_unit) + '</td><td class="text-right">' + (Number(m.standard_unit_price) || 0).toLocaleString('ja-JP') + '</td></tr>';
        }).join('') + '</tbody></table>';
    });
  }

  // ==================== 自社製品マスタタブ ====================

  function renderProductsTab_(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="card__title">自社製品マスタを新規登録</div>' +
      '<div class="form-grid">' +
      '<div><label>製品品番</label><input type="text" id="prd_sku"></div>' +
      '<div><label>製品名</label><input type="text" id="prd_name"></div>' +
      '<div><label>品質/混率</label><input type="text" id="prd_ratio" placeholder="例: C-100%"></div>' +
      '<div><label>規格</label><input type="text" id="prd_spec"></div>' +
      '</div>' +
      '<div style="margin-top:10px;"><button class="btn btn--primary" id="btnCreateProduct">登録</button></div>' +
      '</div>' +
      '<div class="card"><div class="card__title">自社製品マスタ一覧</div><input type="search" id="productSearch" placeholder="品番・品名で検索" style="max-width:280px; margin-bottom:10px;"><div id="productList"><div class="empty-state"><span class="spinner"></span></div></div></div>';

    document.getElementById('btnCreateProduct').addEventListener('click', function () {
      const payload = {
        product_sku: document.getElementById('prd_sku').value.trim(),
        product_name: document.getElementById('prd_name').value.trim(),
        material_ratio: document.getElementById('prd_ratio').value.trim(),
        spec: document.getElementById('prd_spec').value.trim()
      };
      if (!payload.product_sku) { Toast.error('製品品番を入力してください'); return; }
      Api.call('createProduct', payload).then(function () {
        Toast.success('登録しました');
        loadProductList_('');
      }).catch(function (e) { Toast.error('登録に失敗しました: ' + e.message); });
    });

    document.getElementById('productSearch').addEventListener('input', function (ev) { loadProductList_(ev.target.value); });
    loadProductList_('');
  }

  function loadProductList_(keyword) {
    Api.call('listProducts', { keyword: keyword }).then(function (data) {
      const listEl = document.getElementById('productList');
      if (data.items.length === 0) { listEl.innerHTML = '<div class="empty-state">該当する製品がありません</div>'; return; }
      listEl.innerHTML = '<table class="data-table"><thead><tr><th>品番</th><th>製品名</th><th>品質/混率</th><th>規格</th></tr></thead><tbody>' +
        data.items.map(function (p) {
          return '<tr><td class="mono">' + escapeHtml(p.product_sku) + '</td><td>' + escapeHtml(p.product_name) + '</td><td>' + escapeHtml(p.material_ratio) + '</td><td>' + escapeHtml(p.spec) + '</td></tr>';
        }).join('') + '</tbody></table>';
    });
  }

  return { render: render };
})();
