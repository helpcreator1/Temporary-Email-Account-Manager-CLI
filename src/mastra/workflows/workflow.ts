import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import {
  fetchMailTmDomains,
  createMailTmAccount,
  exportAccountsToFile,
} from "../tools/mailTmTool";

const accountResultSchema = z.object({
  address: z.string(),
  password: z.string(),
  success: z.boolean(),
  accountId: z.string(),
  message: z.string(),
});

const prepareAccountList = createStep({
  id: "prepare-account-list",
  description:
    "Fetches available mail.tm domains and generates a small demo list of account configurations",
  inputSchema: z.object({}) as any,
  outputSchema: z.array(
    z.object({
      address: z.string(),
      password: z.string(),
    }),
  ),
  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📋 [Step 1] Preparing account list...");

    const domainResult = await fetchMailTmDomains.execute!({}, { mastra });
    if ("error" in domainResult && domainResult.error) {
      throw new Error(
        `Failed to fetch domains: ${(domainResult as any).message}`,
      );
    }

    const domains = (domainResult as any).domains as string[];
    if (!domains || domains.length === 0) {
      throw new Error("No domains available from mail.tm");
    }

    const domain = domains[0];
    logger?.info("🌐 [Step 1] Using domain:", { domain });

    const password = "demo-password-123";
    const totalAccounts = 3;
    const accounts = [];

    for (let i = 1; i <= totalAccounts; i++) {
      accounts.push({
        address: `demo-account-${i}@${domain}`,
        password,
      });
    }

    logger?.info("✅ [Step 1] Account list prepared", {
      total: accounts.length,
      domain,
    });

    return accounts;
  },
});

const createSingleAccount = createStep({
  id: "create-mail-tm-account",
  description: "Creates a single temporary Mail.tm account",
  inputSchema: z.object({
    address: z.string(),
    password: z.string(),
  }),
  outputSchema: accountResultSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📧 [foreach] Creating account:", {
      address: inputData.address,
    });

    const maxRetries = 7;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const delay = attempt === 0 ? 3000 : 3000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const result = await createMailTmAccount.execute!(
        {
          address: inputData.address,
          password: inputData.password,
        },
        { mastra },
      );

      if ("error" in result && result.error) {
        logger?.error("❌ [foreach] Account validation error", {
          address: inputData.address,
        });
        return {
          address: inputData.address,
          password: inputData.password,
          success: false,
          accountId: "",
          message: `Validation error: ${(result as any).message}`,
        };
      }

      const typedResult = result as z.infer<typeof accountResultSchema>;

      if (typedResult.success) {
        logger?.info("✅ [foreach] Account created:", {
          address: typedResult.address,
        });
        return typedResult;
      }

      if (typedResult.message.includes("429") && attempt < maxRetries) {
        logger?.warn(
          `⏳ [foreach] Rate limited, retry ${attempt + 1}/${maxRetries}`,
          { address: inputData.address },
        );
        continue;
      }

      logger?.info("📧 [foreach] Account result:", {
        address: typedResult.address,
        success: typedResult.success,
        message: typedResult.message,
      });
      return typedResult;
    }

    return {
      address: inputData.address,
      password: inputData.password,
      success: false,
      accountId: "",
      message: "Max retries exceeded due to rate limiting",
    };
  },
});

const exportResults = createStep({
  id: "export-accounts-to-file",
  description:
    "Exports all created account details to a text file for download",
  inputSchema: z.array(accountResultSchema),
  outputSchema: z.object({
    filePath: z.string(),
    totalCreated: z.number(),
    totalFailed: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📁 [Step 3] Exporting accounts to file...", {
      totalResults: inputData.length,
    });

    const result = await exportAccountsToFile.execute!(
      { accounts: inputData },
      { mastra },
    );

    if ("error" in result && result.error) {
      throw new Error(`Failed to export accounts: ${(result as any).message}`);
    }

    const typedResult = result as {
      filePath: string;
      totalCreated: number;
      totalFailed: number;
      fileContent: string;
    };

    logger?.info("✅ [Step 3] Export complete", {
      filePath: typedResult.filePath,
      totalCreated: typedResult.totalCreated,
      totalFailed: typedResult.totalFailed,
    });

    return {
      filePath: typedResult.filePath,
      totalCreated: typedResult.totalCreated,
      totalFailed: typedResult.totalFailed,
      summary: `Created ${typedResult.totalCreated} accounts, ${typedResult.totalFailed} failed. Exported to ${typedResult.filePath}`,
    };
  },
});

export const automationWorkflow = createWorkflow({
  id: "automation-workflow",
  inputSchema: z.object({}) as any,
  outputSchema: z.object({
    filePath: z.string(),
    totalCreated: z.number(),
    totalFailed: z.number(),
    summary: z.string(),
  }),
})
  .then(prepareAccountList as any)
  .foreach(createSingleAccount as any, { concurrency: 1 })
  .then(exportResults as any)
  .commit();
