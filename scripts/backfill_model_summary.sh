#!/bin/bash
# Batched backfill: serial_numbers -> model_summary
#
# WHY chunked: aggregating your whole serial_numbers table in one query
# takes long enough to disconnect the client. This runs it in small,
# fast pieces instead — each piece finishes in seconds, no single
# connection has to stay open for the whole thing.
#
# Safe to re-run if it fails partway — ON DUPLICATE KEY UPDATE means
# re-processing an ID range just adds the same numbers again... WAIT:
# that would double-count if re-run blindly. See NOTE below before re-running.

set -e  # stop immediately if any batch fails, so you know where it stopped

DB_USER="root"
DB_PASS="admin"
DB_NAME="finalscanqrcode"
BATCH_SIZE=500000

MYSQL="mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME}"

# SAFETY CHECK: refuse to run if model_summary already has data, since
# re-running without truncating first will double-count every row
# (this is what caused actual/total to look exactly halved last time).
EXISTING_ROWS=$($MYSQL -N -e "SELECT COUNT(*) FROM model_summary")
if [ "$EXISTING_ROWS" -gt 0 ] && [ "$FORCE" != "1" ]; then
  echo "model_summary already has $EXISTING_ROWS rows."
  echo "Running again WITHOUT truncating first will double-count everything."
  echo ""
  echo "To fix: run 'TRUNCATE TABLE model_summary;' in MySQL first, then re-run this script."
  echo "If you're SURE you want to proceed anyway, run: FORCE=1 bash backfill_model_summary.sh"
  exit 1
fi

echo "Finding ID range..."
MIN_ID=$($MYSQL -N -e "SELECT COALESCE(MIN(id), 0) FROM serial_numbers")
MAX_ID=$($MYSQL -N -e "SELECT COALESCE(MAX(id), 0) FROM serial_numbers")
echo "serial_numbers id range: $MIN_ID to $MAX_ID"

start=$MIN_ID
while [ "$start" -le "$MAX_ID" ]; do
  end=$((start + BATCH_SIZE - 1))
  echo "Processing id $start to $end ..."

  $MYSQL -e "
    INSERT INTO model_summary
      (model_id, lot_no, shift, line_no, total, actual, status, first_created_at, updated_at)
    SELECT
      sn.model_id, sn.lot_no, sn.shift, sn.line_no,
      COUNT(*) AS total,
      MAX(ar.actual) AS actual,
      '' AS status,
      MIN(sn.created_at) AS first_created_at,
      NOW() AS updated_at
    FROM serial_numbers sn
    LEFT JOIN actual_records ar
      ON sn.model_id = ar.model_id AND sn.lot_no = ar.lot_no
    WHERE sn.id BETWEEN $start AND $end
    GROUP BY sn.model_id, sn.lot_no, sn.shift, sn.line_no
    ON DUPLICATE KEY UPDATE
      total = total + VALUES(total),
      first_created_at = LEAST(first_created_at, VALUES(first_created_at)),
      actual = VALUES(actual),
      updated_at = NOW();
  "

  start=$((end + 1))
done

echo "All batches done. Recomputing status for every row (fast — small table)..."
$MYSQL -e "
  UPDATE model_summary
  SET status = CASE
    WHEN actual IS NULL THEN ''
    WHEN total = actual THEN 'OK'
    ELSE 'NG'
  END;
"

echo "Backfill complete."