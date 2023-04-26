function valInfoKeyboard(validatorData) {
   const keys = Object.keys(validatorData)
   const keyboard = {
      inline_keyboard: keys.map((key) => [
         {
            text: key,
            // Обрезаем данные до 64 байтов для избежания ошибки BUTTON_DATA_INVALID
            callback_data: JSON.stringify({ type: 'valInfo', key: key }).slice(0, 64),
         },
      ]),
   }
   return keyboard
}

export default valInfoKeyboard
// {
//   suiAddress: '0x788fc51bd21e0898e68c106306a9357a7e37416e9b2bfd6a416e56e11393cba6',
//   votingPower: '51',
//   operationCapId: '0xe07ffc72fc917de61110fadb9a7947fff53bd640e4b0133f159fc53555cb862f',
//   gasPrice: '999',
//   commissionRate: '1000',
//   nextEpochStake: '25169769283760509',
//   nextEpochGasPrice: '999',
//   nextEpochCommissionRate: '1000',
//   stakingPoolId: '0x74c3a5f104035d0985978563cea71e3a87dd0aa5c0ce47207656fde10da90484',
//   stakingPoolSuiBalance: '25168751065365128',
//   rewardsPool: '117204014088631',
//   poolTokenBalance: '25051418253763655',
//   pendingStake: '1127264410000',
//   pendingTotalSuiWithdraw: '109046014619',
//   pendingPoolTokenWithdraw: '108537659025',
//   exchangeRatesId: '0xf0665d0fbbf5e61b3367fc896dd53cca7d8597c4172066b127bfe3d60d3c8bed',
//   exchangeRatesSize: '30'
// }
