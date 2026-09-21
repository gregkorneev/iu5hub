import { useEffect } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { getTelegramWebApp } from './webapp'

export const goBack = (navigate: NavigateFunction, historyIndex = window.history.state?.idx) => {
  if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
  else navigate('/', { replace: true })
}

export const useTelegramBackButton = (visible: boolean) => {
  const navigate = useNavigate()
  useEffect(() => {
    const button = getTelegramWebApp()?.BackButton
    if (!button) return
    const onBack = () => goBack(navigate)
    if (visible) {
      button.show()
      button.onClick(onBack)
    } else button.hide()
    return () => button.offClick(onBack)
  }, [navigate, visible])
}
