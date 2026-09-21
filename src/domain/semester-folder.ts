export const semesterFromFolderName = (name: string) => name.match(/^(\d+)\s*(?:sem\b|семестр)(?:\s|$)/i)?.[1]
