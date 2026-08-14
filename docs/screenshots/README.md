# Screenshots

Evidence supporting the Discord Message Content Intent application for this application's
two Telegram bots.

| File | What it shows |
|---|---|
| `sui-announcement-relay.jpg` | Sui Validator Bot delivering a testnet upgrade announcement to a subscribed operator. The forwarded text *is* the announcement — protocol version, activation threshold, commit hash and release tag — and the button links back to the original Discord message. Without Message Content Intent this notification would arrive empty. |
| `walrus-announcement-relay.jpg` | Walrus Assister Bot delivering a storage-node release announcement through the same mechanism, from a different Discord server. |

## How the relay works

The bots monitor a short, explicitly configured allowlist of public announcement channels.
The first statement in each message handler discards anything posted elsewhere, so messages
from other channels are never parsed, logged or stored.

Message content is **not persisted**. On receipt it is reformatted — role mention IDs
resolved to readable names, custom emoji stripped — delivered to subscribers, and discarded.
No message archive exists.

Every subscription is opt-in and per-channel, and can be switched off from the bot at any
time. Access to role-gated announcements additionally requires a Discord role check, which
is re-verified before each relay and revoked automatically if the role is lost.

See the [Privacy Policy](../../PRIVACY.md) for what the bots store about users.
