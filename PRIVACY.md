# Privacy Policy — Sui Validator Bot

**Last updated:** 12 August 2026

Sui Validator Bot ("the Bot") is a Telegram bot that provides Sui blockchain validator
information, staking event notifications, and relays announcements from public Discord
announcement channels. This policy explains what data the Bot collects, why, and how long it
is kept.

Contact: **hello@n1stake.com** · Source code: **https://github.com/Romainua/sui-val-bot**

---

## 1. Who this applies to

- **Telegram users** who start a conversation with the Bot or add it to a Telegram channel.
- **Discord users** who choose to link their Discord account to verify a role.

The Bot does not collect data about anyone who has not interacted with it.

---

## 2. What we collect

### 2.1 Telegram account data

When you send `/start`, Telegram provides a standard user object which we store:

| Field | Purpose |
|---|---|
| Telegram user ID / chat ID | To address notifications to you |
| Username, first name, last name | Displayed in logs for support and debugging |
| Language code | Reserved for future localisation |

### 2.2 Your preferences

- Validator names you subscribe to, event types (stake / unstake / epoch reward), and any
  token-amount threshold you set.
- Which Discord announcement channels you have switched on or off.
- Telegram channels you have added the Bot to as an administrator (channel ID, title,
  username), so announcements can be relayed there.
- A boolean recording whether your Discord role has been verified.

### 2.3 Discord data (only if you choose to verify)

Role verification is entirely optional. If you start it, you are sent to Discord's official
OAuth consent screen. We request the `identify` scope. After you approve, we receive:

- Your Discord user ID and username.
- Your role membership in the relevant Sui Discord server, checked via Discord's API.

We use this **once**, to answer a single yes/no question: do you hold the role required to
receive validator announcements? We do not read your Discord messages, DMs, friends list,
email address, or any other server you are in.

### 2.4 Discord message content

The Bot monitors a small, fixed list of **public announcement channels** configured by the
operator. When a message is posted in one of those channels, the Bot reads its text and
forwards it to Telegram users who have explicitly subscribed to that channel — either
directly to them, or to a Telegram channel they administer, depending on the subscription
they chose.

**This content is never written to our database.** It is held in memory only for the moment
it takes to reformat and deliver it, then discarded. Messages from every other channel are
dropped immediately without being read or processed.

### 2.5 Blockchain data

Validator names, addresses, staking pools, gas prices and rewards are read from public Sui
network endpoints. This is public on-chain data and is not personal data.

---

## 3. What we never collect

- **Private keys or seed phrases.** The Bot never asks for them. Never send them to any bot.
- Discord message history, DMs, or content from channels outside the configured list.
- Your email address, phone number, IP address, or payment information.
- Message content from Telegram beyond the commands and replies you send to the Bot.

---

## 4. Why we process this (legal basis)

We process the data above to perform the service you asked for — delivering the
notifications you subscribed to. Under GDPR this is *performance of a contract* (Art. 6(1)(b))
for your subscriptions, and *consent* (Art. 6(1)(a)) for the optional Discord verification,
which you may withdraw at any time.

---

## 5. Who we share it with

**Nobody.** We do not sell, rent, or share your data with third parties, advertisers, or
analytics providers.

Data necessarily transits the following services in order to function:

- **Telegram** — to deliver messages to you ([Telegram Privacy Policy](https://telegram.org/privacy)).
- **Discord** — to verify your role and read the configured announcement channels
  ([Discord Privacy Policy](https://discord.com/privacy)).
- **Our database host** — a PostgreSQL instance controlled by the operator.

We disclose data only if legally compelled to do so.

---

## 6. How long we keep it

Your account record and preferences are kept until you delete them. Relayed Discord message
content is never persisted. Operational logs containing usernames and IDs are retained for a
short period for debugging and rotated on an ongoing basis.

---

## 7. Your rights and how to exercise them

You can, at any time:

- **See what we hold** — request a copy of your record.
- **Delete everything** — request erasure of your record and all subscriptions.
- **Unsubscribe** — turn off any individual subscription from the Bot's menus.
- **Revoke Discord access** — remove the Bot's authorisation at
  *Discord → User Settings → Authorized Apps*, and ask us to clear your verification flag.
- **Stop entirely** — block the Bot in Telegram. To have your stored data removed as well,
  send us a deletion request.

To make any of these requests, contact **hello@n1stake.com**. We aim to respond within
30 days.

---

## 8. Security

Data is transmitted over TLS and stored in an access-controlled database. No system is
perfectly secure, and we cannot guarantee absolute security. If a breach affects your data,
we will notify affected users.

---

## 9. Children

The Bot is not intended for anyone under 13, or under the minimum age of digital consent in
their country. We do not knowingly collect data from children.

---

## 10. Changes

We may update this policy. Material changes will be announced through the Bot. The date at
the top always reflects the current version.

---

## 11. Disclaimer

The Bot is provided for informational purposes only and is not financial advice. It is an
independent project and is not affiliated with, endorsed by, or operated by Mysten Labs or
the Sui Foundation.
