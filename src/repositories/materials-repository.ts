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
    const response = await fetchWithTimeout(apiUrl('', course.publicUrl, path))
    if (!response.ok) throw new Error('Не удалось загрузить папку Яндекс.Диска.')
    const data = await response.json() as { _embedded?: { items?: Array<{ name?: string; path?: string; type?: string; modified?: string }> } }
    return (data._embedded?.items ?? []).map((item) => ({ name: item.name ?? 'Без названия', path: item.path ?? item.name ?? '', type: item.type === 'dir' ? 'dir' : 'file', modified: item.modified }))
  },
  async getFileUrl(courseId: string, path: string) {
    const course = configuredCourse(courseId)
    const response = await fetchWithTimeout(apiUrl('/download', course.publicUrl, path))
    if (!response.ok) throw new Error('Не удалось открыть файл на Яндекс.Диске.')
    const data = await response.json() as { href?: string }
    if (!data.href || !isYandexDownloadUrl(data.href)) throw new Error('Яндекс.Диск вернул недопустимую ссылку на файл.')
    return data.href
  },
  async searchDisk(query: string): Promise<DiskSearchResult[]> {
    const term = normalize(query)
    if (!term) return []
    const searchCourse = async (course: Course) => {
      const results: DiskSearchResult[] = []
      const pending = [{ path: '', depth: 0 }]
      const visited = new Set<string>()
      while (pending.length) {
        const paths = pending.splice(0, 8).filter(({ path }) => !visited.has(path))
        paths.forEach(({ path }) => visited.add(path))
        const folders = await Promise.all(paths.map(({ path }) => yandexDiskRepository.getFolder(course.id, path).catch(() => [])))
        for (const [index, items] of folders.entries()) for (const item of items) {
          if (normalize(item.name).includes(term)) results.push({ ...item, courseId: course.id, courseTitle: course.title })
          if (item.type === 'dir' && paths[index].depth < 3 && !visited.has(item.path)) pending.push({ path: item.path, depth: paths[index].depth + 1 })
        }
        if (results.length) return results
      }
      return results
    }
    const configured = courses.filter((course) => isYandexDiskUrl(course.publicUrl))
    const search = new Promise<DiskSearchResult[]>((resolve) => {
      let remaining = configured.length
      if (!remaining) resolve([])
      configured.forEach((course) => { void searchCourse(course).then((results) => { if (results.length) resolve(results); else if (--remaining === 0) resolve([]) }).catch(() => { if (--remaining === 0) resolve([]) }) })
    })
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined
    try {
      return await Promise.race([
        search,
        new Promise<never>((_, reject) => { timeout = globalThis.setTimeout(() => reject(new Error('Поиск на Яндекс.Диске занял слишком много времени.')), diskSearchTimeoutMs) }),
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
