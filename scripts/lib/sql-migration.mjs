// Split PostgreSQL statements without splitting quoted function bodies, strings,
// identifiers, or comments. Return statements for one transaction batch.
export function migrationStatements(source) {
  const statements = [];
  let start = 0, quote = null, escapeString = false, dollar = null, lineComment = false, blockDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockDepth) {
      if (c === '/' && next === '*') { blockDepth++; i++; }
      else if (c === '*' && next === '/') { blockDepth--; i++; }
      continue;
    }
    if (dollar) { if (source.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; } continue; }
    if (quote) {
      if (c === quote && next === quote) { i++; continue; }
      if (c === '\\' && escapeString) { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '-' && next === '-') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockDepth = 1; i++; continue; }
    if (c === "'" || c === '"') {
      quote = c;
      escapeString = c === "'" && /[eE]/.test(source[i - 1] || '') && !/[\w$]/.test(source[i - 2] || '');
      continue;
    }
    if (c === '$') {
      const match = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) { dollar = match[0]; i += dollar.length - 1; continue; }
    }
    if (c === ';') { statements.push(source.slice(start, i).trim()); start = i + 1; }
  }
  if (quote || dollar || blockDepth) throw new Error('Unterminated SQL string, function body, or comment');
  statements.push(source.slice(start).trim());
  const withoutComments = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').trim();
  const result = statements.filter(value => withoutComments(value));
  if (/^BEGIN(?:\s+TRANSACTION)?$/i.test(withoutComments(result[0] || ''))) {
    if (!/^COMMIT$/i.test(withoutComments(result.at(-1) || ''))) throw new Error('Migration has BEGIN without final COMMIT');
    result.shift(); result.pop();
  }
  if (result.some(value => /^(?:BEGIN(?:\s+TRANSACTION)?|COMMIT|ROLLBACK)$/i.test(withoutComments(value)))) throw new Error('Unexpected transaction control inside migration');
  return result;
}
