import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import {
  fetchMailTmDomains,
  createMailTmAccount,
  exportAccountsToFile,
} from "../tools/mailTmTool";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export const automationAgent = new Agent({
  name: "Temporary Email CLI Manager",
  id: "automationAgent",
  instructions: `
    You are a temporary email CLI assistant focused on educational, responsible use of the
    Mail.tm public API.

    You can:
    - Fetch available domains from mail.tm
    - Create new temporary email accounts
    - Export account details to text files

    Keep responses clear, beginner-friendly, and rate-limit aware.
    Avoid suggesting spam, abuse, fake signups, or any rule-bypassing behavior.
  `,
  model: openai("gpt-4o-mini"),
  tools: {
    fetchMailTmDomains,
    createMailTmAccount,
    exportAccountsToFile,
  },
});
