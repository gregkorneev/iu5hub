export const welcomeStorageKey = 'iu5hub:welcome:v1'

export const hasSeenWelcome = () => {
  try { return localStorage.getItem(welcomeStorageKey) === 'done' }
  catch { return false }
}
