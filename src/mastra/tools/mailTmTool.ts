import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const PROJECT_NAME = "Temporary Email CLI Manager";
const OUTPUT_FILE = "accounts.txt";

export const fetchMailTmDomains = createTool({
  id: "fetch-mail-tm-domains",
  description: "Fetches available domains from the mail.tm API",
  inputSchema: z.object({}),
  outputSchema: z.object({
    domains: z.array(z.string()),
  }),
  execute: async (_inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🌐 [fetchMailTmDomains] Fetching available domains...");

    const response = await fetch("https://api.mail.tm/domains", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      logger?.error("❌ [fetchMailTmDomains] Failed to fetch domains", {
        status: response.status,
      });
      throw new Error(`Failed to fetch domains: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const domains = data.map((d: any) => d.domain);
    logger?.info("✅ [fetchMailTmDomains] Got domains", { domains });

    return { domains };
  },
});

export const createMailTmAccount = createTool({
  id: "create-mail-tm-account",
  description: "Creates a single Mail.tm temporary email account",
  inputSchema: z.object({
    address: z.string().describe("Full email address to create"),
    password: z.string().describe("Password for the account"),
  }),
  outputSchema: z.object({
    address: z.string(),
    password: z.string(),
    success: z.boolean(),
    accountId: z.string(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("📧 [createMailTmAccount] Creating account:", {
      address: inputData.address,
    });

    try {
      const response = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          address: inputData.address,
          password: inputData.password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 422 && errorText.includes("already used")) {
          logger?.info("ℹ️ [createMailTmAccount] Account already exists", {
            address: inputData.address,
          });
          return {
            address: inputData.address,
            password: inputData.password,
            success: true,
            accountId: "already-exists",
            message: "Account already exists",
          };
        }
        logger?.error("❌ [createMailTmAccount] Failed to create account", {
          address: inputData.address,
          status: response.status,
          errorText,
        });
        return {
          address: inputData.address,
          password: inputData.password,
          success: false,
          accountId: "",
          message: `Failed: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as any;
      logger?.info("✅ [createMailTmAccount] Account created successfully", {
        address: inputData.address,
        accountId: result.id,
      });

      return {
        address: inputData.address,
        password: inputData.password,
        success: true,
        accountId: result.id || "",
        message: "Account created successfully",
      };
    } catch (err: any) {
      logger?.error("❌ [createMailTmAccount] Error creating account", {
        address: inputData.address,
        errMessage: err.message,
      });
      return {
        address: inputData.address,
        password: inputData.password,
        success: false,
        accountId: "",
        message: `Error: ${err.message}`,
      };
    }
  },
});

export const exportAccountsToFile = createTool({
  id: "export-accounts-to-file",
  description: "Exports account details to a text file",
  inputSchema: z.object({
    accounts: z.array(
      z.object({
        address: z.string(),
        password: z.string(),
        success: z.boolean(),
        accountId: z.string(),
        message: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    filePath: z.string(),
    totalCreated: z.number(),
    totalFailed: z.number(),
    fileContent: z.string(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("📁 [exportAccountsToFile] Exporting accounts to file...", {
      totalAccounts: inputData.accounts.length,
    });

    const successfulAccounts = inputData.accounts.filter((a) => a.success);
    const failedAccounts = inputData.accounts.filter((a) => !a.success);

    let fileContent = "====================================\n";
    fileContent += `  ${PROJECT_NAME} - ACCOUNT EXPORT\n`;
    fileContent += `  Generated: ${new Date().toISOString()}\n`;
    fileContent += "====================================\n\n";
    fileContent += `Total Created: ${successfulAccounts.length}\n`;
    fileContent += `Total Failed: ${failedAccounts.length}\n\n`;
    fileContent += "--- SUCCESSFUL ACCOUNTS ---\n\n";

    for (const account of successfulAccounts) {
      fileContent += `Email: ${account.address}\n`;
      fileContent += `Password: ${account.password}\n`;
      fileContent += `Account ID: ${account.accountId}\n`;
      fileContent += "---\n";
    }

    if (failedAccounts.length > 0) {
      fileContent += "\n--- FAILED ACCOUNTS ---\n\n";
      for (const account of failedAccounts) {
        fileContent += `Email: ${account.address}\n`;
        fileContent += `Reason: ${account.message}\n`;
        fileContent += "---\n";
      }
    }

    const filePath = path.resolve(process.cwd(), OUTPUT_FILE);
    fs.writeFileSync(filePath, fileContent, "utf-8");

    logger?.info("✅ [exportAccountsToFile] File exported successfully", {
      filePath,
      totalCreated: successfulAccounts.length,
      totalFailed: failedAccounts.length,
    });

    return {
      filePath,
      totalCreated: successfulAccounts.length,
      totalFailed: failedAccounts.length,
      fileContent,
    };
  },
});
