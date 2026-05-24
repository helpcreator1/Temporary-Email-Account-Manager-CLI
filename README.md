# Temporary Email CLI Manager

TypeScript-based command-line tool created for educational and portfolio purposes to demonstrate API integration, CLI workflows, input validation, rate-limit awareness, and file-based output management using the Mail.tm public API.

## Features

- Fetches available Mail.tm domains
- Creates temporary email accounts from the terminal
- Validates user input before making API calls
- Includes retry handling for rate limits and network hiccups
- Saves generated results to a local text file

## Tech Stack

- TypeScript
- Node.js
- Mail.tm public API
- Mastra
- Zod

## Installation

1. Install Node.js 20 or later.
2. Clone the repository.
3. Install dependencies:

   ```bash
   npm install
   ```

## Usage

Run the CLI:

```bash
npx tsx create-accounts.ts
```

The tool will guide you through:

- Number of accounts to create
- Domain selection
- Password entry
- Base username selection

Generated account details are written to `accounts.txt`, which is ignored by Git for safety.

## Responsible Use

This project is intended only for educational, testing, and personal productivity use. It must not be used for spam, abuse, fake signups, bypassing platform rules, or violating any service terms.

## Skills Demonstrated

- TypeScript
- API integration
- CLI development
- Node.js file handling
- Input validation
- Rate-limit awareness
- Responsible automation

## License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
