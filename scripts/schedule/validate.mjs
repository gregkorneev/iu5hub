import { validateDataset } from './common.mjs'

const { index, count } = await validateDataset('public/data/schedule')
console.log(`Schedule data valid: ${index.groups.length} IU5 groups, ${count} JSON files, anchor ${index.cycleAnchor ?? 'unknown'}`)
