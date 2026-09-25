import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expandEvents, findGroups, isNumeratorRefreshDue, parseCalendar, replaceAtomically, sameScheduleContent, slug } from './common.mjs'

test('discovery keeps IU5 teaching groups and creates stable ASCII slugs', () => {
  const groups = findGroups({ children: [
    { nodeType: 'group', abbr: 'ИУ5-31Б', uuid: 'a' },
    { nodeType: 'group', abbr: 'ИУ6-31Б', uuid: 'b' },
    { nodeType: 'group', abbr: 'ИУ5-12/4', uuid: 'c' },
  ] })
  assert.deepEqual(groups.map((group) => group.name), ['ИУ5-31Б', 'ИУ5-12/4'])
  assert.equal(slug('ИУ5-31Б'), 'iu5-31b')
  assert.equal(slug('ИУ5-12/4'), 'iu5-12-4')
})

test('14-day refresh gate only opens before a new numerator week', () => {
  assert.equal(isNumeratorRefreshDue('2026-08-31', '2026-09-13'), true)
  assert.equal(isNumeratorRefreshDue('2026-08-31', '2026-09-20'), false)
  assert.equal(isNumeratorRefreshDue('2026-08-31', '2026-09-27'), true)
  assert.equal(isNumeratorRefreshDue('2026-08-31', '2026-10-04'), false)
  assert.equal(isNumeratorRefreshDue('', '2026-09-27'), false)
})

test('ical parser expands recurrence with TZID, BYDAY, EXDATE, RDATE and RECURRENCE-ID', () => {
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:Europe/Moscow\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0300\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Лекция\r\nDESCRIPTION:Занятие\r\nLOCATION:ГУК 505ю\r\nDTSTART;TZID=Europe/Moscow:20260901T090000\r\nDTEND;TZID=Europe/Moscow:20260901T103000\r\nRRULE:FREQ=WEEKLY;COUNT=4;BYDAY=TU\r\nEXDATE;TZID=Europe/Moscow:20260915T090000\r\nRDATE;TZID=Europe/Moscow:20261001T090000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a\r\nRECURRENCE-ID;TZID=Europe/Moscow:20260908T090000\r\nDTSTART;TZID=Europe/Moscow:20260908T100000\r\nDTEND;TZID=Europe/Moscow:20260908T113000\r\nSUMMARY:Лекция перенесена\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
  const { events } = parseCalendar(ics)
  assert.equal(events.length, 1)
  const { days } = expandEvents(events, [], new Date('2026-09-01T00:00:00Z'), new Date('2026-10-10T00:00:00Z'))
  assert.equal(days['2026-09-01'][0].start, '09:00')
  assert.equal(days['2026-09-08'][0].start, '10:00')
  assert.equal(days['2026-09-08'][0].subject, 'Лекция перенесена')
  assert.equal(days['2026-09-15'], undefined)
  assert.equal(days['2026-09-22'][0].start, '09:00')
  assert.equal(days['2026-10-01'][0].start, '09:00')
})

test('malformed and empty calendars fail closed', () => {
  assert.throws(() => parseCalendar('not a calendar'), /complete VCALENDAR/u)
  assert.throws(() => parseCalendar('BEGIN:VCALENDAR\nEND:VCALENDAR'), /no VEVENT/u)
})

test('schedule comparison ignores sync timestamps but detects lesson changes', () => {
  const first = { group: { id: 'iu5-31b' }, source: { provider: 'LKS BMSTU', sourceId: 'a', syncedAt: 'old' }, days: { '2026-09-01': [{ start: '09:00', subject: 'Математика' }] } }
  const next = structuredClone(first); next.source.syncedAt = 'new'
  assert.equal(sameScheduleContent(first, next), true)
  next.days['2026-09-01'][0].start = '10:00'
  assert.equal(sameScheduleContent(first, next), false)
})

test('directory replacement publishes a validated set or restores the previous set on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'iu5-schedule-'))
  const target = join(root, 'data'), stage = join(root, 'staging')
  try {
    await mkdir(target); await writeFile(join(target, 'known-good.json'), 'old')
    await assert.rejects(replaceAtomically(stage, target))
    assert.equal(await readFile(join(target, 'known-good.json'), 'utf8'), 'old')
    await mkdir(stage); await writeFile(join(stage, 'new.json'), 'new')
    await replaceAtomically(stage, target)
    assert.equal(await readFile(join(target, 'new.json'), 'utf8'), 'new')
    await assert.rejects(readFile(join(target, 'known-good.json')))
  } finally { await rm(root, { recursive: true, force: true }) }
})
