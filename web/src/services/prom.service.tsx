
import { streamText } from "ai";
import { openRouter } from "../libs/ai";

export const PromData = async ({ message }: { message: string }) => {
  const result = streamText({
    model: openRouter("nvidia/nemotron-3.5-lightning:free"),
    prompt: message,
  });

  return await result.text;
};
