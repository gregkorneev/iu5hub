import { materials, semesters, subjects } from '../data/materials'
import { courses } from '../data/courses'
import type { Course, DiskItem, DiskSearchResult, Material, Semester, Subject } from '../domain/types'
import { isYandexDiskUrl } from '../telegram/links'

export interface MaterialsRepository {
  getSemesters(): Promise<Semester[]>
  getSubjects(): Promise<Subject[]>
  getMaterials(): Promise<Material[]>
  search(query: string): Promise<Material[]>
  getCourses(): Promise<Course[]>
  getFolder(courseId: string, path?: string): Promise<DiskItem[]>
  getFileUrl(courseId: string, path: string): Promise<string>
  searchDisk(query: string): Promise<DiskSearchResult[]>
}

const normalize = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('ru')
const transliterateRussian = (value: string) => value
  .replace(/shch/g, 'щ').replace(/yo/g, 'ё').replace(/zh/g, 'ж').replace(/kh/g, 'х').replace(/ts/g, 'ц').replace(/ch/g, 'ч').replace(/sh/g, 'ш').replace(/yu/g, 'ю').replace(/ya/g, 'я')
  .replace(/[a-z]/g, (letter) => ({ a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'ы', z: 'з' })[letter] ?? letter)
// The total search deadline must win before an individual folder timeout can
// be swallowed as an empty folder by the resilient recursive traversal.
const diskSearchTimeoutMs = 10_000
const diskRequestTimeoutMs = 12_000
const yandexDownloadHosts = new Set(['disk.yandex.ru', 'downloader.disk.yandex.ru'])
const isYandexDownloadUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' && yandexDownloadHosts.has(url.hostname) } catch { return false }
}
const apiUrl = (endpoint: string, publicUrl: string, path?: string) => {
  const params = new URLSearchParams({ public_key: publicUrl, limit: '1000' })
  if (path) params.set('path', path)
  return `https://cloud-api.yandex.net/v1/disk/public/resources${endpoint}?${params}`
}
const publicResourcePath = (course: Course, path = '') => {
  const rootPath = course.rootPath?.replace(/^\/+|\/+$/g, '') ?? ''
  if (!rootPath) return path
  const requestedPath = path.replace(/^\/+/, '')
  return `/${requestedPath === rootPath || requestedPath.startsWith(`${rootPath}/`) ? requestedPath || rootPath : [rootPath, requestedPath].filter(Boolean).join('/')}`
}
const fetchWithTimeout = (url: string) => {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), diskRequestTimeoutMs)
  return fetch(url, { signal: controller.signal }).finally(() => globalThis.clearTimeout(timeout))
}
const courseById = (id: string) => courses.find((course) => course.id === id)
const configuredCourse = (id: string) => {
  const course = courseById(id)
  if (!course || !isYandexDiskUrl(course.publicUrl)) throw new Error('Для курса не задана публичная ссылка на папку Яндекс.Диска.')
  return course
}

export const yandexDiskRepository = {
  async getCourses() { return courses },
  async getFolder(courseId: string, path = ''): Promise<DiskItem[]> {
    const course = configuredCourse(courseId)
    const response = await fetchWithTimeout(apiUrl('', course.publicUrl, publicResourcePath(course, path)))
    if (response.status === 404) throw new Error('Папка больше недоступна.')
    if (!response.ok) throw new Error('Не удалось загрузить папку Яндекс.Диска.')
    const data = await response.json() as { _embedded?: { items?: Array<{ name?: string; path?: string; type?: string; modified?: string }> } }
    return (data._embedded?.items ?? []).map((item) => ({ name: item.name ?? 'Без названия', path: item.path ?? item.name ?? '', type: item.type === 'dir' ? 'dir' : 'file', modified: item.modified }))
  },
  async getFileUrl(courseId: string, path: string) {
    const course = configuredCourse(courseId)
    const response = await fetchWithTimeout(apiUrl('/download', course.publicUrl, publicResourcePath(course, path)))
    if (response.status === 404) throw new Error('Файл был перемещён или удалён.')
    if (!response.ok) throw new Error('Не удалось открыть файл на Яндекс.Диске.')
    const data = await response.json() as { href?: string }
    if (!data.href || !isYandexDownloadUrl(data.href)) throw new Error('Яндекс.Диск вернул недопустимую ссылку на файл.')
    return data.href
  },
  async searchDisk(query: string): Promise<DiskSearchResult[]> {
    const term = normalize(query)
    if (!term) return []
    const terms = [term, transliterateRussian(term)].filter((value, index, values) => value && values.indexOf(value) === index)
    const searchCourse = async (course: Course) => {
      const results: DiskSearchResult[] = []
      const pending = [{ path: '' }]
      const visited = new Set<string>()
      while (pending.length) {
        const paths = pending.splice(0, 8).filter(({ path }) => !visited.has(path))
        paths.forEach(({ path }) => visited.add(path))
        const folders = await Promise.all(paths.map(({ path }) => yandexDiskRepository.getFolder(course.id, path).catch(() => [])))
        for (const items of folders) for (const item of items) {
          const matches = terms.some((value) => normalize(item.name).includes(value))
          if (matches && !results.some((result) => result.path === item.path)) results.push({ ...item, courseId: course.id, courseTitle: course.title })
          if (item.type === 'dir' && !visited.has(item.path)) {
            if (matches) pending.unshift({ path: item.path })
            else pending.push({ path: item.path })
          }
        }
        if (results.some(({ type }) => type === 'file')) return results
      }
      return results
    }
    const configured = courses.filter((course) => isYandexDiskUrl(course.publicUrl))
    const found: DiskSearchResult[][] = configured.map(() => [])
    const search = Promise.all(configured.map(async (course, index) => {
      found[index] = await searchCourse(course).catch(() => [])
    })).then(() => found.flat())
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined
    try {
      return await Promise.race([
        search,
        new Promise<DiskSearchResult[]>((resolve, reject) => { timeout = globalThis.setTimeout(() => found.some((items) => items.length) ? resolve(found.flat()) : reject(new Error('Поиск на Яндекс.Диске занял слишком много времени.')), diskSearchTimeoutMs) }),
      ])
    } finally { if (timeout) globalThis.clearTimeout(timeout) }
  },
}

export const staticMaterialsRepository: MaterialsRepository = {
  async getSemesters() { return semesters },
  async getSubjects() { return subjects },
  async getMaterials() { return materials },
  async search(query) {
    const term = normalize(query)
    if (!term) return []
    return materials.filter((material) => {
      const subject = subjects.find(({ id }) => id === material.subjectId)
      return [material.title, material.category, material.description ?? '', subject?.title ?? '', ...material.keywords].some((part) => normalize(part).includes(term))
    })
  },
  getCourses: yandexDiskRepository.getCourses,
  getFolder: yandexDiskRepository.getFolder,
  getFileUrl: yandexDiskRepository.getFileUrl,
  searchDisk: yandexDiskRepository.searchDisk,
}
