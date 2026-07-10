/**
 * 発注書作成画面（新規作成・編集共通）。
 *
 * 優先事項: 入力しやすさ。Excelライクな明細グリッド編集、Tab/Enter移動、
 * オートコンプリート、行操作（追加/削除/コピー/並び替え）、下書きの自動復元。
 */

const OrderFormPage = (function () {
  let state = {
    orderType: 'MATERIAL',
    orderId: null,        // サーバー確定済みならorder_id、未確定ならnull
    isNew: true,
    header: {},            // 発注日・発注先・発注者・納期・納品先など
    projectInfo: {},
    remarks: {},
    lines: [],
    attachments: [],
    masters: { partners: [], employees: [], materials: [], products: [] },
    serverUpdatedAt: null,
    localSavedAt: null
  };

  let autoSaveTimer = null;

  function render(container, params) {
    state.orderType = (params && params.orderType) || 'MATERIAL';
    state.orderId = (params && params.orderId) || null;
    state.isNew = !state.orderId;

    container.innerHTML = '<div class="empty-state"><span class="spinner"></span> 読み込み中...</div>';

    Promise.all([
      Api.call('listBusinessPartners', {}),
      Api.call('listEmployees', {}),
      state.orderId ? Api.call('getOrder', { order_id: state.orderId }) : Promise.resolve(null)
    ]).then(function (results) {
      state.masters.partners = results[0].items;
      state.masters.employees = results[1].items;

      if (results[2]) {
        applyOrderToState_(results[2]);
      } else {
        resetStateForNew_(state.orderType);
      }

      renderForm_(container);
      maybeShowRestoreBanner_(container);
      startAutoSave_();
    }).catch(function (err) {
      container.innerHTML = '<div class="empty-state">読み込みに失敗しました: ' + escapeHtml(err.message) + '</div>';
    });
  }

  function resetStateForNew_(orderType) {
    state.header = {
      order_date: todayStr_(),
      supplier_id: '',
      supplier_contact_id: '',
      employee_id: '',
      due_date: '',
      delivery_point_id: ''
    };
    state.projectInfo = {};
    state.remarks = {};
    state.lines = [getOrderTypeDef(orderType).emptyLine()];
    state.attachments = [];
    state.serverUpdatedAt = null;
  }

  function applyOrderToState_(order) {
    state.orderType = order.order_type;
    state.orderId = order.order_id;
    state.isNew = false;
    state.header = {
      order_date: order.order_date,
      supplier_id: order.supplier_id,
      supplier_contact_id: order.supplier_contact_id,
      employee_id: order.employee_id,
      due_date: order.due_date,
      delivery_point_id: order.delivery_point_id
    };
    state.projectInfo = order.project_info || {};
    state.remarks = order.remarks || {};
    state.lines = (order.lines && order.lines.length) ? order.lines : [getOrderTypeDef(order.order_type).emptyLine()];
    state.attachments = order.attachments || [];
    state.serverUpdatedAt = order.updated_at;
    state.pdfFileUrl = order.pdf_file_url;
    state.status = order.status;
  }

  function todayStr_() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function draftKey_() {
    return state.orderId || 'new';
  }

  // ------------------------------------------------------------------
  // 下書き自動保存（localStorage）
  // ------------------------------------------------------------------

  function startAutoSave_() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(function () {
      persistLocalDraft_();
    }, 15000); // 15秒ごと。入力停止時にも都度保存する（inputイベント側でも呼ぶ）
  }

  function persistLocalDraft_() {
    const formState = {
      orderType: state.orderType,
      header: state.header,
      projectInfo: state.projectInfo,
      remarks: state.remarks,
      lines: state.lines
    };
    const savedAt = DraftStore.save(state.orderType, draftKey_(), formState);
    state.localSavedAt = savedAt;
    updateDraftStatusDisplay_();
  }

  function updateDraftStatusDisplay_() {
    const el = document.getElementById('draftStatus');
    if (!el) return;
    if (state.localSavedAt && (!state.serverUpdatedAt || state.localSavedAt > state.serverUpdatedAt)) {
      el.className = 'draft-status draft-status--local';
      el.innerHTML = '<span class="draft-status__dot"></span>ブラウザに自動保存済み（未サーバー保存）最終: ' + formatTime_(state.localSavedAt);
    } else if (state.serverUpdatedAt) {
      el.className = 'draft-status draft-status--saved';
      el.innerHTML = '<span class="draft-status__dot"></span>サーバー保存済み ' + formatTime_(state.serverUpdatedAt);
    } else {
      el.className = 'draft-status';
      el.innerHTML = '';
    }
  }

  function formatTime_(iso) {
    try {
      const d = new Date(iso);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    } catch (e) {
      return iso;
    }
  }

  function maybeShowRestoreBanner_(container) {
    const draft = DraftStore.load(state.orderType, draftKey_());
    if (!draft) return;

    // サーバー内容より新しいローカル下書きがある場合のみ復元を促す
    if (state.serverUpdatedAt && draft.saved_at <= state.serverUpdatedAt) return;

    const banner = document.createElement('div');
    banner.className = 'restore-banner';
    banner.innerHTML =
      '<span>ブラウザに未保存の変更が残っています（' + formatTime_(draft.saved_at) + ' 時点）。復元しますか？</span>' +
      '<span class="btn-row">' +
      '<button class="btn btn--primary btn--sm" id="restoreYes">復元する</button>' +
      '<button class="btn btn--sm" id="restoreNo">破棄する</button>' +
      '</span>';
    const formRoot = container.querySelector('.order-form-root');
    formRoot.insertBefore(banner, formRoot.firstChild);

    document.getElementById('restoreYes').addEventListener('click', function () {
      state.header = draft.form_state.header;
      state.projectInfo = draft.form_state.projectInfo;
      state.remarks = draft.form_state.remarks;
      state.lines = draft.form_state.lines;
      state.localSavedAt = draft.saved_at;
      banner.remove();
      renderForm_(container);
      Toast.info('ブラウザの下書きを復元しました');
    });
    document.getElementById('restoreNo').addEventListener('click', function () {
      DraftStore.clear(state.orderType, draftKey_());
      banner.remove();
    });
  }

  // ------------------------------------------------------------------
  // 描画
  // ------------------------------------------------------------------

  function renderForm_(container) {
    const def = getOrderTypeDef(state.orderType);

    container.innerHTML =
      '<div class="order-form-root">' +
      '<h1 class="page-title">' +
      '<span class="type-badge ' + def.badgeClass + '">' + def.label + '</span>' +
      (state.orderId ? '<span class="mono">' + state.orderId + '</span>' : '<span class="text-muted">未採番（保存時に自動採番）</span>') +
      '</h1>' +

      (state.isNew ? renderOrderTypeSwitcher_() : '') +

      '<div class="card">' +
      '<div class="card__title">基本情報</div>' +
      renderHeaderFields_(def) +
      '</div>' +

      '<div class="card">' +
      '<div class="card__title">案件情報</div>' +
      renderProjectInfoFields_(def) +
      '</div>' +

      '<div class="card">' +
      '<div class="card__title">明細</div>' +
      renderLinesTable_(def) +
      '</div>' +

      '<div class="card">' +
      '<div class="card__title">添付資料（加工指示書・見本画像など）</div>' +
      renderAttachments_() +
      '</div>' +

      '<div class="card">' +
      '<div class="card__title">備考・注意事項</div>' +
      renderRemarksFields_(def) +
      '</div>' +

      '<div class="card">' +
      '<div class="btn-row" style="justify-content: space-between;">' +
      '<span id="draftStatus" class="draft-status"></span>' +
      '<span class="btn-row">' +
      '<button class="btn" id="btnPreview">印刷イメージを確認</button>' +
      '<button class="btn btn--primary" id="btnSave">保存</button>' +
      (state.orderId ? '<button class="btn btn--primary" id="btnIssuePdf">PDF発行</button>' : '') +
      (state.orderId && state.pdfFileUrl ? '<button class="btn" id="btnMailCompose">メール作成</button>' : '') +
      '</span>' +
      '</div>' +
      '</div>' +

      '</div>';

    bindHeaderEvents_(container);
    bindProjectInfoEvents_(container, def);
    bindLinesEvents_(container, def);
    bindRemarksEvents_(container, def);
    bindAttachmentEvents_(container);
    bindActionButtons_(container);
    updateDraftStatusDisplay_();
  }

  function renderOrderTypeSwitcher_() {
    const types = ['MATERIAL', 'PROCESSING', 'FABRIC'];
    return '<div class="btn-row" style="margin-bottom:12px;">' +
      types.map(function (t) {
        const def = getOrderTypeDef(t);
        const active = t === state.orderType ? ' btn--primary' : '';
        return '<button class="btn' + active + '" data-switch-type="' + t + '">' + def.label + '</button>';
      }).join('') +
      '</div>';
  }

  /**
   * 汎用: マスタ検索オートコンプリート付きテキスト入力をバインドする。
   * ドロップダウン選択に加えて、部分一致した候補をリスト表示し選択できるようにする。
   * fetchFn(keyword) -> Promise<items[]>、renderLabelFn(item) -> 表示文字列、onSelectFn(item) -> 選択時の処理。
   */
  function attachMasterAutocomplete_(inputEl, fetchFn, renderLabelFn, onSelectFn) {
    let box = null;
    let debounceTimer = null;

    function removeBox_() {
      if (box) { box.remove(); box = null; }
    }

    function showSuggestions_(items) {
      removeBox_();
      if (!items || items.length === 0) return;
      box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.background = '#fff';
      box.style.border = '1px solid #ccc';
      box.style.zIndex = '200';
      box.style.maxHeight = '200px';
      box.style.overflowY = 'auto';
      box.style.fontSize = '13px';
      box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      const rect = inputEl.getBoundingClientRect();
      box.style.left = (rect.left + window.scrollX) + 'px';
      box.style.top = (rect.bottom + window.scrollY) + 'px';
      box.style.width = Math.max(rect.width, 260) + 'px';

      items.slice(0, 12).forEach(function (item) {
        const line = document.createElement('div');
        line.style.padding = '6px 8px';
        line.style.cursor = 'pointer';
        line.style.borderBottom = '1px solid #f0f0f0';
        line.textContent = renderLabelFn(item);
        line.addEventListener('mouseenter', function () { line.style.background = '#F5F6F8'; });
        line.addEventListener('mouseleave', function () { line.style.background = '#fff'; });
        line.addEventListener('mousedown', function (ev) {
          ev.preventDefault(); // blurより先にmousedownを処理させ、候補選択を確実にする
          onSelectFn(item);
          removeBox_();
        });
        box.appendChild(line);
      });
      document.body.appendChild(box);
    }

    inputEl.addEventListener('input', function () {
      const keyword = inputEl.value;
      clearTimeout(debounceTimer);
      if (!keyword) { removeBox_(); return; }
      debounceTimer = setTimeout(function () {
        fetchFn(keyword).then(showSuggestions_);
      }, 200);
    });
    inputEl.addEventListener('focus', function () {
      if (inputEl.value) fetchFn(inputEl.value).then(showSuggestions_);
    });
    inputEl.addEventListener('blur', function () {
      setTimeout(removeBox_, 150);
    });
  }

  function renderHeaderFields_(def) {
    const employeeOptions = state.masters.employees.map(function (e) {
      return '<option value="' + e.employee_id + '"' + (e.employee_id === state.header.employee_id ? ' selected' : '') + '>' + escapeHtml(e.employee_name) + '</option>';
    }).join('');

    const currentSupplier = state.masters.partners.find(function (s) { return s.partner_id === state.header.supplier_id; });
    const currentDelivery = state.masters.partners.find(function (d) { return d.partner_id === state.header.delivery_point_id; });

    return '<div class="form-grid">' +
      '<div><label>発注日</label><input type="date" id="f_order_date" value="' + (state.header.order_date || '') + '"></div>' +
      '<div><label>希望納期</label><input type="date" id="f_due_date" value="' + (state.header.due_date || '') + '"></div>' +
      '<div style="position:relative;"><label>発注先（入力すると候補が出ます）</label>' +
      '<input type="text" id="f_supplier_search" value="' + escapeHtml(currentSupplier ? currentSupplier.company_name : '') + '" placeholder="会社名を入力" autocomplete="off">' +
      '<input type="hidden" id="f_supplier_id" value="' + (state.header.supplier_id || '') + '">' +
      '</div>' +
      '<div><label>発注先担当者</label><select id="f_supplier_contact_id"><option value="">（発注先を選択後に表示）</option></select></div>' +
      '<div><label>発注者</label><select id="f_employee_id"><option value="">選択してください</option>' + employeeOptions + '</select></div>' +
      '<div style="position:relative;"><label>納品先（入力すると候補が出ます）</label>' +
      '<input type="text" id="f_delivery_search" value="' + escapeHtml(currentDelivery ? currentDelivery.company_name : '') + '" placeholder="会社名を入力" autocomplete="off">' +
      '<input type="hidden" id="f_delivery_point_id" value="' + (state.header.delivery_point_id || '') + '">' +
      '</div>' +
      '</div>';
  }

  function renderProjectInfoFields_(def) {
    const hasProductSku = def.projectInfoFields.some(function (f) { return f.key === 'product_sku'; });
    let html = '<div class="form-grid">' +
      def.projectInfoFields.map(function (f) {
        const val = state.projectInfo[f.key] || '';
        if (f.type === 'select') {
          const opts = f.options.map(function (o) {
            return '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + o + '</option>';
          }).join('');
          return '<div><label>' + f.label + '</label><select data-pi-field="' + f.key + '"><option value="">未選択</option>' + opts + '</select></div>';
        }
        const autocompleteAttr = f.key === 'product_sku' ? ' data-pi-autocomplete="product"' : '';
        return '<div><label>' + f.label + '</label><input type="text" data-pi-field="' + f.key + '" value="' + escapeHtml(val) + '" placeholder="' + (f.placeholder || '') + '"' + autocompleteAttr + '></div>';
      }).join('') +
      '</div>';
    if (hasProductSku && state.orderType !== 'MATERIAL') {
      html += '<div style="margin-top:10px;"><button class="btn btn--sm" id="btnRegisterProduct" title="現在入力中の製品品番・製品名を自社製品マスタに登録します">この製品をマスタに登録</button></div>';
    }
    return html;
  }

  function renderRemarksFields_(def) {
    let html = def.remarksFields.map(function (f) {
      const val = state.remarks[f.key] || '';
      return '<div style="margin-bottom:10px;"><label>' + f.label + '</label><textarea rows="2" data-remarks-field="' + f.key + '">' + escapeHtml(val) + '</textarea></div>';
    }).join('');

    if (state.orderType === 'MATERIAL' || state.orderType === 'FABRIC') {
      html += '<div class="card" style="background:#F5F6F8; border-style:dashed;">' +
        '<div class="text-muted" style="font-size:12.5px; margin-bottom:4px;">以下はPDFに自動で印字されます（入力不要）</div>' +
        '<div>生地の表裏は必ず分かるように表示してください。</div>' +
        '<div>※出荷明細を出荷日に必ずFAXまたは担当者にメール連絡をお願い致します。</div>' +
        '<div>※出荷伝票/請求伝票に必ず本発注書下部の使用品番と発注No.を明記して下さい。</div>' +
        '</div>';
    }

    return html;
  }

  function renderLinesTable_(def) {
    const cols = def.lineColumns;
    let html = '<div style="overflow-x:auto;"><table class="data-table" id="linesTable"><thead><tr>' +
      '<th style="width:28px;"></th><th style="width:36px;">No.</th>' +
      cols.map(function (c) { return '<th style="width:' + c.width + '">' + c.label + '</th>'; }).join('') +
      '<th style="width:60px;"></th>' +
      '</tr></thead><tbody>';

    state.lines.forEach(function (line, idx) {
      const registerBtn = state.orderType === 'MATERIAL'
        ? '<button class="btn btn--sm" data-register-material="' + idx + '" title="この行の資材品番・資材名・規格・単位・標準単価を資材マスタに登録します">マスタ登録</button>'
        : '';
      html += '<tr draggable="true" data-line-idx="' + idx + '">' +
        '<td class="drag-handle" title="ドラッグで並び替え">⠿</td>' +
        '<td>' + (idx + 1) + '</td>' +
        cols.map(function (c) { return renderLineCell_(c, line, idx, def); }).join('') +
        '<td class="btn-row">' + registerBtn + '<button class="btn btn--sm" data-copy-line="' + idx + '" title="複製">複製</button><button class="btn btn--sm btn--danger" data-delete-line="' + idx + '" title="削除">削除</button></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>' +
      '<div style="margin-top:8px;"><button class="btn btn--sm" id="btnAddLine">＋ 行を追加</button></div>' +
      '<div class="text-right" style="margin-top:8px; font-weight:700;">合計金額: ' + formatNumber_(sumAmount_()) + ' 円</div>';
    return html;
  }

  function sumAmount_() {
    return state.lines.reduce(function (sum, l) { return sum + (Number(l.amount) || 0); }, 0);
  }

  function renderLineCell_(col, line, idx, def) {
    if (col.type === 'computed') {
      const val = line[col.key] || 0;
      return '<td class="text-right mono" data-computed-line="' + idx + '" data-computed-key="' + col.key + '">' + formatNumber_(val) + '</td>';
    }
    if (col.type === 'size_grid') {
      let sizeQty = {};
      try { sizeQty = JSON.parse(line.size_qty_json || '{}'); } catch (e) { sizeQty = {}; }
      const sizes = def.sizeLabels || [];
      const inputs = sizes.map(function (s) {
        return '<span style="display:inline-flex;align-items:center;gap:2px;margin-right:6px;">' +
          '<span class="text-muted">' + s + '</span>' +
          '<input type="number" style="width:48px;" data-size-line="' + idx + '" data-size-key="' + s + '" value="' + (sizeQty[s] || '') + '">' +
          '</span>';
      }).join('');
      return '<td>' + inputs + '</td>';
    }
    const val = line[col.key] !== undefined ? line[col.key] : '';
    const autocompleteAttr = col.autocomplete ? ' data-autocomplete="' + col.autocomplete + '"' : '';
    return '<td><input type="' + (col.type === 'number' ? 'number' : 'text') + '" data-line-field="' + idx + '" data-field-key="' + col.key + '" value="' + escapeHtml(val) + '"' + autocompleteAttr + '></td>';
  }

  function renderAttachments_() {
    let html = '';
    if (!state.orderId) {
      html += '<div class="restore-banner" style="margin-bottom:10px;"><span>先に画面下部の「保存」を押して発注番号を確定すると、添付ファイルをアップロードできるようになります。</span></div>';
    }
    html += '<div class="btn-row" style="margin-bottom:10px;">' +
      '<input type="file" id="attachmentInput" accept="image/*,application/pdf" ' + (state.orderId ? '' : 'disabled') + '>' +
      '</div>';
    if (state.attachments.length === 0) {
      html += '<div class="text-muted">添付ファイルはありません</div>';
    } else {
      html += '<div class="btn-row" style="flex-wrap:wrap;">' +
        state.attachments.map(function (a) {
          return '<span class="btn btn--sm" style="cursor:default;">' + escapeHtml(a.file_name) + '</span>';
        }).join('') +
        '</div>';
    }
    return html;
  }

  // ------------------------------------------------------------------
  // イベントバインド
  // ------------------------------------------------------------------

  function bindHeaderEvents_(container) {
    container.querySelectorAll('[data-switch-type]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const newType = btn.getAttribute('data-switch-type');
        if (newType === state.orderType) return;
        state.orderType = newType;
        resetStateForNew_(newType);
        renderForm_(container);
      });
    });

    const simpleFields = ['order_date', 'due_date', 'employee_id'];
    simpleFields.forEach(function (key) {
      const el = document.getElementById('f_' + key);
      if (!el) return;
      el.addEventListener('change', function () {
        state.header[key] = el.value;
        persistLocalDraft_();
      });
    });

    // 発注先: オートコンプリート付きテキスト入力（取引先マスタを検索）
    const supplierSearchEl = document.getElementById('f_supplier_search');
    const supplierIdEl = document.getElementById('f_supplier_id');
    attachMasterAutocomplete_(
      supplierSearchEl,
      function (keyword) { return Api.call('listBusinessPartners', { keyword: keyword }).then(function (d) { return d.items; }); },
      function (item) { return item.company_name + (item.usage_count_90d > 0 ? '（よく使用）' : ''); },
      function (item) {
        supplierSearchEl.value = item.company_name;
        supplierIdEl.value = item.partner_id;
        state.header.supplier_id = item.partner_id;
        state.header.supplier_contact_id = '';
        refreshSupplierContacts_(container);
        persistLocalDraft_();
      }
    );
    // 手入力のみで候補を選ばなかった場合は、確定した会社名として登録できるよう変更を許容する
    // （選択されていなければ supplier_id は空のまま。保存時にバリデーションで検知される）
    supplierSearchEl.addEventListener('input', function () {
      if (supplierSearchEl.value !== (state.masters.partners.find(function (s) { return s.partner_id === supplierIdEl.value; }) || {}).company_name) {
        supplierIdEl.value = '';
        state.header.supplier_id = '';
      }
    });

    // 納品先: オートコンプリート付きテキスト入力（同じ取引先マスタを検索。発注先とは別の会社を選べる）
    const deliverySearchEl = document.getElementById('f_delivery_search');
    const deliveryIdEl = document.getElementById('f_delivery_point_id');
    attachMasterAutocomplete_(
      deliverySearchEl,
      function (keyword) { return Api.call('listBusinessPartners', { keyword: keyword }).then(function (d) { return d.items; }); },
      function (item) { return item.company_name + (item.address ? '（' + item.address + '）' : '（住所未登録）'); },
      function (item) {
        deliverySearchEl.value = item.company_name;
        deliveryIdEl.value = item.partner_id;
        state.header.delivery_point_id = item.partner_id;
        persistLocalDraft_();
      }
    );
    deliverySearchEl.addEventListener('input', function () {
      if (deliverySearchEl.value !== (state.masters.partners.find(function (d) { return d.partner_id === deliveryIdEl.value; }) || {}).company_name) {
        deliveryIdEl.value = '';
        state.header.delivery_point_id = '';
      }
    });

    if (state.header.supplier_id) refreshSupplierContacts_(container);
  }

  function refreshSupplierContacts_(container) {
    const supplierId = state.header.supplier_id;
    const select = document.getElementById('f_supplier_contact_id');
    if (!supplierId) {
      select.innerHTML = '<option value="">（発注先を選択後に表示）</option>';
      return;
    }
    select.innerHTML = '<option value="">読み込み中...</option>';
    Api.call('listSupplierContacts', { supplier_id: supplierId }).then(function (data) {
      const options = data.items.map(function (c) {
        const sel = c.contact_id === state.header.supplier_contact_id ? ' selected' : '';
        return '<option value="' + c.contact_id + '"' + sel + '>' + escapeHtml(c.contact_name) + (c.title ? '（' + escapeHtml(c.title) + '）' : '') + '</option>';
      }).join('');
      select.innerHTML = '<option value="">未選択</option>' + options;
      select.addEventListener('change', function () {
        state.header.supplier_contact_id = select.value;
        persistLocalDraft_();
      });
    });
  }

  function bindProjectInfoEvents_(container, def) {
    container.querySelectorAll('[data-pi-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        state.projectInfo[el.getAttribute('data-pi-field')] = el.value;
        persistLocalDraft_();
      });
    });

    const productSkuEl = container.querySelector('[data-pi-autocomplete="product"]');
    if (productSkuEl) {
      attachMasterAutocomplete_(
        productSkuEl,
        function (keyword) { return Api.call('listProducts', { keyword: keyword }).then(function (d) { return d.items; }); },
        function (item) { return item.product_sku + '　' + item.product_name; },
        function (item) {
          state.projectInfo.product_sku = item.product_sku;
          state.projectInfo.product_name = item.product_name;
          state.projectInfo.material_ratio = item.material_ratio || state.projectInfo.material_ratio;
          persistLocalDraft_();
          renderForm_(container);
        }
      );
    }

    const registerBtn = document.getElementById('btnRegisterProduct');
    if (registerBtn) {
      registerBtn.addEventListener('click', function () {
        const sku = state.projectInfo.product_sku;
        const name = state.projectInfo.product_name;
        if (!sku) { Toast.error('製品品番を入力してください'); return; }
        registerBtn.disabled = true;
        Api.call('createProduct', {
          product_sku: sku,
          product_name: name || '',
          material_ratio: state.projectInfo.material_ratio || ''
        }).then(function () {
          Toast.success('自社製品マスタに登録しました: ' + sku);
          registerBtn.disabled = false;
        }).catch(function (e) {
          Toast.error('登録に失敗しました: ' + e.message);
          registerBtn.disabled = false;
        });
      });
    }
  }

  function bindRemarksEvents_(container, def) {
    container.querySelectorAll('[data-remarks-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        state.remarks[el.getAttribute('data-remarks-field')] = el.value;
        persistLocalDraft_();
      });
    });
  }

  function bindLinesEvents_(container, def) {
    // 通常フィールド
    container.querySelectorAll('[data-line-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const idx = Number(el.getAttribute('data-line-field'));
        const key = el.getAttribute('data-field-key');
        state.lines[idx][key] = el.value;
        def.calcLine(state.lines[idx]);
        persistLocalDraft_();
        refreshComputedCellsOnly_(container, def);
      });
      // Tab/Enterキーでの移動をブラウザデフォルトに任せつつ、Enterで次行の同列に飛ぶ挙動を追加
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          moveFocusToNextRow_(el);
        }
      });
      // オートコンプリート（資材/製品品番）
      if (el.getAttribute('data-autocomplete')) {
        attachAutocomplete_(el, el.getAttribute('data-autocomplete'), def);
      }
      // 資材のカラー欄: 入力確定時（blur）に、資材マスタのサイズ・カラー別単価を自動検索して反映する
      if (state.orderType === 'MATERIAL' && el.getAttribute('data-field-key') === 'color') {
        el.addEventListener('blur', function () {
          const idx = Number(el.getAttribute('data-line-field'));
          const line = state.lines[idx];
          if (!line.material_id) return; // マスタから選んだ資材でなければバリエーション検索はしない
          Api.call('findMaterialPrice', { material_id: line.material_id, color: line.color || '', size: '' })
            .then(function (result) {
              state.lines[idx].unit_price = result.unit_price;
              def.calcLine(state.lines[idx]);
              persistLocalDraft_();
              refreshComputedCellsOnly_(container, def);
              const priceInput = container.querySelector('[data-line-field="' + idx + '"][data-field-key="unit_price"]');
              if (priceInput) priceInput.value = result.unit_price;
              if (result.matched_variant) {
                Toast.info('カラーに応じた単価を自動反映しました');
              }
            })
            .catch(function () { /* バリエーション未登録の資材は無視して手入力単価のまま */ });
        });
      }
    });

    // サイズ別数量グリッド（製品加工発注）
    container.querySelectorAll('[data-size-line]').forEach(function (el) {
      el.addEventListener('input', function () {
        const idx = Number(el.getAttribute('data-size-line'));
        const key = el.getAttribute('data-size-key');
        let sizeQty = {};
        try { sizeQty = JSON.parse(state.lines[idx].size_qty_json || '{}'); } catch (e) { sizeQty = {}; }
        sizeQty[key] = Number(el.value) || 0;
        state.lines[idx].size_qty_json = JSON.stringify(sizeQty);
        def.calcLine(state.lines[idx]);
        persistLocalDraft_();
        refreshComputedCellsOnly_(container, def);
      });
    });

    // 行操作
    const addBtn = document.getElementById('btnAddLine');
    if (addBtn) addBtn.addEventListener('click', function () {
      state.lines.push(def.emptyLine());
      renderForm_(container);
    });

    container.querySelectorAll('[data-register-material]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = Number(btn.getAttribute('data-register-material'));
        const line = state.lines[idx];
        if (!line.material_sku) { Toast.error('資材品番を入力してください'); return; }
        btn.disabled = true;
        Api.call('createMaterial', {
          maker: line.maker || '',
          material_sku: line.material_sku,
          material_name: line.material_name || '',
          spec: line.spec || '',
          default_unit: line.unit || '',
          standard_unit_price: Number(line.unit_price) || 0
        }).then(function (result) {
          state.lines[idx].material_id = result.material_id;
          // カラーが入力されていれば、そのカラーのバリエーション単価としても登録する
          if (line.color) {
            return Api.call('createMaterialVariant', {
              material_id: result.material_id,
              size: '',
              color: line.color,
              unit_price: Number(line.unit_price) || 0
            }).then(function () {
              Toast.success('資材マスタに登録しました（カラー: ' + line.color + ' の単価も登録）: ' + line.material_sku);
            });
          }
          Toast.success('資材マスタに登録しました: ' + line.material_sku);
        }).then(function () {
          btn.disabled = false;
        }).catch(function (e) {
          Toast.error('登録に失敗しました: ' + e.message);
          btn.disabled = false;
        });
      });
    });

    container.querySelectorAll('[data-copy-line]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = Number(btn.getAttribute('data-copy-line'));
        const copy = Object.assign({}, state.lines[idx]);
        delete copy.line_id;
        state.lines.splice(idx + 1, 0, copy);
        renderForm_(container);
      });
    });

    container.querySelectorAll('[data-delete-line]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = Number(btn.getAttribute('data-delete-line'));
        if (state.lines.length <= 1) {
          Toast.error('明細は最低1行必要です');
          return;
        }
        if (!confirm('この行を削除しますか？')) return;
        state.lines.splice(idx, 1);
        renderForm_(container);
      });
    });

    bindDragReorder_(container, def);
  }

  function refreshComputedCellsOnly_(container, def) {
    // 入力中のフォーカスを飛ばさないよう、DOM全体は再描画せず、
    // 金額など計算結果のセルと合計金額表示だけをピンポイントで書き換える。
    def.lineColumns.forEach(function (col) {
      if (col.type !== 'computed') return;
      state.lines.forEach(function (line, idx) {
        const cell = container.querySelector('[data-computed-line="' + idx + '"][data-computed-key="' + col.key + '"]');
        if (cell) cell.textContent = formatNumber_(line[col.key] || 0);
      });
    });

    const totalEl = container.querySelector('.text-right[style*="font-weight:700"]');
    if (totalEl) totalEl.textContent = '合計金額: ' + formatNumber_(sumAmount_()) + ' 円';
  }

  function moveFocusToNextRow_(currentEl) {
    const key = currentEl.getAttribute('data-field-key');
    const idx = Number(currentEl.getAttribute('data-line-field'));
    const next = document.querySelector('[data-line-field="' + (idx + 1) + '"][data-field-key="' + key + '"]');
    if (next) next.focus();
  }

  function bindDragReorder_(container, def) {
    const tbody = container.querySelector('#linesTable tbody');
    if (!tbody) return;
    let dragSrcIdx = null;

    tbody.querySelectorAll('tr').forEach(function (row) {
      row.addEventListener('dragstart', function () {
        dragSrcIdx = Number(row.getAttribute('data-line-idx'));
        row.classList.add('is-dragging');
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('is-dragging');
      });
      row.addEventListener('dragover', function (ev) { ev.preventDefault(); });
      row.addEventListener('drop', function () {
        const targetIdx = Number(row.getAttribute('data-line-idx'));
        if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
        const moved = state.lines.splice(dragSrcIdx, 1)[0];
        state.lines.splice(targetIdx, 0, moved);
        renderForm_(container);
      });
    });
  }

  function attachAutocomplete_(inputEl, kind, def) {
    let box = null;
    inputEl.addEventListener('input', function () {
      const keyword = inputEl.value;
      if (!keyword) { removeBox_(); return; }
      const action = kind === 'material' ? 'listMaterials' : 'listProducts';
      Api.call(action, { keyword: keyword }).then(function (data) {
        showSuggestions_(data.items, kind);
      });
    });
    inputEl.addEventListener('blur', function () {
      setTimeout(removeBox_, 150); // クリック選択を許すための遅延
    });

    function removeBox_() {
      if (box) { box.remove(); box = null; }
    }

    function showSuggestions_(items, kind) {
      removeBox_();
      if (!items || items.length === 0) return;
      box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.background = '#fff';
      box.style.border = '1px solid #ccc';
      box.style.zIndex = '100';
      box.style.maxHeight = '160px';
      box.style.overflowY = 'auto';
      box.style.fontSize = '12px';
      const rect = inputEl.getBoundingClientRect();
      box.style.left = (rect.left + window.scrollX) + 'px';
      box.style.top = (rect.bottom + window.scrollY) + 'px';
      box.style.width = rect.width + 'px';

      items.slice(0, 10).forEach(function (item) {
        const line = document.createElement('div');
        line.style.padding = '4px 6px';
        line.style.cursor = 'pointer';
        const sku = kind === 'material' ? item.material_sku : item.product_sku;
        const name = kind === 'material' ? item.material_name : item.product_name;
        line.textContent = sku + '  ' + name;
        line.addEventListener('mousedown', function () {
          const idx = Number(inputEl.getAttribute('data-line-field'));
          if (kind === 'material') {
            state.lines[idx].material_id = item.material_id;
            state.lines[idx].material_sku = item.material_sku;
            state.lines[idx].material_name = item.material_name;
            state.lines[idx].maker = item.maker;
            state.lines[idx].spec = item.spec;
            state.lines[idx].unit = item.default_unit;
            state.lines[idx].unit_price = item.standard_unit_price;
          } else {
            state.projectInfo.product_sku = item.product_sku;
            state.projectInfo.product_name = item.product_name;
            state.projectInfo.material_ratio = item.material_ratio;
          }
          document.body.appendChild(box); // 一旦保持しつつ再描画へ
          renderForm_(inputEl.closest('.order-form-root').parentElement);
        });
        box.appendChild(line);
      });
      document.body.appendChild(box);
    }
  }

  function bindAttachmentEvents_(container) {
    const input = document.getElementById('attachmentInput');
    if (!input) return;
    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = reader.result.split(',')[1];
        const fileType = file.type === 'application/pdf' ? 'PDF' : 'IMAGE';
        Api.call('uploadAttachment', {
          order_id: state.orderId,
          file_base64: base64,
          file_name: file.name,
          file_type: fileType
        }).then(function () {
          Toast.success('添付ファイルをアップロードしました');
          return Api.call('getOrder', { order_id: state.orderId });
        }).then(function (order) {
          state.attachments = order.attachments;
          renderForm_(container);
        }).catch(function (err) {
          Toast.error('アップロードに失敗しました: ' + err.message);
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function bindActionButtons_(container) {
    const saveBtn = document.getElementById('btnSave');
    if (saveBtn) saveBtn.addEventListener('click', function () { handleSave_(container); });

    const pdfBtn = document.getElementById('btnIssuePdf');
    if (pdfBtn) pdfBtn.addEventListener('click', function () { handleIssuePdf_(container); });

    const previewBtn = document.getElementById('btnPreview');
    if (previewBtn) previewBtn.addEventListener('click', function () { handlePreview_(); });

    const mailBtn = document.getElementById('btnMailCompose');
    if (mailBtn) mailBtn.addEventListener('click', function () { handleMailCompose_(); });
  }

  function buildPayload_() {
    return {
      order_type: state.orderType,
      order_date: state.header.order_date,
      supplier_id: state.header.supplier_id,
      supplier_contact_id: state.header.supplier_contact_id,
      employee_id: state.header.employee_id,
      due_date: state.header.due_date,
      delivery_point_id: state.header.delivery_point_id,
      project_info: state.projectInfo,
      remarks: state.remarks,
      lines: state.lines
    };
  }

  function validateRequired_() {
    if (!state.header.supplier_id) return '発注先を選択してください';
    if (!state.header.employee_id) return '発注者を選択してください';
    if (!state.header.delivery_point_id) return '納品先を選択してください';
    return null;
  }

  function handleSave_(container) {
    const err = validateRequired_();
    if (err) { Toast.error(err); return; }

    const payload = buildPayload_();
    const action = state.orderId ? 'updateOrder' : 'createOrder';
    if (state.orderId) payload.order_id = state.orderId;

    const saveBtn = document.getElementById('btnSave');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    Api.call(action, payload).then(function (order) {
      DraftStore.clear(state.orderType, draftKey_());
      applyOrderToState_(order);
      Toast.success('保存しました: ' + order.order_id);
      renderForm_(container);
      // URLを編集モードへ更新（ブラウザバック/リロード時にも同じ発注書を開けるように）
      if (window.Router) Router.navigate('order-form', { orderType: order.order_type, orderId: order.order_id }, true);
    }).catch(function (e) {
      Toast.error('保存に失敗しました: ' + e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    });
  }

  function handleIssuePdf_(container) {
    const btn = document.getElementById('btnIssuePdf');
    btn.disabled = true;
    btn.textContent = 'PDF発行中...';
    const action = state.status === 'ISSUED' ? 'reissuePdf' : 'issuePdf';
    Api.call(action, { order_id: state.orderId }).then(function (result) {
      state.pdfFileUrl = result.pdf_file_url;
      state.status = 'ISSUED';
      Toast.success('PDFを発行しました');
      window.open(result.pdf_file_url, '_blank');
      renderForm_(container);
    }).catch(function (e) {
      Toast.error('PDF発行に失敗しました: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'PDF発行';
    });
  }

  function handlePreview_() {
    const def = getOrderTypeDef(state.orderType);
    const supplier = state.masters.partners.find(function (s) { return s.partner_id === state.header.supplier_id; });
    const win = window.open('', '_blank');
    win.document.write(
      '<html><head><meta charset="UTF-8"><title>印刷イメージ</title></head><body style="font-family:sans-serif;padding:20px;">' +
      '<h2>' + def.label + ' プレビュー</h2>' +
      '<p>発注先: ' + (supplier ? escapeHtml(supplier.company_name) : '(未選択)') + '</p>' +
      '<p>発注日: ' + escapeHtml(state.header.order_date || '') + ' / 希望納期: ' + escapeHtml(state.header.due_date || '') + '</p>' +
      '<p class="text-muted">※ 簡易プレビューです。実際のPDFレイアウトは「PDF発行」で生成されるものが正式版です。</p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr>' + def.lineColumns.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') + '</tr>' +
      state.lines.map(function (l) {
        return '<tr>' + def.lineColumns.map(function (c) {
          if (c.type === 'size_grid') {
            let sq = {}; try { sq = JSON.parse(l.size_qty_json || '{}'); } catch (e) {}
            return '<td>' + Object.keys(sq).map(function (k) { return k + ':' + sq[k]; }).join(' ') + '</td>';
          }
          return '<td>' + escapeHtml(l[c.key] !== undefined ? l[c.key] : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</table>' +
      '</body></html>'
    );
  }

  function handleMailCompose_() {
    const supplier = state.masters.partners.find(function (s) { return s.partner_id === state.header.supplier_id; });
    Api.call('listSupplierContacts', { supplier_id: state.header.supplier_id }).then(function (data) {
      const contact = data.items.find(function (c) { return c.contact_id === state.header.supplier_contact_id; });
      const to = contact ? contact.email : '';
      const subject = encodeURIComponent('【発注書】' + state.orderId + 'のご送付');
      const body = encodeURIComponent(
        (supplier ? supplier.company_name : '') + ' ' + (contact ? contact.contact_name : '') + ' 様\n\n' +
        'いつもお世話になっております。レイズラボ株式会社です。\n' +
        '発注書（' + state.orderId + '）を送付いたします。\n\n' +
        'PDFは以下よりダウンロードの上、ご確認をお願いいたします。\n' +
        (state.pdfFileUrl || '') + '\n\n' +
        'ご不明点等ございましたらご連絡ください。\nよろしくお願いいたします。'
      );
      window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
    });
  }

  function formatNumber_(v) {
    return (Number(v) || 0).toLocaleString('ja-JP');
  }

  return { render: render };
})();
