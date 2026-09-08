export type Category = 'lecture' | 'lab' | 'practice' | 'methodical' | 'presentation' | 'video' | 'book' | 'additional' | 'other'

export const categoryNames: Record<Category, string> = {
  lecture: 'Лекции', lab: 'Лабораторные', practice: 'Практика', methodical: 'Методички',
  presentation: 'Презентации', video: 'Видео', book: 'Книги', additional: 'Дополнительно', other: 'Другое',
}

export interface Semester { id: number; title: string }
export interface Subject { id: string; title: string; semester: number; description: string; color: string }
export interface Material { id: string; title: string; subjectId: string; category: Category; description?: string; url: string; keywords: string[]; addedAt: string }
