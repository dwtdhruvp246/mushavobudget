// Offline control-flow projection of a deliberately small Go-template subset.
// This is NOT Go text/template, html/template, Supabase rendering or escaping.
// ConfirmationURL remains an untouched placeholder so the harness never
// manufactures a provider link or certifies contextual HTML/URL escaping.
const functions = new Set(['print', 'len', 'slice', 'eq', 'ge', 'and', 'or']);

function tokenize(input) {
  const tokens = [];
  const pattern = /\s*("(?:\\.|[^"\\])*"|[()]|[^\s()]+)/gy;
  let position = 0;
  while (position < input.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(input);
    if (!match) {
      if (!input.slice(position).trim()) break;
      throw Error('Unsupported template expression');
    }
    tokens.push(match[1]);
    position = pattern.lastIndex;
  }
  return tokens;
}

function expression(source) {
  const tokens = tokenize(source);
  let at = 0;
  function atom() {
    const token = tokens[at++];
    if (!token) throw Error('Missing expression');
    if (token === '(') {
      const value = sequence();
      if (tokens[at++] !== ')') throw Error('Unclosed expression');
      return value;
    }
    if (token === ')' || token.includes('|')) throw Error('Unsupported expression');
    if (token.startsWith('"')) return {literal: JSON.parse(token)};
    if (/^\d+$/.test(token)) return {literal: Number(token)};
    if (/^\$[A-Za-z]\w*$/.test(token) || ['.SiteURL', '.RedirectTo', '.ConfirmationURL'].includes(token)) return {reference: token};
    throw Error('Unsupported template token: ' + token);
  }
  function sequence() {
    if (functions.has(tokens[at])) {
      const call = tokens[at++], args = [];
      while (at < tokens.length && tokens[at] !== ')') args.push(atom());
      return {call, args};
    }
    return atom();
  }
  const result = sequence();
  if (at !== tokens.length) throw Error('Trailing template expression');
  return result;
}

function evaluate(ast, values) {
  if (Object.hasOwn(ast, 'literal')) return ast.literal;
  if (ast.reference) {
    if (!Object.hasOwn(values, ast.reference)) throw Error('Unknown template value');
    return values[ast.reference];
  }
  // Go's and/or short circuit; eager slicing would incorrectly fail short URLs.
  if (ast.call === 'and') { for (const arg of ast.args) if (!evaluate(arg, values)) return false; return true; }
  if (ast.call === 'or') { for (const arg of ast.args) if (evaluate(arg, values)) return true; return false; }
  const args = ast.args.map(arg => evaluate(arg, values));
  if (ast.call === 'print') return args.join('');
  if (ast.call === 'len' && args.length === 1 && typeof args[0] === 'string') return Buffer.byteLength(args[0]);
  if (ast.call === 'eq' && args.length === 2) return args[0] === args[1];
  if (ast.call === 'ge' && args.length === 2 && args.every(Number.isInteger)) return args[0] >= args[1];
  if (ast.call === 'slice' && args.length === 3 && typeof args[0] === 'string') {
    const [string, start, end] = args, bytes = Buffer.from(string);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > bytes.length) throw Error('Template slice out of bounds');
    return bytes.subarray(start, end).toString('utf8');
  }
  throw Error('Unsupported template function shape');
}

export function projectTemplate(source, fields) {
  const values = {'.SiteURL': fields.SiteURL, '.RedirectTo': fields.RedirectTo, '.ConfirmationURL': '{{ .ConfirmationURL }}'};
  if (typeof values['.SiteURL'] !== 'string' || typeof values['.RedirectTo'] !== 'string') throw Error('String source fields required');
  const root = [], stack = [], pattern = /{{([\s\S]*?)}}/g;
  let block = root, position = 0, match;
  while ((match = pattern.exec(source))) {
    block.push({text: source.slice(position, match.index)});
    const action = match[1].trim();
    position = pattern.lastIndex;
    if (action.startsWith('/*') && action.endsWith('*/')) continue;
    const assign = action.match(/^(\$[A-Za-z]\w*)\s*:=\s*([\s\S]+)$/);
    if (assign) block.push({assign: assign[1], expression: expression(assign[2])});
    else if (action.startsWith('if ')) {
      const node = {condition: expression(action.slice(3)), yes: [], no: []};
      block.push(node); stack.push({parent: block, node, elseSeen: false}); block = node.yes;
    } else if (action === 'else') {
      const frame = stack.at(-1);
      if (!frame || frame.elseSeen) throw Error('Unexpected template else');
      frame.elseSeen = true; block = frame.node.no;
    } else if (action === 'end') {
      const frame = stack.pop(); if (!frame) throw Error('Unexpected template end'); block = frame.parent;
    } else block.push({expression: expression(action)});
  }
  if (source.slice(position).includes('{{')) throw Error('Unclosed template action');
  block.push({text: source.slice(position)});
  if (stack.length) throw Error('Unclosed template condition');
  function execute(nodes) {
    let output = '';
    for (const node of nodes) {
      if (Object.hasOwn(node, 'text')) output += node.text;
      else if (node.assign) values[node.assign] = evaluate(node.expression, values);
      else if (node.condition) output += execute(evaluate(node.condition, values) ? node.yes : node.no);
      else output += String(evaluate(node.expression, values));
    }
    return output;
  }
  return execute(root);
}
