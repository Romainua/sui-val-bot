# Sui Validator Bot

This bot is manager of your validator. Bot uses:

cap operations:

-  `request_set_gas_price`
-  `request_set_commission_rate`
-  `request_withdraw_stake`

not cap operations:

-  `get validator System State info`

## Bot capabilities:

-  fetch gas price for next epoch by 2/3 (6666) of validators
-  set gas for next epoch
-  set commission rate for next epoch
-  add validator in bot
-  delete validator from bot
-  show added validator info (System State)
-  show another validator by name
-  withdraw rewards (from one pool or all)
-  show validator rewards by name

## Deploying

1. Cloning this repo
2. Creating .env file into sui-val-bot dir with following info:

```
TELEGRAM_BOT_TOKEN=<SOME_TOKEN>
apiUrl=https://fullnode.testnet.sui.io
```

recommended to use the endpoint `https://fullnode.testnet.sui.io`

3. For this step install docker. Build docker image.

```
sudo docker build -t sui-validator-bot .
```

4. Then run new container with iamge

```
sudo docker run -d --name sui-validator-bot --restart=always sui-validator-bot
```

## Disclaimer

**This project is provided for educational and informational purposes only. The authors do not accept any responsibility
or liability for the use or misuse of the provided code. Please use it at your own risk.**

**Please note that this project has been tested only on the testnet. We cannot guarantee its performance or
functionality on the mainnet or any other network.**
