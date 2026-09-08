import { materials, semesters, subjects } from '../data/materials'
import type { Material, Semester, Subject } from '../domain/types'

export interface MaterialsRepository {
  getSemesters(): Promise<Semester[]>
  getSubjects(): Promise<Subject[]>
  getMaterials(): Promise<Material[]>
  search(query: string): Promise<Material[]>
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru')

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
}
