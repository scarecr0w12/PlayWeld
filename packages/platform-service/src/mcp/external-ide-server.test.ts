import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { connect } from '@gamecrafter/service-client';
import { PlatformService } from '../service';
import { resolvePaths } from '../paths';
import { externalToolName } from './external-ide-server';

it('serves an explicit Project through real SDK stdio and retains broker confinement and credentials', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playweld-ide-mcp-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
  const service = await PlatformService.start({ paths, platformVersion: '0.14.0' });
  const token = readFileSync(paths.tokenPath, 'utf8').trim();
  const admin = await connect({
    socketPath: service.socketPath,
    token,
    clientName: 'IDE acceptance fixture',
    clientVersion: '1.0.0',
  });
  const ide = new Client({ name: 'external IDE SDK acceptance', version: '1.0.0' });
  let stderr = '';
  try {
    const project = await admin.call('project/create', {
      name: 'IDE fixture',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'ide',
    });
    const foreign = path.join(root, 'private.txt');
    writeFileSync(foreign, 'foreign private data');
    writeFileSync(path.join(project.path, 'hello.txt'), 'selected Project data');
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        path.resolve(__dirname, '../../lib/mcp/external-ide-server.js'),
        '--project',
        project.projectId,
        '--profile',
        paths.profileDir,
      ],
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    await ide.connect(transport);
    expect(ide.getServerVersion()?.name).toBe('playweld-external-ide');
    const listed = await ide.listTools();
    expect(listed.tools.some((tool) => tool.name === externalToolName('fs/read-file'))).toBe(true);
    const result = await ide.callTool({
      name: externalToolName('fs/read-file'),
      arguments: { input: { path: 'hello.txt' } },
    });
    expect(JSON.stringify(result)).toContain('selected Project data');
    expect(result.isError).toBe(false);
    const denied = await ide.callTool({
      name: externalToolName('fs/read-file'),
      arguments: { input: { path: foreign } },
    });
    expect(denied.isError).toBe(true);
    expect(JSON.stringify(denied)).not.toContain('foreign private data');
    await expect(ide.callTool({ name: 'unknown_tool', arguments: {} })).rejects.toThrow(
      /available/,
    );
    const calls = await admin.call('tool/calls', { projectId: project.projectId });
    expect(
      calls.calls.some((call) => call.toolId === 'fs/read-file' && call.status === 'completed'),
    ).toBe(true);
    expect(JSON.stringify(result) + JSON.stringify(denied) + stderr).not.toContain(token);
  } finally {
    await ide.close();
    admin.close();
    await service.stop();
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
