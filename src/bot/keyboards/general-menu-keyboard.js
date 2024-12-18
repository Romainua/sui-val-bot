export function callbackButtonForStartCommand() {
  return {
    remove_keyboard: true,
    inline_keyboard: [
      [
        { text: `I'm Channel Owner 📢`, callback_data: 'general_discord_announcements' },
        { text: `I'm Validator 🤖`, callback_data: 'validators_menu' },
      ],
      [{ text: `I'm Sui User 👤`, callback_data: 'user_menu' }],
    ],
  }
}
