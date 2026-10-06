const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
if (process.platform === 'win32') {
  const compiler = path.join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const source = path.resolve(__dirname, '../src/plugins/isolation/native/AppContainerHost.cs');
  const output = path.resolve(__dirname, '../lib/plugins/isolation/AppContainerHost.exe');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/reference:System.Web.Extensions.dll', '/out:' + output, source], { windowsHide: true, stdio: 'inherit' });
}
