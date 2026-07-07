/**
 * 全画面で使うHTMLエスケープ関数。XSS防止のため、ユーザー入力を画面に出す際は必ず通す。
 */
function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
