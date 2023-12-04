# Sui Validator Bot with db and cap operations

**If there is no working machine nearby it is enough to have a phone to set the necessary parameters for your
validator**

The bot is manager of your validator. Bot uses:

cap operations:

- `request_set_gas_price`
- `request_set_commission_rate`
- `request_withdraw_stake`
- `transfer sui`
  not cap operations:

- `get validator System State info`

## Bot capabilities:

- fetch gas price for next epoch by 2/3 (6666) of validators
- set gas for next epoch
- set commission rate for next epoch
- add validator in the bot
- delete validator from the bot
- show added validator info (System State)
- show another validator by name
- withdraw rewards (from one pool or all)
- send SUI to another address
- check SUI balance
- show validator rewards by name
- subscribe to stake/unstake events

You can play with bot on mainnet (without cap operations) [t.me/sui_validator_bot](https://t.me/sui_validator_bot)

## Deploying

1. Cloning this repo
2. Creating .env file into sui-val-bot dir with following info:

```
TELEGRAM_BOT_TOKEN=<SOME_TOKEN>
apiUrl=https://fullnode.testnet.sui.io
WEBSOCKET_apiUrl=wss://fullnode.testnet.sui.io
```

recommended to use the endpoint `https://fullnode.testnet.sui.io` and `wss://fullnode.testnet.sui.io`

### Build manually

3. Install all dependencies.

```
npm install
```

4. Start the bot.

```
npm run start
```

### Use Docker

3. For this step install docker. Build docker image.

```
sudo docker build -t sui-validator-bot .
```

4. Then run new container with image

```
sudo docker run -d --name sui-validator-bot --restart=always sui-validator-bot
```

**Do not recommended use your validator key, although it is deleted after the signature is created. The best practice
would be to transfer
[`UnverifiedValidatorOperationCap`](https://github.com/MystenLabs/sui/blob/main/nre/sui_for_node_operators.md#operation-cap)
to another address**

## Disclaimer

**This project is provided for educational and informational purposes only. The authors do not accept any responsibility
or liability for the use or misuse of the provided code. Please use it at your own risk.**

**Please note that this project has been tested only on the testnet. We cannot guarantee its performance or
functionality on the mainnet or any other network.**
