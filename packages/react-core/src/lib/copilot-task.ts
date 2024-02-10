import { AnnotatedFunction, FunctionCall, Message } from "@copilotkit/shared";
import { CopilotContextParams } from "../context";
import { defaultCopilotContextCategories } from "../components";
import { fetchAndDecodeChatCompletion } from "../utils/fetch-chat-completion";

export interface CopilotTaskConfig {
  /**
   * The instructions to be given to the assistant.
   */
  instructions: string;
  /**
   * Function definitions to be sent to the API.
   */
  functions?: AnnotatedFunction<any[]>[];
  /**
   * Whether to include the copilot readable context in the task.
   */
  includeCopilotReadable?: boolean;

  /**
   * Whether to include functions defined via useMakeCopilotActionable in the task.
   */
  includeCopilotActionable?: boolean;
}

export class CopilotTask<T = any> {
  private instructions: string;
  private functions: AnnotatedFunction<any[]>[];
  private includeCopilotReadable: boolean;
  private includeCopilotActionable: boolean;

  constructor(config: CopilotTaskConfig) {
    this.instructions = config.instructions;
    this.functions = config.functions || [];
    this.includeCopilotReadable = config.includeCopilotReadable || true;
    this.includeCopilotActionable = config.includeCopilotActionable || true;
  }

  async run(context: CopilotContextParams, data?: T): Promise<void> {
    const entryPoints = this.includeCopilotActionable ? Object.assign({}, context.entryPoints) : {};

    // merge functions into entry points
    for (const fn of this.functions) {
      entryPoints[fn.name] = fn;
    }

    let contextString = "";

    if (data) {
      contextString = (typeof data === "string" ? data : JSON.stringify(data)) + "\n\n";
    }

    if (this.includeCopilotReadable) {
      contextString += context.getContextString([], defaultCopilotContextCategories);
    }

    const systemMessage: Message = {
      id: "system",
      content: taskSystemMessage(contextString, this.instructions),
      role: "system",
    };

    const messages = [systemMessage];

    const response = await fetchAndDecodeChatCompletion({
      copilotConfig: context.copilotApiConfig,
      messages: messages,
      tools: context.getChatCompletionFunctionDescriptions(entryPoints),
      headers: context.copilotApiConfig.headers,
      body: context.copilotApiConfig.body,
    });

    if (!response.events) {
      throw new Error("Failed to execute task");
    }

    const reader = response.events.getReader();
    let functionCalls: FunctionCall[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value.type === "function") {
        functionCalls.push({
          name: value.name,
          arguments: JSON.stringify(value.arguments),
        });
        break;
      }
    }

    if (!functionCalls.length) {
      throw new Error("No function call occurred");
    }

    const functionCallHandler = context.getFunctionCallHandler(entryPoints);
    for (const functionCall of functionCalls) {
      await functionCallHandler(messages, functionCall);
    }
  }
}

function taskSystemMessage(contextString: string, instructions: string): string {
  return `
Please act as an efficient, competent, conscientious, and industrious professional assistant.

Help the user achieve their goals, and you do so in a way that is as efficient as possible, without unnecessary fluff, but also without sacrificing professionalism.
Always be polite and respectful, and prefer brevity over verbosity.

The user has provided you with the following context:
\`\`\`
${contextString}
\`\`\`

They have also provided you with functions you can call to initiate actions on their behalf.

Please assist them as best you can.

This is not a conversation, so please do not ask questions. Just call a function without saying anything else.

The user has given you the following task to complete:

\`\`\`
${instructions}
\`\`\`
`;
}
