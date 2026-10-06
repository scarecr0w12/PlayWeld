import type { ChatMessage } from '@gamecrafter/contracts';
import type {
  LanguageModelMessage,
  LanguageModelResponse,
  LanguageModelStreamResponsePart,
  ToolRequest,
  UserRequest,
} from '@theia/ai-core/lib/common/language-model';
import type { ControlRoomService } from './control-room-protocol';

type AdapterService = Pick<ControlRoomService, 'completeChat' | 'callTool' | 'listTools'>;
export type ProjectResolver = (explicit?: unknown) => Promise<string>;
const toolNames = ['playweld_tools', 'playweld_tool'];

export function theiaChatMessages(messages: LanguageModelMessage[]): ChatMessage[] {
  const output: ChatMessage[] = [];
  for (const message of messages) {
    if (message.type === 'text')
      output.push({
        role: message.actor === 'ai' ? 'assistant' : message.actor,
        content: message.text,
      });
    else if (message.type === 'tool_use') {
      let previous = output.at(-1);
      if (!previous || previous.role !== 'assistant') {
        previous = { role: 'assistant', content: '' };
        output.push(previous);
      }
      previous.toolCalls = [
        ...(previous.toolCalls ?? []),
        { id: message.id, name: message.name, arguments: JSON.stringify(message.input) },
      ];
    } else if (message.type === 'tool_result')
      output.push({
        role: 'tool',
        content:
          typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content ?? ''),
        toolCallId: message.tool_use_id,
        name: message.name,
      });
    else
      throw new Error(
        `The PlayWeld Theia adapter cannot forward ${message.type} messages. Use a supported text/tool conversation.`,
      );
  }
  return output;
}

export function playWeldTheiaTool(
  service: AdapterService,
  resolveProject: ProjectResolver,
  name: 'playweld_tools' | 'playweld_tool',
): ToolRequest {
  return {
    id: name,
    name,
    providerName: 'PlayWeld',
    description:
      name === 'playweld_tools'
        ? 'List the selected PlayWeld Project tools and their exact input schemas.'
        : 'Run a discovered tool in the selected PlayWeld Project through its access policy, approvals and audit journal.',
    parameters: {
      type: 'object',
      properties:
        name === 'playweld_tools' ? {} : { toolId: { type: 'string' }, input: { type: 'object' } },
      ...(name === 'playweld_tool' ? { required: ['toolId', 'input'] } : {}),
    },
    handler: async (text, context) => {
      if (context?.cancellationToken?.isCancellationRequested)
        throw new Error('Theia request cancelled.');
      const projectId = await resolveProject();
      if (!projectId)
        throw new Error('Open one unambiguous PlayWeld Project workspace before using Theia AI.');
      const args: unknown = JSON.parse(text);
      if (!args || typeof args !== 'object' || Array.isArray(args))
        throw new Error('Tool arguments must be an object.');
      const input = args as Record<string, unknown>;
      if (Object.keys(input).some((key) => !['toolId', 'input'].includes(key)))
        throw new Error('Tool arguments cannot override the Project or access policy.');
      if (name === 'playweld_tools') return JSON.stringify(await service.listTools(projectId));
      if (typeof input.toolId !== 'string') throw new Error('A discovered toolId is required.');
      const call = await service.callTool(projectId, input.toolId, input.input ?? {});
      return JSON.stringify({
        callId: call.callId,
        status: call.status,
        output: call.output,
        ...(call.error ? { error: call.error.message } : {}),
      });
    },
  };
}

export async function requestThroughPlayWeld(
  service: AdapterService,
  resolveProject: ProjectResolver,
  request: UserRequest,
  cancelled: () => boolean = () => false,
): Promise<LanguageModelResponse> {
  const check = () => {
    if (cancelled() || request.cancellationToken?.isCancellationRequested)
      throw new Error('Theia request cancelled.');
  };
  check();
  const explicit = request.settings?.['playweld.projectId'];
  const projectId = await resolveProject(explicit);
  if (!projectId)
    throw new Error('Open one unambiguous PlayWeld Project workspace before using Theia AI.');
  if (request.tools?.some((tool) => !toolNames.includes(tool.name)))
    throw new Error(
      'The PlayWeld adapter accepts its broker tools only. Add playweld_tools and playweld_tool to the agent prompt.',
    );
  if (
    request.serverTools?.length ||
    request.reasoning ||
    request.compaction ||
    request.response_format?.type === 'json_object'
  )
    throw new Error(
      'This adapter supports text, broker tools and JSON schema responses; provider-native server tools, reasoning and compaction require a supported platform request.',
    );
  const messages = theiaChatMessages(request.messages);
  const names = request.tools?.map((tool) => tool.name) ?? [];
  const tools = names.map((name) =>
    playWeldTheiaTool(service, async () => projectId, name as 'playweld_tools' | 'playweld_tool'),
  );
  async function* stream(): AsyncGenerator<LanguageModelStreamResponsePart> {
    for (let turn = 0; turn < 8; turn++) {
      check();
      if ((await resolveProject(explicit)) !== projectId)
        throw new Error('Workspace changed during the Theia request.');
      const response = await service.completeChat({
        projectId,
        requestId: request.requestId,
        route: {
          projectId,
          taskType: 'chat',
          requiredCapabilities: tools.length ? ['chat', 'tools'] : ['chat'],
        },
        request: {
          messages,
          stream: false,
          ...(tools.length
            ? {
                tools: tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description ?? '',
                  inputSchema: tool.parameters,
                })),
              }
            : {}),
          ...(request.response_format?.type === 'json_schema'
            ? {
                responseFormat: {
                  type: 'json_schema',
                  schema: request.response_format.json_schema.schema ?? {},
                },
              }
            : {}),
        },
      });
      check();
      if (response.content) yield { content: response.content };
      yield {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
      };
      if (!response.toolCalls.length) return;
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });
      for (const call of response.toolCalls) {
        check();
        if ((await resolveProject(explicit)) !== projectId)
          throw new Error('Workspace changed before a Theia tool call.');
        const tool = tools.find((candidate) => candidate.name === call.name);
        if (!tool) throw new Error('Model requested a tool not offered by the PlayWeld adapter.');
        let result: string;
        try {
          result = String(await tool.handler(call.arguments));
        } catch (error) {
          result = JSON.stringify({
            error: error instanceof Error ? error.message : 'PlayWeld tool failed.',
          });
        }
        check();
        messages.push({ role: 'tool', content: result, toolCallId: call.id, name: call.name });
        yield {
          tool_calls: [
            {
              id: call.id,
              function: { name: call.name, arguments: call.arguments },
              result,
              finished: true,
            },
          ],
        };
      }
    }
    throw new Error(
      'Theia request reached its eight-turn tool limit. Continue explicitly or use a durable PlayWeld task.',
    );
  }
  return { stream: stream() };
}
