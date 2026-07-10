/**
 * マスタ管理画面。
 * タブ: 取引先（発注先・納品先 統合） / 資材マスタ / 自社製品マスタ
 * 取引先タブにはmyBridgeインポート機能を含む。会社ごとに住所・TELを1組だけ持ち、
 * 発注書上は「発注先」でも「納品先」でもこの同じマスタから検索・選択する。
 */

const MasterPage = (function () {
  let activeTab = 'partners';

  function render(container) {
    container.innerHTML =
      '<h1 class="page-title">マスタ管理</h1>' +
      '<div class="tabs">' +
      tabButton_('partners', '取引先（発注先・納品先）') +
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
    if (activeTab === 'partners') return renderPartnersTab_(el);
    if (activeTab === 'materials') return renderMaterialsTab_(el);
    if (activeTab === 'products') return renderProductsTab_(el);
  }

  // ==================== 取引先タブ（発注先・納品先 統合） ====================

  function renderPartnersTab_(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="card__title">myBridgeインポート</div>' +
      '<p class="text-muted">myBridgeから出力したxlsxファイルを取り込み、取引先マスタに一括登録します。名刺単位で担当者が登録されます（住所・TELは会社単位で別途この画面から登録・編集してください）。</p>' +
      '<input type="file" id="myBridgeFile" accept=".xlsx">' +
      '<button class="btn btn--primary btn--sm" id="btnImportMyBridge" style="margin-left:8px;">インポート実行</button>' +
      '<div id="importResult" style="margin-top:10px;"></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card__title">取引先を新規登録</div>' +
      '<p class="text-muted">発注先としても納品先としても、この1件のマスタから選択できます。納品先として使う場合は住所・TELの入力をお願いします。</p>' +
      '<div class="form-grid">' +
      '<div><label>会社名</label><input type="text" id="newPartnerName"></div>' +
      '<div><label>住所</label><input type="text" id="newPartnerAddress"></div>' +
      '<div><label>TEL</label><input type="text" id="newPartnerTel"></div>' +
      '<div style="align-self:end;"><button class="btn btn--primary" id="btnCreatePartner">登録</button></div>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card__title">取引先一覧</div>' +
      '<input type="search" id="partnerSearch" placeholder="会社名で検索" style="max-width:280px; margin-bottom:10px;">' +
      '<div id="partnerList"><div class="empty-state"><span class="spinner"></span> 読み込み中...</div></div>' +
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
          resultEl.innerHTML = '取込完了: 新規取引先 ' + data.created_suppliers + '件 / 新規担当者 ' + data.created_contacts + '件' +
            (data.skipped_rows > 0 ? ' / スキップ ' + data.skipped_rows + '件' : '');
          Toast.success('myBridgeインポートが完了しました');
          loadPartnerList_('');
        }).catch(function (err) {
          resultEl.textContent = '';
          Toast.error('インポートに失敗しました: ' + err.message);
        });
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btnCreatePartner').addEventListener('click', function () {
      const payload = {
        company_name: document.getElementById('newPartnerName').value.trim(),
        address: document.getElementById('newPartnerAddress').value.trim(),
        tel: document.getElementById('newPartnerTel').value.trim()
      };
      if (!payload.company_name) { Toast.error('会社名を入力してください'); return; }
      Api.call('createBusinessPartner', payload).then(function () {
        Toast.success('登録しました');
        document.getElementById('newPartnerName').value = '';
        document.getElementById('newPartnerAddress').value = '';
        document.getElementById('newPartnerTel').value = '';
        loadPartnerList_('');
      }).catch(function (e) { Toast.error('登録に失敗しました: ' + e.message); });
    });

    document.getElementById('partnerSearch').addEventListener('input', function (ev) {
      loadPartnerList_(ev.target.value);
    });

    loadPartnerList_('');
  }

  function loadPartnerList_(keyword) {
    const listEl = document.getElementById('partnerList');
    Api.call('listBusinessPartners', { keyword: keyword }).then(function (data) {
      if (data.items.length === 0) {
        listEl.innerHTML = '<div class="empty-state">該当する取引先がありません</div>';
        return;
      }
      let html = '<table class="data-table"><thead><tr><th>会社名</th><th>住所</th><th>TEL</th><th>最近使用</th><th>登録元</th><th></th></tr></thead><tbody>';
      data.items.forEach(function (s) {
        html += '<tr>' +
          '<td>' + escapeHtml(s.company_name) + '</td>' +
          '<td>' + (s.address ? escapeHtml(s.address) : '<span class="text-muted">未登録</span>') + '</td>' +
          '<td>' + (s.tel ? escapeHtml(s.tel) : '<span class="text-muted">未登録</span>') + '</td>' +
          '<td>' + (s.last_used_at ? escapeHtml(s.last_used_at.substring(0, 10)) : '-') + '</td>' +
          '<td>' + (s.source === 'MYBRIDGE' ? 'myBridge' : '手動') + '</td>' +
          '<td class="btn-row">' +
          '<button class="btn btn--sm" data-view-contacts="' + s.partner_id + '">担当者一覧</button>' +
          '<button class="btn btn--sm" data-edit-partner="' + s.partner_id + '" data-address="' + escapeHtml(s.address || '') + '" data-tel="' + escapeHtml(s.tel || '') + '" title="住所・TELを編集します">住所・TEL編集</button>' +
          '</td>' +
          '</tr>' +
          '<tr class="contacts-row" id="contacts-' + s.partner_id + '" style="display:none;"><td colspan="6"></td></tr>' +
          '<tr class="edit-row" id="edit-' + s.partner_id + '" style="display:none;"><td colspan="6"></td></tr>';
      });
      html += '</tbody></table>';
      listEl.innerHTML = html;

      listEl.querySelectorAll('[data-view-contacts]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const partnerId = btn.getAttribute('data-view-contacts');
          const row = document.getElementById('contacts-' + partnerId);
          const cell = row.querySelector('td');
          if (row.style.display === 'table-row') {
            row.style.display = 'none';
            return;
          }
          cell.innerHTML = '読み込み中...';
          row.style.display = 'table-row';
          Api.call('listSupplierContacts', { supplier_id: partnerId }).then(function (data) {
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

      listEl.querySelectorAll('[data-edit-partner]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const partnerId = btn.getAttribute('data-edit-partner');
          const row = document.getElementById('edit-' + partnerId);
          const cell = row.querySelector('td');
          if (row.style.display === 'table-row') {
            row.style.display = 'none';
            return;
          }
          const currentAddress = btn.getAttribute('data-address');
          const currentTel = btn.getAttribute('data-tel');
          cell.innerHTML =
            '<div class="btn-row">' +
            '<input type="text" id="edit_address_' + partnerId + '" placeholder="住所" value="' + currentAddress + '" style="max-width:280px;">' +
            '<input type="text" id="edit_tel_' + partnerId + '" placeholder="TEL" value="' + currentTel + '" style="max-width:160px;">' +
            '<button class="btn btn--primary btn--sm" data-save-partner="' + partnerId + '">保存</button>' +
            '</div>';
          row.style.display = 'table-row';
          document.getElementById('edit_address_' + partnerId).nextElementSibling; // no-op placeholder to keep structure simple
          cell.querySelector('[data-save-partner]').addEventListener('click', function () {
            Api.call('updateBusinessPartner', {
              partner_id: partnerId,
              address: document.getElementById('edit_address_' + partnerId).value,
              tel: document.getElementById('edit_tel_' + partnerId).value
            }).then(function () {
              Toast.success('更新しました');
              loadPartnerList_(document.getElementById('partnerSearch').value);
            }).catch(function (e) { Toast.error('更新に失敗しました: ' + e.message); });
          });
        });
      });
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
      '<div class="card"><div class="card__title">資材マスタ一覧</div>' +
      '<p class="text-muted">品番をクリックすると、サイズ・カラーごとの単価バリエーションを登録・確認できます。</p>' +
      '<input type="search" id="materialSearch" placeholder="品番・品名で検索" style="max-width:280px; margin-bottom:10px;"><div id="materialList"><div class="empty-state"><span class="spinner"></span></div></div></div>';

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
      let html = '<table class="data-table"><thead><tr><th>メーカー</th><th>品番</th><th>資材名</th><th>規格</th><th>単位</th><th class="text-right">標準単価</th><th></th></tr></thead><tbody>';
      data.items.forEach(function (m) {
        html += '<tr>' +
          '<td>' + escapeHtml(m.maker) + '</td>' +
          '<td class="mono">' + escapeHtml(m.material_sku) + '</td>' +
          '<td>' + escapeHtml(m.material_name) + '</td>' +
          '<td>' + escapeHtml(m.spec) + '</td>' +
          '<td>' + escapeHtml(m.default_unit) + '</td>' +
          '<td class="text-right">' + (Number(m.standard_unit_price) || 0).toLocaleString('ja-JP') + '</td>' +
          '<td><button class="btn btn--sm" data-view-variants="' + m.material_id + '">サイズ/カラー別単価</button></td>' +
          '</tr>' +
          '<tr class="variants-row" id="variants-' + m.material_id + '" style="display:none;"><td colspan="7"></td></tr>';
      });
      html += '</tbody></table>';
      listEl.innerHTML = html;

      listEl.querySelectorAll('[data-view-variants]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const materialId = btn.getAttribute('data-view-variants');
          const row = document.getElementById('variants-' + materialId);
          const cell = row.querySelector('td');
          if (row.style.display === 'table-row') {
            row.style.display = 'none';
            return;
          }
          row.style.display = 'table-row';
          renderVariantEditor_(cell, materialId);
        });
      });
    });
  }

  function renderVariantEditor_(cell, materialId) {
    cell.innerHTML = '読み込み中...';
    Api.call('listMaterialVariants', { material_id: materialId }).then(function (data) {
      let html = '<div style="padding:8px 0;">';
      if (data.items.length === 0) {
        html += '<div class="text-muted" style="margin-bottom:8px;">バリエーションはまだ登録されていません（未登録の場合は標準単価が使われます）</div>';
      } else {
        html += '<table class="data-table" style="max-width:500px; margin-bottom:8px;"><thead><tr><th>サイズ</th><th>カラー</th><th class="text-right">単価</th></tr></thead><tbody>' +
          data.items.map(function (v) {
            return '<tr><td>' + escapeHtml(v.size || '（指定なし）') + '</td><td>' + escapeHtml(v.color || '（指定なし）') + '</td><td class="text-right">' + (Number(v.unit_price) || 0).toLocaleString('ja-JP') + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      html += '<div class="btn-row">' +
        '<input type="text" id="variant_size_' + materialId + '" placeholder="サイズ（任意）" style="max-width:120px;">' +
        '<input type="text" id="variant_color_' + materialId + '" placeholder="カラー" style="max-width:140px;">' +
        '<input type="number" id="variant_price_' + materialId + '" placeholder="単価" style="max-width:120px;">' +
        '<button class="btn btn--primary btn--sm" data-add-variant="' + materialId + '">追加</button>' +
        '</div></div>';
      cell.innerHTML = html;

      cell.querySelector('[data-add-variant]').addEventListener('click', function () {
        const color = document.getElementById('variant_color_' + materialId).value.trim();
        const price = Number(document.getElementById('variant_price_' + materialId).value);
        if (!color) { Toast.error('カラーを入力してください'); return; }
        if (!price) { Toast.error('単価を入力してください'); return; }
        Api.call('createMaterialVariant', {
          material_id: materialId,
          size: document.getElementById('variant_size_' + materialId).value.trim(),
          color: color,
          unit_price: price
        }).then(function () {
          Toast.success('バリエーションを追加しました');
          renderVariantEditor_(cell, materialId);
        }).catch(function (e) { Toast.error('追加に失敗しました: ' + e.message); });
      });
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
