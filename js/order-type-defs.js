/**
 * 発注種別（資材/製品加工/生地加工）ごとの表示ラベル・項目定義をまとめる。
 * 新しい発注種別を追加する場合や項目を増減する場合はこのファイルを起点に見直す。
 */

const OrderTypeDefs = {
  MATERIAL: {
    label: '資材発注',
    prefix: 'RL-M',
    badgeClass: 'type-badge--material',
    projectInfoFields: [
      { key: 'product_sku', label: '使用製品品番', type: 'text' },
      { key: 'product_name', label: '使用製品名', type: 'text' },
      { key: 'season', label: 'シーズン', type: 'text', placeholder: '例: 2026AW' },
      { key: 'category', label: '区分', type: 'select', options: ['SAMPLE', 'BULK', '追加', '修正'] }
    ],
    remarksFields: [
      { key: 'shipping_contact_method', label: '出荷明細の連絡方法' },
      { key: 'fabric_face_back_note', label: '生地表裏の表示依頼' },
      { key: 'slip_notes', label: '伝票記載事項' },
      { key: 'other', label: 'その他備考' }
    ],
    lineColumns: [
      { key: 'maker', label: 'メーカー', type: 'text', width: '10%' },
      { key: 'material_sku', label: '資材品番', type: 'text', width: '12%', autocomplete: 'material' },
      { key: 'material_name', label: '資材名', type: 'text', width: '16%' },
      { key: 'spec', label: '規格', type: 'text', width: '10%' },
      { key: 'color', label: 'カラー', type: 'text', width: '10%' },
      { key: 'quantity', label: '数量', type: 'number', width: '8%' },
      { key: 'unit', label: '単位', type: 'text', width: '6%' },
      { key: 'unit_price', label: '単価', type: 'number', width: '9%' },
      { key: 'amount', label: '金額', type: 'computed', width: '10%' }
    ],
    emptyLine: function () {
      return { maker: '', material_sku: '', material_name: '', spec: '', color: '', quantity: '', unit: '', unit_price: '', amount: 0 };
    },
    calcLine: function (line) {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      line.amount = qty * price;
      return line;
    }
  },

  PROCESSING: {
    label: '製品加工発注',
    prefix: 'RL-P',
    badgeClass: 'type-badge--processing',
    projectInfoFields: [
      { key: 'product_sku', label: '製品品番', type: 'text' },
      { key: 'product_name', label: '製品名', type: 'text' },
      { key: 'material_ratio', label: '品質/混率', type: 'text', placeholder: '例: C-100%' },
      { key: 'product_weight', label: '製品重量', type: 'text' },
      { key: 'processing_type', label: '加工種別', type: 'select', options: ['プリント', '染め', '洗い', '刺繍', 'その他'] }
    ],
    remarksFields: [
      { key: 'sample_color_tolerance', label: '加工見本・色ブレ許容範囲' },
      { key: 'delivery_form', label: '納品形態' },
      { key: 'inspection_standard', label: '検品基準' },
      { key: 'other', label: 'その他備考' }
    ],
    sizeLabels: ['S', 'M', 'L', 'XL', 'XXL'],
    lineColumns: [
      { key: 'body_color', label: 'ボディ色', type: 'text', width: '10%' },
      { key: 'processing_name', label: '加工名', type: 'text', width: '14%' },
      { key: 'processing_spec', label: '加工位置/仕様', type: 'text', width: '16%' },
      { key: 'unit_price', label: '単価', type: 'number', width: '8%' },
      { key: 'size_qty_json', label: 'サイズ別数量', type: 'size_grid', width: '26%' },
      { key: 'total_qty', label: '合計数量', type: 'computed', width: '8%' },
      { key: 'amount', label: '金額', type: 'computed', width: '10%' }
    ],
    emptyLine: function () {
      return { body_color: '', processing_name: '', processing_spec: '', unit_price: '', size_qty_json: '{}', total_qty: 0, amount: 0 };
    },
    calcLine: function (line) {
      let sizeQty = {};
      try { sizeQty = JSON.parse(line.size_qty_json || '{}'); } catch (e) { sizeQty = {}; }
      let total = 0;
      Object.keys(sizeQty).forEach(function (k) { total += Number(sizeQty[k]) || 0; });
      line.total_qty = total;
      line.amount = total * (Number(line.unit_price) || 0);
      return line;
    }
  },

  FABRIC: {
    label: '生地加工発注',
    prefix: 'RL-F',
    badgeClass: 'type-badge--fabric',
    projectInfoFields: [
      { key: 'pattern_sku', label: '柄品番（任意）', type: 'text' },
      { key: 'pattern_name', label: '柄名（任意）', type: 'text' },
      { key: 'fabric_sku', label: '生地品番', type: 'text' },
      { key: 'fabric_name', label: '生地名', type: 'text' },
      { key: 'fabric_ratio', label: '生地混率', type: 'text', placeholder: '例: C-100%' },
      { key: 'fabric_spec', label: '生地規格', type: 'text', placeholder: '巾・目付など' },
      { key: 'product_sku', label: '使用製品品番', type: 'text' },
      { key: 'product_name', label: '使用製品名', type: 'text' }
    ],
    remarksFields: [
      { key: 'fabric_defect_pin_note', label: '生地キズ・ピン打ち指示' },
      { key: 'fabric_face_back_note', label: '生地表裏の表示' },
      { key: 'remnant_return_note', label: '残反返却指示' },
      { key: 'other', label: 'その他備考' }
    ],
    lineColumns: [
      { key: 'mass_code', label: 'マスコード', type: 'text', width: '10%' },
      { key: 'fabric_color_name', label: '生地色名', type: 'text', width: '12%' },
      { key: 'processing_color_type', label: '加工色/加工種類', type: 'text', width: '16%' },
      { key: 'quantity', label: '数量', type: 'number', width: '8%' },
      { key: 'unit', label: '単位', type: 'text', width: '6%' },
      { key: 'unit_price', label: '加工単価', type: 'number', width: '9%' },
      { key: 'amount', label: '金額', type: 'computed', width: '10%' },
      { key: 'remarks', label: '備考', type: 'text', width: '14%' }
    ],
    emptyLine: function () {
      return { mass_code: '', fabric_color_name: '', processing_color_type: '', quantity: '', unit: '', unit_price: '', amount: 0, remarks: '' };
    },
    calcLine: function (line) {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      line.amount = qty * price;
      return line;
    }
  }
};

function getOrderTypeDef(orderType) {
  const def = OrderTypeDefs[orderType];
  if (!def) throw new Error('不明な発注区分: ' + orderType);
  return def;
}
