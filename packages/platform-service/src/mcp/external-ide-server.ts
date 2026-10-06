#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { connect, discover, type ServiceClient } from '@gamecrafter/service-client';
import { JsonRpcChannel } from '../ipc/jsonrpc-channel';
import { JsonRpcProtocolError, type JsonRpcMessage, type JsonRpcTransport } from '../ipc/types';
import type { AccessMode, ToolDefinition } from '@gamecrafter/contracts';

export function externalToolName(toolId: string): string {
  return `playweld_${createHash('sha256').update(toolId).digest('hex')}`;
}

export class IdeStdioTransport implements JsonRpcTransport {
  private buffer = '';
  private data?: (chunk: string) => void;
  constructor(private readonly ended: () => void) {}
  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    process.stdin.setEncoding('utf8');
    this.data = (chunk) => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer, 'utf8') > 10 * 1024 * 1024) {
        onError(new Error('MCP frame exceeds the limit.'));
        this.ended();
        return;
      }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) !== -1) {
        const frame = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end + 1);
        if (!frame) continue;
        try {
          const message: unknown = JSON.parse(frame);
          if (
            !message ||
            typeof message !== 'object' ||
            Array.isArray(message) ||
            (message as JsonRpcMessage).jsonrpc !== '2.0'
          )
            throw new Error('Invalid JSON-RPC message.');
          onMessage(message as JsonRpcMessage);
        } catch {
          void this.send({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Invalid JSON-RPC frame.' },
          });
        }
      }
    };
    process.stdin.on('data', this.data);
    process.stdin.once('end', this.ended);
    process.stdin.on('error', onError);
    process.stdout.on('error', () => this.ended());
  }
  async send(message: JsonRpcMessage): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      process.stdout.write(`${JSON.stringify(message)}\n`, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }
  async close(): Promise<void> {
    if (this.data) process.stdin.off('data', this.data);
    process.stdin.pause();
  }
}

/** The IDE cannot select a different Project through tool arguments. */
export async function registerExternalIdeServer(
  channel: JsonRpcChannel,
  client: ServiceClient,
  projectId: string,
  accessCeiling: AccessMode = 'restricted',
): Promise<void> {
  const projects = await client.call('project/list', {});
  if (!projects.projects.some((project) => project.projectId === projectId))
    throw new Error('Explicit registered PlayWeld Project required.');
  let negotiated = false;
  const serverInfo = { name: 'playweld-external-ide', version: '0.1.0' };
  const capabilities = { tools: {} };
  channel.onRequest('server/discover', () => {
    negotiated = true;
    return { protocolVersions: ['2026-07-28', '2025-11-25'], serverInfo, capabilities };
  });
  channel.onRequest('initialize', (params) => {
    const revision =
      typeof params === 'object' && params !== null
        ? (params as Record<string, unknown>).protocolVersion
        : undefined;
    if (!['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'].includes(String(revision)))
      throw new JsonRpcProtocolError('Unsupported MCP protocol revision.', -32602);
    negotiated = true;
    return { protocolVersion: revision, serverInfo, capabilities };
  });
  channel.onRequest('ping', () => ({}));
  const tools = async (): Promise<ToolDefinition[]> => {
    if (!negotiated) throw new JsonRpcProtocolError('Negotiate MCP before using tools.', -32000);
    return (await client.call('tool/list', { projectId })).tools;
  };
  channel.onRequest('tools/list', async () => ({
    tools: (await tools()).map((tool) => ({
      name: externalToolName(tool.toolId),
      title: tool.title,
      description: `${tool.toolId}: ${tool.description} Supply its native arguments in the input property.`,
      inputSchema: {
        type: 'object',
        properties: { input: tool.inputSchema },
        required: ['input'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: tool.sideEffects === 'none',
        destructiveHint: tool.sideEffects === 'destructive',
        openWorldHint: tool.sideEffects === 'external-write' || tool.sideEffects === 'destructive',
      },
    })),
  }));
  channel.onRequest('tools/call', async (params) => {
    if (!params || typeof params !== 'object' || Array.isArray(params))
      throw new JsonRpcProtocolError('Tool call parameters required.', -32602);
    const request = params as Record<string, unknown>;
    const tool = (await tools()).find(
      (candidate) => externalToolName(candidate.toolId) === request.name,
    );
    if (!tool) throw new JsonRpcProtocolError('Tool is not available in this Project.', -32602);
    const argumentsObject = request.arguments;
    if (
      !argumentsObject ||
      typeof argumentsObject !== 'object' ||
      Array.isArray(argumentsObject) ||
      !Object.hasOwn(argumentsObject, 'input') ||
      Object.keys(argumentsObject).some((key) => key !== 'input')
    )
      throw new JsonRpcProtocolError(
        'Provide native tool arguments in the input property only.',
        -32602,
      );
    try {
      const call = await client.call('tool/call', {
        projectId,
        toolId: tool.toolId,
        input: (argumentsObject as Record<string, unknown>).input,
        accessCeiling,
      });
      const output = {
        callId: call.callId,
        status: call.status,
        output: call.output,
        ...(call.error ? { error: call.error.message } : {}),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
        isError: call.status !== 'completed',
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : 'PlayWeld tool request failed.',
          },
        ],
        isError: true,
      };
    }
  });
}

export async function runExternalIdeServer(args: string[]): Promise<void> {
  let projectId = '',
    accessCeiling: AccessMode = 'restricted';
  const env = { ...process.env };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index],
      value = args[++index];
    if (argument === '--project' && value) projectId = value;
    else if (argument === '--profile' && value) env.GAMECRAFTER_PROFILE_DIR = value;
    else if (argument === '--access-ceiling' && ['restricted', 'ask', 'full'].includes(value ?? ''))
      accessCeiling = value as AccessMode;
    else
      throw new Error(
        'Usage: gamecrafter-mcp --project <Project UUID> [--profile <directory>] [--access-ceiling restricted|ask|full]',
      );
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId))
    throw new Error('An explicit Project UUID is required; no default Project is selected.');
  const discovered = await discover(env);
  const client = await connect({
    ...discovered,
    clientName: 'PlayWeld external IDE MCP',
    clientVersion: '0.1.0',
  });
  const finish = () => {
    client.close();
    process.stdin.pause();
  };
  const channel = new JsonRpcChannel(new IdeStdioTransport(finish), 60000);
  try {
    await registerExternalIdeServer(channel, client, projectId, accessCeiling);
    client.onClose(() => {
      void channel.close();
    });
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
    await channel.start();
  } catch (error) {
    finish();
    throw error;
  }
}

if (require.main === module)
  void runExternalIdeServer(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'PlayWeld IDE MCP startup failed.');
    process.exitCode = 1;
  });
