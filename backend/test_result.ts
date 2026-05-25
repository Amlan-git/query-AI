// @ts-nocheck
import { streamText, Output } from 'ai';
import { z } from 'zod';
import { MockLanguageModelV3 } from 'ai/test';

async function main() {
  const result = streamText({
    model: new MockLanguageModelV3({
      doStream: async () => ({
        stream: (async function* () {
          yield { type: 'text-delta', textDelta: '{"answer":"Hel' };
          yield { type: 'text-delta', textDelta: 'lo","followUps":[]}' };
        })(),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    }),
    output: Output.object({
      schema: z.object({
        answer: z.string(),
        followUps: z.array(z.string())
      })
    }),
    prompt: 'Hello',
  });

  console.log(Object.keys(result));
}

main().catch(console.error);
