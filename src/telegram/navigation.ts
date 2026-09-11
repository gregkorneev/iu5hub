import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramWebApp } from './webapp'

export const useTelegramBackButton = (visible: boolean) => {
  const navigate = useNavigate()
  useEffect(() => {
    const button = getTelegramWebApp()?.BackButton
    if (!button) return
    const onBack = () => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')
    if (visible) {
      button.show()
      button.onClick(onBack)
    } else button.hide()
    return () => button.offClick(onBack)
  }, [navigate, visible])
}
