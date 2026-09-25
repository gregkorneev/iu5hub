import { useLayoutEffect, useRef, useState } from 'react'
import { CalendarDays, LibraryBig, Search } from 'lucide-react'
import { welcomeStorageKey } from './welcome-storage'

const steps = [
  { title: 'Материалы по курсам', text: 'Откройте Каталог, выберите курс и перейдите к нужной папке с материалами.', Icon: LibraryBig },
  { title: 'Быстрый поиск', text: 'Ищите папки по тегу или преподавателю с первых букв запроса.', Icon: Search },
  { title: 'Расписание под рукой', text: 'Выберите учебную группу и смотрите пары на сегодня или неделю. Избранное ждёт вас в Профиле.', Icon: CalendarDays },
] as const

export default function Welcome({ onFinish }: { onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLButtonElement>('.welcome-dialog__primary')?.focus()
    return () => { if (element?.open) element.close() }
  }, [])
  const finish = () => {
    try { localStorage.setItem(welcomeStorageKey, 'done') }
    catch { /* The current session still closes if browser storage is unavailable. */ }
    onFinish()
  }
  const { title, text, Icon } = steps[index]
  return <dialog ref={dialog} className="welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-description" onCancel={(event) => { event.preventDefault(); finish() }}>
    <div className="welcome-dialog__content" aria-live="polite">
      <span className="welcome-dialog__icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
      <p className="welcome-dialog__step">Первый запуск · {index + 1} из {steps.length}</p>
      <h2 id="welcome-title">{title}</h2>
      <p id="welcome-description">{text}</p>
    </div>
    <div className="welcome-dialog__actions">
      <button type="button" className="welcome-dialog__skip" onClick={finish}>Пропустить</button>
      <button type="button" className="welcome-dialog__primary" onClick={() => index === steps.length - 1 ? finish() : setIndex(index + 1)}>{index === steps.length - 1 ? 'Начать' : 'Далее'}</button>
    </div>
  </dialog>
}
