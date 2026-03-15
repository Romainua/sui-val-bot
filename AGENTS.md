# AGENTS.md

## Project Overview

Sui Validator Bot — a Node.js application that manages Sui blockchain validators via Telegram and Discord. It provides validator info, gas price monitoring, staking event subscriptions, reward tracking, and Discord channel forwarding.

## Tech Stack

- **Runtime:** Node.js 20
- **Module system:** ES modules (`"type": "module"` in `package.json`)
- **Telegram:** `node-telegram-bot-api`
- **Discord:** `discord.js`, `discord-interactions`
- **Blockchain:** `@mysten/sui`, `@mysten/sui.js`
- **Database:** PostgreSQL via `pg`
- **HTTP:** `axios`, `node-fetch`, `express`
- **WebSocket:** `ws`
- **Logging:** `winston`
- **Containerization:** Docker, Docker Compose

## Project Structure

```
src/
├── index.js                    # Entry point — initializes the Telegram bot
├── api-interaction/            # Sui blockchain API and WebSocket clients
├── bot/
│   ├── handlers.js             # Main Telegram command handler registration
│   ├── handlers/               # Specialized handler modules
│   ├── actions/                # Business logic for bot commands
│   └── keyboards/              # Inline keyboard definitions
├── db-interaction/
│   ├── db.js                   # PostgreSQL client connection
│   └── db-hendlers.js          # Database operations (ClientDb class)
├── lib/
│   ├── discord/                # Discord integration and message forwarding
│   └── msg-handlers/           # Message processing and event dispatching
└── utils/
    ├── constants/              # Static text and bot messages
    ├── handle-logs/logger.js   # Winston logger configuration
    ├── getTokenAmountString.js
    └── initEventsSubscribe.js
scripts/
├── discord-auth-server.js      # Discord OAuth2 server (Express)
└── announcements.js
```

## Running the Project

```bash
# Install dependencies
npm install

# Development (requires .env file — see .env.example)
npm run dev                     # Telegram bot with nodemon
npm run discord-auth:dev        # Discord auth server with nodemon

# Production
npm start                       # Telegram bot
npm run discord-auth            # Discord auth server

# Docker
docker compose up --build
```

## Environment Variables

All required env vars are listed in `.env.example`. Key groups: Telegram credentials, Sui API/WebSocket URLs, PostgreSQL connection, Discord OAuth and bot tokens, Discord channel IDs.

## Coding Conventions

### Module System

- ES modules only — use `import`/`export`, never `require()`.
- Always include the `.js` extension in relative imports.
- Use `dotenv.config()` at the top of entry points and modules that read `process.env`.

### Naming

| Entity        | Convention       | Example                        |
|---------------|------------------|--------------------------------|
| Files         | kebab-case       | `discord-forwarder.js`         |
| Functions     | camelCase        | `handleGetPrice`, `attachHandlers` |
| Constants     | UPPER_SNAKE_CASE | `LIST_OF_COMMANDS`, `API_URL`  |
| Classes       | PascalCase       | `ClientDb`                     |

### Style

- No semicolons at end of statements.
- 2-space indentation.
- Arrow functions for callbacks.
- `async`/`await` for all asynchronous code.
- Default exports for main module entry points; named exports for shared utilities.

### Error Handling

- Wrap async operations in `try`/`catch`.
- Log errors via `logger.error()` or `logger.warn()` (Winston).
- Send user-facing error messages through `bot.sendMessage()`.

### Logging

Use the shared Winston logger from `src/utils/handle-logs/logger.js`:

```js
import logger from '../utils/handle-logs/logger.js'

logger.info('Descriptive message')
logger.error(`Operation failed: ${err.message}`)
```

## Testing & Linting

There are currently no tests or linter configurations in this project. The `npm test` script is a placeholder.

## Docker

Two Dockerfiles exist:

- `Dockerfile.telegram` — builds and runs the Telegram bot (`src/index.js`).
- `Dockerfile.discord` — builds and runs the Discord auth server (`scripts/discord-auth-server.js`).

`docker-compose.yml` orchestrates both services. The Telegram bot depends on the Discord auth server.
