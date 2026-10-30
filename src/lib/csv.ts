export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Quoting alone does not stop spreadsheet formula evaluation.
  if (/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
