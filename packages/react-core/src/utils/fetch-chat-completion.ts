import {
  Message,
  ToolDefinition,
  ChatCompletionEvent,
  decodeChatCompletion,
  parseChatCompletion,
  decodeChatCompletionAsText,
} from "@copilotkit/shared";
import { CopilotApiConfig } from "../context";

export interface FetchChatCompletionParams {
  copilotConfig: CopilotApiConfig;
  model?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string> | Headers;
  body?: object;
  signal?: AbortSignal;
}

export async function fetchChatCompletion({
  copilotConfig,
  model,
  messages,
  tools,
  temperature,
  headers,
  body,
  signal,
}: FetchChatCompletionParams): Promise<Response> {
  temperature ||= 0.5;
  tools ||= [];

  // clean up any extra properties from messages
  const cleanedMessages = messages.map((message) => {
    const { content, role, name, function_call } = message;
    return { content, role, name, function_call };
  });

  const response = await fetch(copilotConfig.chatApiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...copilotConfig.headers,
      ...(headers ? { ...headers } : {}),
    },
    body: JSON.stringify({
      model,
      messages: cleanedMessages,
      stream: true,
      ...(tools.length ? { tools } : {}),
      ...(temperature ? { temperature } : {}),
      ...(tools.length != 0 ? { tool_choice: "auto" } : {}),
      ...copilotConfig.body,
      ...(body ? { ...body } : {}),
    }),
    signal,
  });

  return response;
}

export interface DecodedChatCompletionResponse extends Response {
  events: ReadableStream<ChatCompletionEvent> | null;
}

export async function fetchAndDecodeChatCompletion(
  params: FetchChatCompletionParams,
): Promise<DecodedChatCompletionResponse> {
  const response = await fetchChatCompletion(params);
  if (!response.ok || !response.body) {
    return { ...response, events: null };
  }
  const events = await decodeChatCompletion(parseChatCompletion(response.body));
  return { ...response, events };
}

export interface DecodedChatCompletionResponseAsText extends Response {
  events: ReadableStream<string> | null;
}

export async function fetchAndDecodeChatCompletionAsText(
  params: FetchChatCompletionParams,
): Promise<DecodedChatCompletionResponseAsText> {
  const response = await fetchChatCompletion(params);
  if (!response.ok || !response.body) {
    return { ...response, events: null };
  }
  const events = await decodeChatCompletionAsText(
    decodeChatCompletion(parseChatCompletion(response.body)),
  );
  return { ...response, events };
}
