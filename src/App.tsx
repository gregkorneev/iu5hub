import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, MaterialCard, MaterialTag, SearchBox, SubjectCard } from './components'
import { categoryNames, type DiskItem, type Material, type Semester, type Subject } from './domain/types'
import { semesterFromFolderName } from './domain/semester-folder'
import { getTelegramUser } from './telegram/user'
import { downloadExternalFile, isYandexDiskUrl, openExternalLink } from './telegram/links'
import { goBack, useTelegramBackButton } from './telegram/navigation'
import { staticMaterialsRepository as repository } from './repositories/materials-repository'
import { searchFolders } from './repositories/folder-search'
import { adminFetch, track } from './analytics'
import { AdminStats } from './AdminStats'
import { FavoritesProvider, useFavorites } from './profile/FavoritesContext'
import { favoriteKey, type FavoriteInput } from './profile/favorites'
import './catalog.css'

function useCatalog() {
  const [data, setData] = useState<{ semesters: Semester[]; subjects: Subject[]; materials: Material[]; courses: Awaited<ReturnType<typeof repository.getCourses>> }>({ semesters: [], subjects: [], materials: [], courses: [] })
  useEffect(() => { void Promise.all([repository.getSemesters(), repository.getSubjects(), repository.getMaterials(), repository.getCourses()]).then(([semesters, subjects, materials, courses]) => setData({ semesters, subjects, materials, courses })) }, [])
  return data
}
const isCatalogRoute = (path: string) => path === '/' || /^\/(?:course|semester|material)\/[^/]+$/.test(path) || /^\/subject\/[^/]+(?:\/[^/]+)?$/.test(path)
function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const direction = useNavigationType() === 'POP' ? 'back' : 'forward'
  useTelegramBackButton(location.pathname !== '/')
  const user = getTelegramUser()
  const [admin, setAdmin] = useState(false)
  useEffect(() => { let current = true; void adminFetch('/api/admin/me').then((response) => response.ok ? response.json() : null).then((data: { isAdmin?: boolean } | null) => { if (current) setAdmin(data?.isAdmin === true) }).catch(() => undefined); return () => { current = false } }, [])
  const home = location.pathname === '/'
  const catalogRoute = isCatalogRoute(location.pathname)
  const activeNav = location.pathname === '/admin/stats' ? 'stats' : location.pathname === '/profile' ? 'profile' : location.pathname === '/search' || (catalogRoute && location.pathname.startsWith('/course/') && location.state?.fromTab === 'search') ? 'search' : catalogRoute ? 'catalog' : null
  const courseRoute = location.pathname.match(/^\/course\/([^/]+)$/)
  const showBack = !home && !location.pathname.startsWith('/admin/') && location.pathname !== '/profile'
  const showCourseRoot = !!courseRoute && !!new URLSearchParams(location.search).get('path')
  const searchResultState = location.state?.fromTab === 'search' ? location.state : undefined
  const searchPath = useRef('/search')
  useEffect(() => {
    const path = location.pathname + location.search
    if (location.pathname === '/search') searchPath.current = path
    if (typeof location.state?.searchPath === 'string') searchPath.current = location.state.searchPath
  }, [activeNav, location.pathname, location.search, location.state])
  const activateSearch = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (location.pathname === '/search') {
      const input = document.querySelector<HTMLInputElement>('.search input[name="q"]')
      if (input) { input.focus({ preventScroll: true }); return }
    }
    const target = searchPath.current
    navigate(target, { state: { focusSearch: true } })
  }
  return <div className={`app${home ? ' app--home' : ''}`}>
    <header>
      <Link className="brand" to="/" aria-label="Студент ИУ5 — главная"><img src="/logo-iu5.jpeg" alt="Логотип Студент ИУ5" />Студент ИУ5</Link>
      {admin && <Link className="admin-stats-link" to="/admin/stats" aria-label="Статистика" aria-current={activeNav === 'stats' ? 'page' : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20V11M9 20V5M15 20v-8M21 20V8" /></svg>
        <span>Статистика</span>
      </Link>}
    </header>
    <div className={`bottom-touch-bar${showBack || showCourseRoot ? ' bottom-touch-bar--context' : ''}`}>
      {(showBack || showCourseRoot) && <div className="bottom-context-actions" role="group" aria-label="Действия текущего раздела">
        {showBack && <button className="in-app-back" onClick={() => goBack(navigate)}>← Назад</button>}
        {showCourseRoot && <Link className="course-root-link" to={`/course/${courseRoute?.[1]}`} state={searchResultState}>К корню курса</Link>}
      </div>}
      <nav className="bottom-nav" aria-label="Основная навигация">
        <Link to="/" aria-current={activeNav === 'catalog' ? 'page' : undefined}>Каталог</Link>
        <Link to="/search" onClick={activateSearch} aria-current={activeNav === 'search' ? 'page' : undefined}>Поиск</Link>
        <Link to="/profile" aria-current={activeNav === 'profile' ? 'page' : undefined}>Профиль</Link>
      </nav>
    </div>
    {user && home && <p className="user-greeting">Привет, {user.firstName}</p>}
    <main key={`${location.pathname}${location.search}`} data-navigation={direction}>{children}</main>
    <footer>Студент ИУ5 · Материалы открываются на Яндекс.Диске</footer>
  </div>
}
function FavoriteButton({ item }: { item: FavoriteInput }) {
  const { keys, loading, error, pending, toggle } = useFavorites()
  const saved = keys.has(favoriteKey(item))
  return <button className={`favorite-button${saved ? ' favorite-button--saved' : ''}`} type="button" aria-label={`${saved ? 'Удалить из избранного' : 'Добавить в избранное'}: ${item.name}`} aria-pressed={saved} title={saved ? 'Удалить из избранного' : 'Добавить в избранное'} disabled={loading || !!error || pending.has(favoriteKey(item))} onClick={() => void toggle(item)}><svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg></button>
}
function Home() {
  const { courses } = useCatalog()
  return <><section className="hero"><p className="eyebrow">Учебные материалы</p><h1>Студент ИУ5</h1><p>Выберите курс, чтобы открыть каталог учебных материалов.</p></section><section className="home-courses"><div className="section-title"><div><p className="eyebrow">Курсы</p><h2>Материалы на Яндекс.Диске</h2></div></div><div className="course-grid">{courses.map((course, index) => <Link key={course.id} to={`/course/${course.id}`} style={{ '--course-color': course.color } as CSSProperties}><span>{index + 1}</span><strong>{course.title}</strong><small>{course.description}</small><b>Открыть каталог →</b></Link>)}</div></section></>
}
function CoursePage() {
  const { id = '' } = useParams()
  const favorites = useFavorites()
  const routeState = useLocation().state
  const fromTab = routeState?.fromTab === 'search' ? routeState : undefined
  const fromFavorite = routeState?.fromFavorite as FavoriteInput | undefined
  const [params] = useSearchParams()
  const path = params.get('path') ?? ''
  const { courses } = useCatalog()
  const course = courses.find((item) => item.id === id)
  const [catalog, setCatalog] = useState<{ key: string; items: DiskItem[]; error: string; loading: boolean }>({ key: '', items: [], error: '', loading: true })
  const key = `${id}:${path}`
  const currentCatalog = catalog.key === key ? catalog : { key, items: [], error: '', loading: true }
  useEffect(() => {
    let active = true
    void repository.getFolder(id, path).then((result) => {
      if (!active) return
      setCatalog({ key, items: result, error: '', loading: false })
    }).catch((reason: unknown) => {
      if (active) setCatalog({ key, items: [], error: reason instanceof Error ? reason.message : 'Не удалось загрузить каталог.', loading: false })
    })
    return () => { active = false }
  }, [id, key, path])
  const downloadFile = (item: DiskItem) => { track('yandex_disk_open', { materialId: item.path }); void repository.getFileUrl(id, item.path).then((url) => downloadExternalFile(url, item.name)).catch((reason: unknown) => setCatalog((previous) => previous.key === key ? { ...previous, error: reason instanceof Error ? reason.message : 'Не удалось скачать файл.' } : previous)) }
  const catalogItems = currentCatalog.items.map((item) => ({ item, semester: !path && item.type === 'dir' ? semesterFromFolderName(item.name) : undefined }))
  const semesterFolder = semesterFromFolderName(path.split('/').pop() ?? '')
  if (!course) return courses.length ? <EmptyState title="Курс не найден">Проверьте адрес страницы.</EmptyState> : <p className="lead">Загружаем курс…</p>
  return <><p className="breadcrumb"><Link to="/">Главная</Link> / {course.title}</p><h1>{course.title}</h1><p className="lead">{path ? `Папка: ${path.split('/').pop()}` : course.description}</p>{(favorites.error || favorites.notice) && <p className="favorite-error" role="alert">{favorites.error || favorites.notice} <button type="button" onClick={favorites.retry}>Повторить</button></p>}{currentCatalog.loading ? <p className="lead">Загружаем материалы…</p> : currentCatalog.error ? currentCatalog.error === 'Папка больше недоступна.' && fromFavorite ? <div className="empty"><h2>Папка больше недоступна</h2><p>Папка была перемещена или удалена.</p><button className="button button--quiet" onClick={() => void favorites.toggle(fromFavorite)}>Удалить из избранного</button></div> : <EmptyState title="Каталог пока недоступен">{course.publicUrl ? 'Не удалось загрузить каталог. Попробуйте позже.' : 'Материалы для этого курса пока готовятся.'}</EmptyState> : currentCatalog.items.length ? <div className={catalogItems.some(({ semester }) => semester) ? 'semester-button-grid' : semesterFolder ? 'disk-list semester-subject-grid' : 'disk-list'}>{catalogItems.map(({ item, semester }) => semester ? <div className="favorite-card" key={item.path}><Link className="semester-button" to={`/course/${id}?path=${encodeURIComponent(item.path)}`} state={fromTab}><span>{semester}</span><strong>семестр</strong><small>Открыть материалы →</small></Link><FavoriteButton item={{ courseId: id, ...item }} /></div> : item.type === 'dir' ? <div className="favorite-card" key={item.path}><Link className="disk-item disk-item--folder" to={`/course/${id}?path=${encodeURIComponent(item.path)}`} state={fromTab}><span aria-hidden="true">📁</span><strong>{item.name}</strong><small>Открыть папку</small></Link><FavoriteButton item={{ courseId: id, ...item }} /></div> : <div className="disk-item disk-file" key={item.path}><button className="disk-file__open" onClick={() => downloadFile(item)}><span aria-hidden="true">📄</span><span><strong>{item.name}</strong><small>Скачать файл</small></span></button><FavoriteButton item={{ courseId: id, ...item }} /><button className="download-button" aria-label={`Скачать ${item.name}`} title="Скачать файл" onClick={() => downloadFile(item)}>⇩</button></div>)}</div> : <EmptyState title="В папке пока нет материалов">Добавьте файлы или подпапки на Яндекс.Диск — они появятся здесь при следующем открытии.</EmptyState>}</>
}
function SemesterPage() { const { id } = useParams(); const { subjects, materials } = useCatalog(); const semester = Number(id); if (!Number.isInteger(semester) || semester < 1) return <EmptyState title="Семестр не найден">Проверьте адрес страницы.</EmptyState>; const filtered = subjects.filter((subject) => subject.semester === semester); return <><p className="breadcrumb"><Link to="/">Главная</Link> / {semester} семестр</p><h1>{semester} семестр</h1>{filtered.length ? <div className="card-grid">{filtered.map((subject) => <SubjectCard key={subject.id} subject={subject} count={materials.filter((item) => item.subjectId === subject.id).length} />)}</div> : <EmptyState title="Пока пусто">Материалы для этого семестра ещё не добавлены.</EmptyState>}</> }
function SubjectPage() { const { id, category } = useParams(); const { subjects, materials } = useCatalog(); const subject = subjects.find((item) => item.id === id); useEffect(() => { if (subject) track('subject_open', { subjectId: subject.id }) }, [subject]); if (!subject) return <EmptyState title="Предмет не найден">Возможно, ссылка устарела.</EmptyState>; const filtered = materials.filter((item) => item.subjectId === id && (!category || item.category === category)); return <><p className="breadcrumb"><Link to="/">Главная</Link> / <Link to={`/semester/${subject.semester}`}>{subject.semester} семестр</Link></p><h1>{subject.title}</h1><p className="lead">{subject.description}</p><div className="filters" aria-label="Категории материалов"><Link className={!category ? 'active' : ''} to={`/subject/${id}`}>Все</Link>{Array.from(new Set(materials.filter((item) => item.subjectId === id).map((item) => item.category))).map((key) => <Link key={key} className={category === key ? 'active' : ''} to={`/subject/${id}/${key}`}>{categoryNames[key]}</Link>)}</div>{filtered.length ? <div className="material-list">{filtered.map((material) => <MaterialCard key={material.id} material={material} subject={subject} />)}</div> : <EmptyState title="В этой категории пока нет материалов">Посмотрите все материалы предмета.</EmptyState>}</> }
function MaterialPage() { const { id } = useParams(); const { subjects, materials } = useCatalog(); const material = materials.find((item) => item.id === id); const subject = subjects.find((item) => item.id === material?.subjectId); useEffect(() => { if (material) track('material_open', { materialId: material.id, subjectId: material.subjectId }) }, [material]); if (!material || !subject) return <EmptyState title="Материал не найден">Проверьте ссылку или вернитесь в каталог.</EmptyState>; const safeUrl = isYandexDiskUrl(material.url) ? material.url : null; return <article className="material-detail"><p className="breadcrumb"><Link to={`/subject/${subject.id}`}>{subject.title}</Link> / {categoryNames[material.category]}</p><MaterialTag category={material.category} /><h1>{material.title}</h1>{material.description && <p className="lead">{material.description}</p>}<dl><div><dt>Предмет</dt><dd>{subject.title}</dd></div><div><dt>Добавлено</dt><dd>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(material.addedAt))}</dd></div></dl>{safeUrl ? <button className="button" onClick={() => { track('yandex_disk_open', { materialId: material.id, subjectId: material.subjectId }); openExternalLink(safeUrl) }}>Открыть на Яндекс.Диске <span aria-hidden="true">↗</span></button> : <p role="alert">Ссылка на материал недоступна. Обратитесь к администратору каталога.</p>}</article> }
function SearchPage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const results = query.trim() ? searchFolders(query) : []
  return <><h1>Поиск</h1><SearchBox key={query} initial={query} autoFocus={location.state?.focusSearch === true} />{query ? <p className="result-count">{results.length ? `Найдено папок: ${results.length}` : 'Ничего не найдено'}</p> : <p className="lead">Введите тег или имя преподавателя.</p>}{results.length > 0 && <div className="disk-list">{results.map((item) => <Link className="disk-item disk-item--folder search-result" key={item.objectKey} to={`/course/${item.courseId}?path=${encodeURIComponent(item.diskPath)}`} state={{ fromTab: 'search' }}><strong>{item.name}</strong><small>{item.path.split('/').slice(0, -1).join(' / ') || item.path}</small></Link>)}</div>}</>
}
function ProfilePage() {
  const user = getTelegramUser()
  const { items, loading, error, notice, retry, toggle } = useFavorites()
  const [openError, setOpenError] = useState('')
  const { courses } = useCatalog()
  const openFile = (item: FavoriteInput) => {
    setOpenError('')
    void repository.getFileUrl(item.courseId, item.path).then((url) => downloadExternalFile(url, item.name)).catch((reason: unknown) => setOpenError(reason instanceof Error && reason.message === 'Файл был перемещён или удалён.' ? `Файл «${item.name}» был перемещён или удалён. Вы можете удалить его из избранного.` : 'Не удалось открыть файл. Попробуйте позже.'))
  }
  return <section className="profile-page"><p className="eyebrow">Ваш профиль</p><h1>{user?.firstName || 'Профиль'}</h1>{user?.username && <p className="profile-username">@{user.username}</p>}<div className="section-title profile-section-title"><div><p className="eyebrow">Ваши материалы</p><h2>Избранное</h2></div><span className="profile-count">{items.length}</span></div>{(openError || notice) && <p className="favorite-error" role="alert">{openError || notice}</p>}{loading ? <p className="lead" role="status">Загружаем избранное…</p> : error ? <div className="empty"><h2>Не удалось загрузить избранное</h2><p>{error}</p><button className="button button--quiet" onClick={retry}>Повторить</button></div> : items.length ? <>{(['dir', 'file'] as const).map((type) => { const group = items.filter((item) => item.type === type); return group.length > 0 && <section className="profile-group" key={type}><h3>{type === 'dir' ? 'Папки' : 'Файлы'}</h3><div className="disk-list">{group.map((item) => <div className="disk-item profile-item" key={favoriteKey(item)}><span className={`profile-item__icon profile-item__icon--${type}`} aria-hidden="true" /><div className="profile-item__content">{type === 'dir' ? <Link to={`/course/${item.courseId}?path=${encodeURIComponent(item.path)}`} state={{ fromFavorite: item }}>{item.name}</Link> : <button type="button" onClick={() => openFile(item)}>{item.name}</button>}<small>{item.path.split('/').slice(0, -1).filter(Boolean).pop() || courses.find((course) => course.id === item.courseId)?.title || 'Каталог'}</small></div><button className="favorite-button favorite-button--saved" type="button" title="Удалить из избранного" aria-label={`Удалить из избранного: ${item.name}`} onClick={() => void toggle(item)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg></button></div>)}</div></section> })}</> : <div className="empty"><h2>В избранном пока ничего нет</h2><p>Добавляйте папки и файлы из каталога — они появятся здесь.</p><Link className="button button--quiet" to="/">Перейти в каталог</Link></div>}</section>
}
function NotFound() { return <EmptyState title="Страница не найдена">Такого адреса в Студент ИУ5 нет.</EmptyState> }
function AdminStatsPage() { const { subjects, materials } = useCatalog(); return <AdminStats names={new Map([...subjects, ...materials].map((item) => [item.id, item.title]))} /> }
export default function App() { return <FavoritesProvider><Layout><Routes><Route path="/" element={<Home />} /><Route path="/course/:id" element={<CoursePage />} /><Route path="/semester/:id" element={<SemesterPage />} /><Route path="/subject/:id" element={<SubjectPage />} /><Route path="/subject/:id/:category" element={<SubjectPage />} /><Route path="/material/:id" element={<MaterialPage />} /><Route path="/search" element={<SearchPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/admin/stats" element={<AdminStatsPage />} /><Route path="*" element={<NotFound />} /></Routes></Layout></FavoritesProvider> }
