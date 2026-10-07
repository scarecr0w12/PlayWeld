// SPDX-License-Identifier: Apache-2.0
// Disposable non-secret transport fixture; never accepts credentials or key files.
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
if (process.platform !== 'win32') throw new Error('This probe requires native Windows.');
const fixture = Buffer.from('PlayWeld owned DPAPI transport fixture');
const executable = 'powershell.exe';
async function probe(mode) {
  const started = Date.now();
  const phases = [];
  const read = mode === 'line' ? 'ReadLine' : 'ReadToEnd';
  const script = `[Console]::Error.WriteLine('phase:started');Add-Type -AssemblyName System.Security;[Console]::Error.WriteLine('phase:assembly');$v=[Convert]::FromBase64String([Console]::In.${read}());[Console]::Error.WriteLine('phase:input');$p=[Security.Cryptography.ProtectedData]::Protect($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Error.WriteLine('phase:protected');$r=[Security.Cryptography.ProtectedData]::Unprotect($p,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Error.WriteLine('phase:unprotected');[Console]::Write([Convert]::ToBase64String($r));[Array]::Clear($v,0,$v.Length);[Array]::Clear($p,0,$p.Length);[Array]::Clear($r,0,$r.Length)`;
  return new Promise(resolve => {
    let output = '';
    let diagnostics = '';
    const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout?.on('data', data => { output += data; });
    child.stderr?.on('data', data => { diagnostics += data; });
    child.on('error', error => { clearTimeout(timer); resolve({mode, startError: error.code}); });
    child.on('close', code => {
      clearTimeout(timer);
      for (const phase of diagnostics.matchAll(/phase:(started|assembly|input|protected|unprotected)/g)) phases.push(phase[1]);
      const roundTrip = code === 0 && Buffer.from(output.trim(), 'base64').equals(fixture);
      resolve({mode, phases, code, elapsedMs:Date.now()-started, roundTrip, outputBytes:Buffer.byteLength(output), fixtureSha256:createHash('sha256').update(fixture).digest('hex')});
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(fixture.toString('base64') + (mode === 'line' ? '\n' : ''));
  });
}
async function standardErrorRoundTrip(kind) {
  const started = Date.now();
  const operations = [];
  let value = fixture;
  for (const decrypt of [false, true]) {
    const result = await new Promise(resolve => {
      const script = `Add-Type -AssemblyName System.Security;$v=[Convert]::FromBase64String([Console]::In.ReadToEnd());$r=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($r));[Array]::Clear($v,0,$v.Length);[Array]::Clear($r,0,$r.Length)`;
      const child = spawn(executable, ['-NoProfile','-NonInteractive','-Command',script], { windowsHide:true, stdio:['pipe','pipe',kind] });
      let output = '';
      const timer = setTimeout(() => child.kill(), 20000);
      child.stderr?.resume();
      child.stdout?.on('data', data => { output += data; });
      child.on('error', error => { clearTimeout(timer); resolve({code:null,startError:error.code}); });
      child.on('close', code => { clearTimeout(timer); resolve({code,bytes:Buffer.from(output.trim(),'base64')}); });
      child.stdin?.on('error', () => {});
      child.stdin?.end(value.toString('base64'));
    });
    operations.push({operation:decrypt?'unprotect':'protect',code:result.code,startError:result.startError,outputBytes:result.bytes?.length??0});
    if(result.code!==0) return {standardError:kind,operations,elapsedMs:Date.now()-started,roundTrip:false};
    value=result.bytes;
  }
  return {standardError:kind,operations,elapsedMs:Date.now()-started,roundTrip:value.equals(fixture)};
}
(async () => {
  const results = [];
  if(!process.argv.includes('--stdio-only'))
    for (const mode of ['eof','line']) results.push(await probe(mode));
  for (const kind of ['ignore','pipe']) results.push(await standardErrorRoundTrip(kind));
  console.log(JSON.stringify({node:process.version, results}, null, 2));
  assert.ok(results.some(result => result.standardError==='pipe' && result.roundTrip), 'Piped standard-error DPAPI transport round trip failed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
