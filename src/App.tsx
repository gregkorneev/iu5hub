import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
import './catalog.css'

function useCatalog() {
  const [data, setData] = useState<{ semesters: Semester[]; subjects: Subject[]; materials: Material[]; courses: Awaited<ReturnType<typeof repository.getCourses>> }>({ semesters: [], subjects: [], materials: [], courses: [] })
  useEffect(() => { void Promise.all([repository.getSemesters(), repository.getSubjects(), repository.getMaterials(), repository.getCourses()]).then(([semesters, subjects, materials, courses]) => setData({ semesters, subjects, materials, courses })) }, [])
  return data
}
function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const direction = useNavigationType() === 'POP' ? 'back' : 'forward'
  useTelegramBackButton(location.pathname !== '/')
  const user = getTelegramUser()
  const [admin, setAdmin] = useState(false)
  useEffect(() => { let current = true; void adminFetch('/api/admin/me').then((response) => response.ok ? response.json() : null).then((data: { isAdmin?: boolean } | null) => { if (current) setAdmin(data?.isAdmin === true) }).catch(() => undefined); return () => { current = false } }, [])
  const home = location.pathname === '/'
  return <div className={`app${home ? ' app--home' : ''}`}><header><Link className="brand" to="/" aria-label="Студент ИУ5 — главная"><img src="/logo-iu5.jpeg" alt="Логотип Студент ИУ5" />Студент ИУ5</Link>{(!home || admin) && <nav aria-label="Основная навигация">{!home && <><Link to="/">Каталог</Link><Link to="/search">Поиск</Link></>}{admin && <Link to="/admin/stats">Статистика</Link>}</nav>}</header>{user && home && <p className="user-greeting">Привет, {user.firstName}</p>}<main key={`${location.pathname}${location.search}`} data-navigation={direction}>{!home && !location.pathname.startsWith('/course/') && !location.pathname.startsWith('/admin/') && <button className="in-app-back" onClick={() => goBack(navigate)}>← Назад</button>}{children}</main><footer>Студент ИУ5 · Материалы открываются на Яндекс.Диске</footer></div>
}
function Home() {
  const { courses } = useCatalog()
  return <><section className="hero"><p className="eyebrow">Учебные материалы</p><h1>Студент ИУ5</h1><p>Выберите курс или найдите папку по тегу либо преподавателю.</p><SearchBox /></section><section className="home-courses"><div className="section-title"><div><p className="eyebrow">Курсы</p><h2>Материалы на Яндекс.Диске</h2></div></div><div className="course-grid">{courses.map((course, index) => <Link key={course.id} to={`/course/${course.id}`} style={{ '--course-color': course.color } as CSSProperties}><span>{index + 1}</span><strong>{course.title}</strong><small>{course.description}</small><b>Открыть каталог →</b></Link>)}</div></section></>
}
function CoursePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
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
  return <><p className="breadcrumb"><Link to="/">Главная</Link> / {course.title}</p><div className="course-actions"><button className="in-app-back" onClick={() => goBack(navigate)}>← Назад</button>{path && <Link className="course-root-link" to={`/course/${id}`}>К корню курса</Link>}</div><h1>{course.title}</h1><p className="lead">{path ? `Папка: ${path.split('/').pop()}` : course.description}</p>{currentCatalog.loading ? <p className="lead">Загружаем материалы…</p> : currentCatalog.error ? <EmptyState title="Каталог пока недоступен">{course.publicUrl ? 'Не удалось загрузить каталог. Попробуйте позже.' : 'Материалы для этого курса пока готовятся.'}</EmptyState> : currentCatalog.items.length ? <div className={catalogItems.some(({ semester }) => semester) ? 'semester-button-grid' : semesterFolder ? 'disk-list semester-subject-grid' : 'disk-list'}>{catalogItems.map(({ item, semester }) => semester ? <Link className="semester-button" key={item.path} to={`/course/${id}?path=${encodeURIComponent(item.path)}`}><span>{semester}</span><strong>семестр</strong><small>Открыть материалы →</small></Link> : item.type === 'dir' ? <Link className="disk-item disk-item--folder" key={item.path} to={`/course/${id}?path=${encodeURIComponent(item.path)}`}><span aria-hidden="true">📁</span><strong>{item.name}</strong><small>Открыть папку</small></Link> : <div className="disk-item disk-file" key={item.path}><button className="disk-file__open" onClick={() => downloadFile(item)}><span aria-hidden="true">📄</span><span><strong>{item.name}</strong><small>Скачать файл</small></span></button><button className="download-button" aria-label={`Скачать ${item.name}`} title="Скачать файл" onClick={() => downloadFile(item)}>⇩</button></div>)}</div> : <EmptyState title="В папке пока нет материалов">Добавьте файлы или подпапки на Яндекс.Диск — они появятся здесь при следующем открытии.</EmptyState>}</>
}
function SemesterPage() { const { id } = useParams(); const { subjects, materials } = useCatalog(); const semester = Number(id); if (!Number.isInteger(semester) || semester < 1) return <EmptyState title="Семестр не найден">Проверьте адрес страницы.</EmptyState>; const filtered = subjects.filter((subject) => subject.semester === semester); return <><p className="breadcrumb"><Link to="/">Главная</Link> / {semester} семестр</p><h1>{semester} семестр</h1>{filtered.length ? <div className="card-grid">{filtered.map((subject) => <SubjectCard key={subject.id} subject={subject} count={materials.filter((item) => item.subjectId === subject.id).length} />)}</div> : <EmptyState title="Пока пусто">Материалы для этого семестра ещё не добавлены.</EmptyState>}</> }
function SubjectPage() { const { id, category } = useParams(); const { subjects, materials } = useCatalog(); const subject = subjects.find((item) => item.id === id); useEffect(() => { if (subject) track('subject_open', { subjectId: subject.id }) }, [subject]); if (!subject) return <EmptyState title="Предмет не найден">Возможно, ссылка устарела.</EmptyState>; const filtered = materials.filter((item) => item.subjectId === id && (!category || item.category === category)); return <><p className="breadcrumb"><Link to="/">Главная</Link> / <Link to={`/semester/${subject.semester}`}>{subject.semester} семестр</Link></p><h1>{subject.title}</h1><p className="lead">{subject.description}</p><div className="filters" aria-label="Категории материалов"><Link className={!category ? 'active' : ''} to={`/subject/${id}`}>Все</Link>{Array.from(new Set(materials.filter((item) => item.subjectId === id).map((item) => item.category))).map((key) => <Link key={key} className={category === key ? 'active' : ''} to={`/subject/${id}/${key}`}>{categoryNames[key]}</Link>)}</div>{filtered.length ? <div className="material-list">{filtered.map((material) => <MaterialCard key={material.id} material={material} subject={subject} />)}</div> : <EmptyState title="В этой категории пока нет материалов">Посмотрите все материалы предмета.</EmptyState>}</> }
function MaterialPage() { const { id } = useParams(); const { subjects, materials } = useCatalog(); const material = materials.find((item) => item.id === id); const subject = subjects.find((item) => item.id === material?.subjectId); useEffect(() => { if (material) track('material_open', { materialId: material.id, subjectId: material.subjectId }) }, [material]); if (!material || !subject) return <EmptyState title="Материал не найден">Проверьте ссылку или вернитесь в каталог.</EmptyState>; const safeUrl = isYandexDiskUrl(material.url) ? material.url : null; return <article className="material-detail"><p className="breadcrumb"><Link to={`/subject/${subject.id}`}>{subject.title}</Link> / {categoryNames[material.category]}</p><MaterialTag category={material.category} /><h1>{material.title}</h1>{material.description && <p className="lead">{material.description}</p>}<dl><div><dt>Предмет</dt><dd>{subject.title}</dd></div><div><dt>Добавлено</dt><dd>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(material.addedAt))}</dd></div></dl>{safeUrl ? <button className="button" onClick={() => { track('yandex_disk_open', { materialId: material.id, subjectId: material.subjectId }); openExternalLink(safeUrl) }}>Открыть на Яндекс.Диске <span aria-hidden="true">↗</span></button> : <p role="alert">Ссылка на материал недоступна. Обратитесь к администратору каталога.</p>}</article> }
function SearchPage() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const results = query.trim() ? searchFolders(query) : []
  return <><h1>Поиск</h1><SearchBox key={query} initial={query} />{query ? <p className="result-count">{results.length ? `Найдено папок: ${results.length}` : 'Ничего не найдено'}</p> : <p className="lead">Введите тег или имя преподавателя.</p>}{results.length > 0 && <div className="disk-list">{results.map((item) => <Link className="disk-item disk-item--folder" key={item.objectKey} to={`/course/${item.courseId}?path=${encodeURIComponent(item.diskPath)}`}><strong>{item.name}</strong></Link>)}</div>}</>
}
function NotFound() { return <EmptyState title="Страница не найдена">Такого адреса в Студент ИУ5 нет.</EmptyState> }
function AdminStatsPage() { const { subjects, materials } = useCatalog(); return <AdminStats names={new Map([...subjects, ...materials].map((item) => [item.id, item.title]))} /> }
export default function App() { return <Layout><Routes><Route path="/" element={<Home />} /><Route path="/course/:id" element={<CoursePage />} /><Route path="/semester/:id" element={<SemesterPage />} /><Route path="/subject/:id" element={<SubjectPage />} /><Route path="/subject/:id/:category" element={<SubjectPage />} /><Route path="/material/:id" element={<MaterialPage />} /><Route path="/search" element={<SearchPage />} /><Route path="/admin/stats" element={<AdminStatsPage />} /><Route path="*" element={<NotFound />} /></Routes></Layout> }
