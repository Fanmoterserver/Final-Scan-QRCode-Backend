import db from '@adonisjs/lucid/services/db'

/**
 * Keeps the model_summary rollup table in sync with serial_numbers /
 * actual_records. Call these from the same place you write to those
 * tables, ideally inside the same transaction if one is already open.
 *
 * Design notes:
 * - `actual` starts as whatever is currently in actual_records for this
 *   (model_id, lot_no), or NULL if no target has been set yet. This
 *   mirrors the old live query's "IS NULL -> status ''" behavior.
 * - status logic mirrors the original dataSummary() CASE exactly:
 *     actual IS NULL      -> ''
 *     total === actual    -> 'OK'
 *     otherwise            -> 'NG'
 */

interface GroupKey {
  modelId: number
  lotNo: string
  shift: string
  lineNo: string
}

/**
 * Call after inserting ONE serial number row.
 */
export async function incrementModelSummary(
  { modelId, lotNo, shift, lineNo }: GroupKey,
  createdAt: Date,
  trx?: any
) {
  const runner = trx ?? db
  await runner.rawQuery(
    `INSERT INTO model_summary
       (model_id, lot_no, shift, line_no, total, actual, status, first_created_at, updated_at)
     VALUES (
       ?, ?, ?, ?,
       1,
       (SELECT actual FROM actual_records WHERE model_id = ? AND lot_no = ? LIMIT 1),
       '',
       ?,
       NOW()
     )
     ON DUPLICATE KEY UPDATE
       total = total + 1,
       first_created_at = LEAST(first_created_at, VALUES(first_created_at)),
       status = CASE
         WHEN actual IS NULL THEN ''
         WHEN total = actual THEN 'OK'
         ELSE 'NG'
       END,
       updated_at = NOW()`,
    [modelId, lotNo, shift, lineNo, modelId, lotNo, createdAt]
  )
}

/**
 * Call after BULK inserting many serial number rows (e.g. Excel upload).
 * Pass the already-inserted rows so we can group them ourselves — avoids
 * running one upsert per row when a whole lot lands at once.
 */
export async function incrementModelSummaryBulk(
  rows: Array<{
    model_id: number
    lot_no: string
    shift: string
    line_no: string
    created_at: Date
  }>,
  trx?: any
) {
  if (rows.length === 0) return

  const groups = new Map<string, { key: GroupKey; count: number; firstCreatedAt: Date }>()
  for (const row of rows) {
    const groupKey = `${row.model_id}|${row.lot_no}|${row.shift}|${row.line_no}`
    const existing = groups.get(groupKey)
    if (existing) {
      existing.count += 1
      if (row.created_at < existing.firstCreatedAt) existing.firstCreatedAt = row.created_at
    } else {
      groups.set(groupKey, {
        key: { modelId: row.model_id, lotNo: row.lot_no, shift: row.shift, lineNo: row.line_no },
        count: 1,
        firstCreatedAt: row.created_at,
      })
    }
  }

  const runner = trx ?? db
  for (const { key, count, firstCreatedAt } of groups.values()) {
    await runner.rawQuery(
      `INSERT INTO model_summary
         (model_id, lot_no, shift, line_no, total, actual, status, first_created_at, updated_at)
       VALUES (
         ?, ?, ?, ?,
         ?,
         (SELECT actual FROM actual_records WHERE model_id = ? AND lot_no = ? LIMIT 1),
         '',
         ?,
         NOW()
       )
       ON DUPLICATE KEY UPDATE
         total = total + VALUES(total),
         first_created_at = LEAST(first_created_at, VALUES(first_created_at)),
         status = CASE
           WHEN actual IS NULL THEN ''
           WHEN total = actual THEN 'OK'
           ELSE 'NG'
         END,
         updated_at = NOW()`,
      [key.modelId, key.lotNo, key.shift, key.lineNo, count, key.modelId, key.lotNo, firstCreatedAt]
    )
  }
}

/**
 * Call after DELETING one serial number row (need the group key + the
 * row's old values BEFORE you delete it).
 */
export async function decrementModelSummary(
  { modelId, lotNo, shift, lineNo }: GroupKey,
  trx?: any
) {
  const runner = trx ?? db
  await runner.rawQuery(
    `UPDATE model_summary
     SET total = GREATEST(total - 1, 0),
         status = CASE
           WHEN actual IS NULL THEN ''
           WHEN total = actual THEN 'OK'
           ELSE 'NG'
         END,
         updated_at = NOW()
     WHERE model_id = ? AND lot_no = ? AND shift = ? AND line_no = ?`,
    [modelId, lotNo, shift, lineNo]
  )
  // Optional: clean up rows that hit zero so the summary table doesn't
  // accumulate empty groups forever.
  await runner.rawQuery(
    `DELETE FROM model_summary
     WHERE model_id = ? AND lot_no = ? AND shift = ? AND line_no = ? AND total = 0`,
    [modelId, lotNo, shift, lineNo]
  )
}

/**
 * Call after creating/updating an actual_records row (targets apply to
 * ALL shift/line_no groups under the same model_id + lot_no, matching
 * the original query's join behavior).
 */
export async function applyActualToModelSummary(
  modelId: number,
  lotNo: string,
  actual: number,
  trx?: any
) {
  const runner = trx ?? db
  await runner.rawQuery(
    `UPDATE model_summary
     SET actual = ?,
         status = CASE WHEN total = ? THEN 'OK' ELSE 'NG' END,
         updated_at = NOW()
     WHERE model_id = ? AND lot_no = ?`,
    [actual, actual, modelId, lotNo]
  )
}

/**
 * Call from deleteByModelNameAndLot — removes the summary rows entirely
 * since their underlying serial_numbers/actual_records are gone.
 */
export async function deleteModelSummaryForModelAndLot(modelId: number, lotNo: string, trx?: any) {
  const runner = trx ?? db
  await runner.from('model_summary').where('model_id', modelId).where('lot_no', lotNo).delete()
}
