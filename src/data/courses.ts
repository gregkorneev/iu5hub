import type { Course } from '../domain/types'

// Paste public Yandex Disk folder links here. They are public links,
// not credentials, and can safely be included in the frontend bundle.
export const courses: Course[] = [
  { id: 'course-1', title: 'Курс 1', description: 'Материалы первого курса', publicUrl: 'https://disk.yandex.ru/d/RWT7_UU8MnKB-Q', color: '#006cdc' },
  { id: 'course-2', title: 'Курс 2', description: 'Материалы второго курса', publicUrl: 'https://disk.yandex.ru/d/PoeWdke_BB291g', color: '#00a57a' },
  { id: 'course-3', title: 'Курс 3', description: 'Материалы третьего курса', publicUrl: 'https://disk.yandex.com/d/4PO5hHMPMaeAEQ', rootPath: '/IU5/3 course', color: '#8a42ba' },
]
