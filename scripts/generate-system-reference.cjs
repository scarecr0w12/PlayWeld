#!/usr/bin/env node
// Run after building contracts and platform-service. --check detects stale output.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {
  RpcMethods,
  RpcNotifications,
  RpcErrorCode,
  PROTOCOL_VERSION,
} = require('../packages/contracts/lib');
const { createBuiltinSettings } = require('../packages/platform-service/lib/settings/definitions');
const check = process.argv.includes('--check');
const generated = [];
function emit(name, text) {
  generated.push({ name, text });
}
function shape(s, depth = 0) {
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' / ');
  if (s.anyOf || s.oneOf) return (s.anyOf || s.oneOf).map((v) => shape(v, depth)).join(' / ');
  if (s.allOf) return s.allOf.map((v) => shape(v, depth)).join(' & ');
  if (s.$ref) return s.$ref;
  if (s.type === 'array')
    return `array<${Array.isArray(s.items) ? s.items.map((v) => shape(v, depth + 1)).join(', ') : shape(s.items || {}, depth + 1)}>`;
  if (s.type === 'object' && s.properties) {
    if (depth > 1) return 'object';
    return (
      '{ ' +
      Object.entries(s.properties)
        .map(
          ([k, v]) => k + ((s.required || []).includes(k) ? '' : '?') + ': ' + shape(v, depth + 1),
        )
        .join('; ') +
      ' }'
    );
  }
  if (s.type === 'object' && typeof s.additionalProperties === 'object')
    return `record<string, ${shape(s.additionalProperties, depth + 1)}>`;
  return (s.type || 'unknown') + (s.format ? ` (${s.format})` : '');
}
function safe(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
const out = [
  '# PlayWeld RPC API reference',
  '',
  '**Last updated:** 2026-10-04',
  '',
  '**Source:** Generated from the built contract method table by [generate-system-reference.cjs](../scripts/generate-system-reference.cjs). Rebuild packages before regeneration. This is the internal local service API, not an HTTP REST API.',
  '',
  `Protocol version: **${PROTOCOL_VERSION}**. **${Object.keys(RpcMethods).length} requests**, **${Object.keys(RpcNotifications).length} notifications**.`,
  '',
  'See the [developer guide](DEVELOPER_GUIDE.md) for authentication, framing, a typed client example, and evolution rules. Parameter and result types below are summaries; [complete request/result/notification JSON schemas](reference/rpc-schemas.json) preserve nested fields, constraints, unions, and required properties. The source of truth is [protocol.ts](../packages/contracts/src/rpc/protocol.ts).',
  '',
  '## Requests',
  '',
];
const groups = new Map();
for (const [name, method] of Object.entries(RpcMethods)) {
  const group = name.split('/')[0];
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push([name, method]);
}
for (const [group, methods] of groups) {
  out.push(`### ${group}`, '', '| Method | Parameters | Result |', '| --- | --- | --- |');
  for (const [name, m] of methods)
    out.push(`| \`${name}\` | \`${safe(shape(m.params))}\` | \`${safe(shape(m.result))}\` |`);
  out.push('');
}
out.push(
  '## Notifications',
  '',
  'Subscribe before starting work that emits events. Notifications report changes; fetch the persisted record when reconnecting. A notification is not proof of task completion or successful integration.',
  '',
  '| Event | Parameters |',
  '| --- | --- |',
);
for (const [name, n] of Object.entries(RpcNotifications))
  out.push(`| \`${name}\` | \`${safe(shape(n.params))}\` |`);
out.push(
  '',
  '## Error codes',
  '',
  'The client maps JSON-RPC errors to `RpcError` with `code`, `message`, and optional `data`. Inspect operation records as well: an engine call can return a failed run record without throwing a transport error.',
  '',
  '| Name | Numeric code |',
  '| --- | --- |',
);
for (const [name, value] of Object.entries(RpcErrorCode)) out.push(`| \`${name}\` | ${value} |`);
out.push(
  '',
  '## Regeneration',
  '',
  '```bash',
  'npm run build',
  'node scripts/generate-system-reference.cjs',
  'node scripts/generate-system-reference.cjs --check',
  '```',
  '',
  'Do not hand-edit generated tables or schema exports. Behavioral guidance belongs in the user, integration, operations, and developer guides.',
  '',
);
emit('docs/API_REFERENCE.md', out.join('\n'));
emit(
  'docs/reference/rpc-schemas.json',
  JSON.stringify(
    {
      protocolVersion: PROTOCOL_VERSION,
      methods: RpcMethods,
      notifications: RpcNotifications,
      errorCodes: RpcErrorCode,
    },
    null,
    2,
  ) + '\n',
);
const settings = createBuiltinSettings();
const lines = [
  '# PlayWeld settings reference',
  '',
  '**Last updated:** 2026-10-04',
  '',
  '**Source:** Generated builtin settings from [definitions.ts](../packages/platform-service/src/settings/definitions.ts). Plugin contributions extend this catalog at runtime. Full value schemas are in [settings-schemas.json](reference/settings-schemas.json).',
  '',
  'Resolve settings through `settings/getAll` or `settings/get`; write through `settings/set`. Session overrides take precedence over Project overrides, platform values, and builtin defaults where those scopes are supported. The UI shows the effective value and origin. Reset removes an override rather than replacing a builtin default.',
  '',
  "Path defaults below use `<home>` for the running user's home directory. Scope restrictions, JSON value types, and schema constraints apply. Access ceilings can further restrict a tool independently of the selected setting.",
  '',
];
const home = require('node:os').homedir();
function portable(v) {
  if (typeof v === 'string' && v.startsWith(home))
    return '<home>' + v.slice(home.length).split(path.sep).join('/');
  if (Array.isArray(v)) return v.map(portable);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([key, value]) => [key, portable(value)]));
  return v;
}
for (const g of settings.groups) {
  lines.push(
    `## ${g.title}`,
    '',
    g.description,
    '',
    '| Key | Default | Scopes | Purpose |',
    '| --- | --- | --- | --- |',
  );
  for (const d of settings.definitions.filter((d) => d.group === g.id))
    lines.push(
      `| \`${d.key}\` | \`${safe(JSON.stringify(portable(d.default)))}\` | ${d.scopes.join(', ')} | ${safe(d.description)} |`,
    );
  lines.push('');
}
lines.push(
  '## Export and import',
  '',
  'Use the Settings view for a redacted export. `settings/import` accepts a document, target scope, optional Project ID, and a dry-run flag. Review skipped keys and validation errors before applying an import. An export does not transfer provider credential material; reconfigure accounts on the destination machine. Unknown plugin keys cannot be applied until their definitions are registered.',
  '',
  '## Regeneration',
  '',
  '```bash',
  'npm run build',
  'node scripts/generate-system-reference.cjs',
  'node scripts/generate-system-reference.cjs --check',
  '```',
  '',
);
emit('docs/SETTINGS_REFERENCE.md', lines.join('\n'));
emit('docs/reference/settings-schemas.json', JSON.stringify(portable(settings), null, 2) + '\n');
async function finish() {
  const prettier = require('prettier');
  const config = await prettier.resolveConfig(path.join(root, 'package.json'));
  for (const { name, text } of generated) {
    const target = path.join(root, name);
    const formatted = await prettier.format(text, { ...config, filepath: target });
    if (check) {
      if (
        !fs.existsSync(target) ||
        fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== formatted.replace(/\r\n/g, '\n')
      )
        throw new Error(`Generated documentation is stale: ${name}`);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, formatted);
    }
  }
  console.log(
    `${check ? 'Checked' : 'Generated'} RPC and settings references (${Object.keys(RpcMethods).length} requests, ${settings.definitions.length} builtin settings).`,
  );
}
finish().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
