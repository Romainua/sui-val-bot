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
    .then(async () => {
      waitingIncludeEpochReward.set(chatId, false)
      await bot.sendMessage(chatId, `Event for ${valName} has been added ✅`, {
        reply_markup: {
          remove_keyboard: true,
        },
      })
      bot.sendMessage(chatId, `Get real-time updates on staking events. Manage your subscriptions below`, {
        reply_markup: subscribeKeyBoard(),
      })
    })
    .catch(async () => {
      await bot.sendMessage(
        chatId,
        `This event has already been added for ${valName}❗️\n\n If you want change, please unsubscribe from old one.`,
        {
          reply_markup: { remove_keyboard: true },
        },
      )
      bot.sendMessage(chatId, `Get real-time updates on staking events. Manage your subscriptions below`, {
        reply_markup: subscribeKeyBoard(),
      })
    })
}
