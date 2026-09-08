import type { Material, Semester, Subject } from '../domain/types'

export const semesters: Semester[] = [1, 2, 3, 4].map((id) => ({ id, title: `${id} семестр` }))

export const subjects: Subject[] = [
  { id: 'physics', title: 'Физика', semester: 3, description: 'Лекции, лабораторные и задачи по общей физике.', color: '#625bf6' },
  { id: 'programming', title: 'Программирование', semester: 3, description: 'Материалы по алгоритмам и разработке.', color: '#00a57a' },
  { id: 'math', title: 'Математический анализ', semester: 2, description: 'Конспекты и задачи для практики.', color: '#e55a3d' },
  { id: 'english', title: 'Английский язык', semester: 1, description: 'Темы, словари и задания.', color: '#d98b00' },
]

export const materials: Material[] = [
  { id: 'physics-e101', title: 'Лабораторная работа Э-101', subjectId: 'physics', category: 'lab', description: 'Исследование электрической цепи постоянного тока.', url: 'https://disk.yandex.ru/', keywords: ['электричество', 'э101', 'цепь'], addedAt: '2026-09-06' },
  { id: 'physics-mechanics-01', title: 'Лекция 1. Механика', subjectId: 'physics', category: 'lecture', description: 'Кинематика и динамика материальной точки.', url: 'https://disk.yandex.ru/', keywords: ['механика', 'кинематика'], addedAt: '2026-09-02' },
  { id: 'physics-tasks', title: 'Задачи по механике', subjectId: 'physics', category: 'practice', url: 'https://disk.yandex.ru/', keywords: ['задачи', 'механика'], addedAt: '2026-08-29' },
  { id: 'programming-git', title: 'Git: практическое руководство', subjectId: 'programming', category: 'methodical', description: 'Базовый workflow для учебных проектов.', url: 'https://disk.yandex.ru/', keywords: ['git', 'контроль версий'], addedAt: '2026-09-07' },
  { id: 'programming-algorithms', title: 'Алгоритмы: лекция 1', subjectId: 'programming', category: 'lecture', url: 'https://disk.yandex.ru/', keywords: ['алгоритмы', 'структуры данных'], addedAt: '2026-09-01' },
  { id: 'math-limits', title: 'Пределы: конспект и примеры', subjectId: 'math', category: 'lecture', url: 'https://disk.yandex.ru/', keywords: ['пределы', 'матан'], addedAt: '2026-08-28' },
  { id: 'english-unit-1', title: 'Unit 1: Technical English', subjectId: 'english', category: 'additional', url: 'https://disk.yandex.ru/', keywords: ['english', 'technical'], addedAt: '2026-08-25' },
]
