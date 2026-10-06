const { cpSync, existsSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const packageDir = path.resolve(__dirname, '..');
require('./build-appcontainer.cjs');
const source = path.join(packageDir, 'roles');
const destination = path.join(packageDir, 'lib', 'roles');
const editorPluginSource = path.resolve(packageDir, '../../integrations/unreal/PlayWeldEditor');
const editorPluginTarget = path.join(packageDir, 'lib/integrations/unreal/PlayWeldEditor');
mkdirSync(editorPluginTarget, { recursive: true });
cpSync(editorPluginSource, editorPluginTarget, { recursive: true });
for (const family of ['unity', 'godot']) {
  const bundle = path.resolve(packageDir, `../../integrations/${family}/PlayWeldEditor`);
  const target = path.join(packageDir, `lib/integrations/${family}/PlayWeldEditor`);
  mkdirSync(target, { recursive: true });
  cpSync(bundle, target, { recursive: true });
}
const roleDirectories = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const roleNames = new Set(roleDirectories.map((entry) => entry.name));

mkdirSync(destination, { recursive: true });
for (const entry of readdirSync(destination, { withFileTypes: true })) {
  const target = path.join(destination, entry.name);
  if (entry.isDirectory() && existsSync(path.join(target, 'ROLE.md')) && !roleNames.has(entry.name)) {
    rmSync(target, { recursive: true, force: true });
  }
}
for (const roleDirectory of roleDirectories) {
  const target = path.join(destination, roleDirectory.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(path.join(source, roleDirectory.name), target, { recursive: true });
}

// Curate production skills explicitly; repository tooling skills are not product assets.
const { BUNDLED_SKILL_NAMES } = require('../lib/skills/bundled-skill-names');
const { loadSkillDir } = require('../lib/skills/skill-loader');
const skillSource = path.resolve(packageDir, '../../.agents/skills');
const skillDestination = path.join(packageDir, 'lib/skills');
mkdirSync(skillDestination, { recursive: true });
for (const entry of readdirSync(skillDestination, { withFileTypes: true })) {
  if (entry.isDirectory() && existsSync(path.join(skillDestination, entry.name, 'SKILL.md')) && !BUNDLED_SKILL_NAMES.includes(entry.name)) {
    rmSync(path.join(skillDestination, entry.name), { recursive: true, force: true });
  }
}
for (const name of BUNDLED_SKILL_NAMES) {
  const sourceDirectory = path.join(skillSource, name);
  if (!existsSync(path.join(sourceDirectory, 'SKILL.md'))) throw new Error(`Missing bundled skill: ${name}`);
  const record = loadSkillDir(sourceDirectory, 'platform', 'builtin:gamecrafter');
  if (record.warnings.length) throw new Error(`Bundled skill warnings for ${name}: ${record.warnings.join(', ')}`);
  const target = path.join(skillDestination, name);
  rmSync(target, { recursive: true, force: true });
  cpSync(sourceDirectory, target, { recursive: true });
}
