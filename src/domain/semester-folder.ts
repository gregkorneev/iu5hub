export const semesterFromFolderName = (name: string) => name.match(/^(\d+)\s*sem\b/i)?.[1]
