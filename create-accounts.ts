import * as readline from "readline";
import * as fs from "fs";

const PROJECT_NAME = "Temporary Email CLI Manager";
const OUTPUT_FILE = "accounts.txt";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDomains(): Promise<string[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.mail.tm/domains", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.log(`  Retry fetching domains... (attempt ${attempt}/3)`);
        await sleep(2000);
        continue;
      }
      const data = (await res.json()) as any;
      return data.map((d: any) => d.domain);
    } catch {
      console.log(`  Retry fetching domains... (attempt ${attempt}/3)`);
      await sleep(2000);
    }
  }
  return [];
}

async function checkAccountExists(
  address: string,
  password: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ address, password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function createAccount(
  address: string,
  password: string,
  retries = 7,
): Promise<{
  address: string;
  password: string;
  success: boolean;
  message: string;
}> {
  let delay = 1500;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ address, password }),
      });

      if (res.ok) {
        return { address, password, success: true, message: "Created" };
      }

      const errorText = await res.text();

      if (res.status === 422 && errorText.includes("already used")) {
        return { address, password, success: true, message: "Already exists" };
      }

      if (res.status === 429) {
        console.log(
          `  Rate limited, retrying in ${delay / 1000}s (attempt ${attempt}/${retries})...`,
        );
        await sleep(delay);
        delay *= 2;
        continue;
      }

      return {
        address,
        password,
        success: false,
        message: `HTTP ${res.status}: ${errorText}`,
      };
    } catch (err: any) {
      if (attempt === retries) {
        return { address, password, success: false, message: err.message };
      }
      console.log(
        `  Network error, retrying in ${delay / 1000}s (attempt ${attempt}/${retries})...`,
      );
      await sleep(delay);
      delay *= 2;
    }
  }

  return { address, password, success: false, message: "Max retries reached" };
}

function pad(num: number, size: number): string {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}

async function askCount(): Promise<number> {
  while (true) {
    const input = await ask("How many accounts do you want to create? ");
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1) return num;
    console.log("  Please enter a valid number (1 or more). Try again.\n");
  }
}

async function askDomain(domains: string[]): Promise<string> {
  while (true) {
    console.log("\nAvailable domains:");
    domains.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    console.log();

    let input = await ask(
      "Which domain do you want to use? (enter number or type domain): ",
    );

    input = input.replace(/^@/, "");

    const index = parseInt(input, 10);
    if (!isNaN(index) && index >= 1 && index <= domains.length) {
      const domain = domains[index - 1];
      console.log(`  Using domain: ${domain}\n`);
      return domain;
    }

    if (input.includes(".")) {
      if (domains.includes(input)) {
        console.log(`  Using domain: ${input}\n`);
        return input;
      } else {
        console.log(
          `  Domain "${input}" is not available. Please pick from the list above.\n`,
        );
        continue;
      }
    }

    console.log(
      "  Invalid input. Enter a number from the list or type the full domain.\n",
    );
  }
}

async function askPassword(): Promise<string> {
  while (true) {
    const input = await ask("What password do you want for all accounts? ");
    if (input.length >= 6) return input;
    if (input.length > 0 && input.length < 6) {
      console.log("  Password must be at least 6 characters. Try again.\n");
    } else {
      console.log("  Password cannot be empty. Try again.\n");
    }
  }
}

async function askUsername(): Promise<string> {
  while (true) {
    const input = await ask(
      "What base username do you want? (e.g. 'abc' -> abc01, abc02, ...): ",
    );
    if (input.length > 0)
      return input.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    console.log("  Username cannot be empty. Try again.\n");
  }
}

async function main() {
  console.log("\n========================================");
  console.log(`   ${PROJECT_NAME}`);
  console.log("========================================\n");

  console.log("Fetching available domains...");
  const domains = await fetchDomains();
  if (domains.length === 0) {
    console.log(
      "Could not fetch any domains from mail.tm. Check your internet and try again.",
    );
    rl.close();
    return;
  }
  console.log(`Found ${domains.length} domain(s).\n`);

  const count = await askCount();
  const domain = await askDomain(domains);
  const password = await askPassword();
  const baseUsername = await askUsername();

  console.log(`\nChecking if "${baseUsername}@${domain}" already exists...`);
  const exists = await checkAccountExists(
    `${baseUsername}@${domain}`,
    password,
  );
  if (exists) {
    console.log(
      `  "${baseUsername}@${domain}" already exists. Sequential accounts will still be created.\n`,
    );
  } else {
    console.log(`  "${baseUsername}@${domain}" is available.\n`);
  }

  const padSize = String(count).length < 2 ? 2 : String(count).length;

  console.log("========================================");
  console.log(`  Creating ${count} account(s)...`);
  console.log(
    `  Pattern: ${baseUsername}${pad(1, padSize)}@${domain} - ${baseUsername}${pad(count, padSize)}@${domain}`,
  );
  console.log(`  Password: ${password}`);
  console.log("========================================\n");

  const results: {
    address: string;
    password: string;
    success: boolean;
    message: string;
  }[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= count; i++) {
    const username = `${baseUsername}${pad(i, padSize)}`;
    const address = `${username}@${domain}`;

    process.stdout.write(`[${i}/${count}] Creating ${address}... `);

    const result = await createAccount(address, password);
    results.push(result);

    if (result.success) {
      successCount++;
      console.log(`OK - ${result.message}`);
    } else {
      failCount++;
      console.log(`FAIL - ${result.message}`);
    }

    if (i < count) {
      await sleep(1500);
    }
  }

  let fileContent = "====================================\n";
  fileContent += `  ${PROJECT_NAME} - ACCOUNT EXPORT\n`;
  fileContent += `  Generated: ${new Date().toISOString()}\n`;
  fileContent += "====================================\n\n";
  fileContent += `Total Created: ${successCount}\n`;
  fileContent += `Total Failed: ${failCount}\n\n`;
  fileContent += "--- ACCOUNTS ---\n\n";

  for (const r of results.filter((r) => r.success)) {
    fileContent += `Email: ${r.address}\n`;
    fileContent += `Password: ${r.password}\n`;
    fileContent += "---\n";
  }

  if (failCount > 0) {
    fileContent += "\n--- FAILED ---\n\n";
    for (const r of results.filter((r) => !r.success)) {
      fileContent += `Email: ${r.address}\n`;
      fileContent += `Reason: ${r.message}\n`;
      fileContent += "---\n";
    }
  }

  fs.writeFileSync(OUTPUT_FILE, fileContent, "utf-8");

  console.log("\n========================================");
  console.log("  DONE!");
  console.log(`  Created: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Saved to: ${OUTPUT_FILE}`);
  console.log("========================================\n");

  rl.close();
}

main().catch((err) => {
  console.error("Something went wrong:", err.message);
  console.error("Please check your internet connection and try again.");
  rl.close();
  process.exit(1);
});
