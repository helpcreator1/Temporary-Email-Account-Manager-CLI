# Temporary Email CLI Manager

## Overview

Educational TypeScript project for demonstrating Mail.tm API integration, CLI workflows, validation, and file output handling.

## Key Files

- `create-accounts.ts` - interactive CLI entry point
- `src/mastra/tools/mailTmTool.ts` - Mail.tm API tools
- `src/mastra/workflows/workflow.ts` - demo workflow orchestration
- `src/mastra/agents/agent.ts` - agent instructions and tool wiring
- `src/mastra/index.ts` - Mastra app registration

## Notes

- Generated output is written to `accounts.txt`
- Rate-limit handling is included for safer API usage
- The project is intended for portfolio and learning purposes only
