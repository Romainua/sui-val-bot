function valInfoKeyboard(validatorData) {
  const keys = Object.keys(validatorData)

  // create buttons array
  const buttonPairs = []
  for (let i = 0; i < keys.length; i += 2) {
    const pair = [
      {
        text: keys[i],
        callback_data: JSON.stringify({ type: 'validator_info', key: keys[i] }).slice(0, 64),
      },
    ]
    if (keys[i + 1]) {
      pair.push({
        text: keys[i + 1],
        callback_data: JSON.stringify({ type: 'validator_info', key: keys[i + 1] }).slice(0, 64),
      })
    }
    buttonPairs.push(pair)
  }

  const keyboard = {
    inline_keyboard: buttonPairs,
  }
  return keyboard
}

export default valInfoKeyboard
