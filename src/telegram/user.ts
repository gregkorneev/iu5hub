import { getTelegramWebApp } from './webapp'

export const getTelegramUser = () => {
  const user = getTelegramWebApp()?.initDataUnsafe?.user
  return user && { id: String(user.id), firstName: user.first_name, username: user.username, languageCode: user.language_code }
}
