import { handleInitSubscription } from '../bot/actions/staking-subscription-handlers.js'
import { subscribeKeyBoard } from '../bot/keyboards/validators-menu-keyboard.js'

export default function initEventsSubscribe(
  bot,
  chatId,
  validatorAddress,
  valName,
  type,
  sizeOfTokens,
  isEpochReward,
  waitingIncludeEpochReward,
) {
  handleInitSubscription(chatId, validatorAddress, valName, type, sizeOfTokens, isEpochReward)
    .then(() => {
      waitingIncludeEpochReward.set(chatId, false)

      bot.sendMessage(chatId, `Event for ${valName} has been added ✅`, {
        reply_markup: subscribeKeyBoard(),
      })
    })
    .catch(() => {
      bot.sendMessage(
        chatId,
        `This event has already been added for ${valName}❗️\n\n If you want change, please unsubscribe from old one.`,
        {
          reply_markup: subscribeKeyBoard(),
        },
      )
    })
}
