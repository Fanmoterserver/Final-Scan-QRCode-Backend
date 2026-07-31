import type { HttpContext } from '@adonisjs/core/http'
import SerialNumber from '#models/serial_number'
import { serialNumberValidator } from '#validators/serial_number'
import Model from '#models/model'

// Import upload excel file
import Excel from 'xlsx'
import Application from '@adonisjs/core/services/app'
import fs from 'fs/promises'
import db from '@adonisjs/lucid/services/db'
import {
  incrementModelSummary,
  incrementModelSummaryBulk,
  decrementModelSummary,
} from '#services/model_summary_service'

function findHeaderRowIndex(sheet: Excel.WorkSheet): number | null {
  const range = Excel.utils.decode_range(sheet['!ref'] ?? 'A1')

  // Search rows index 3–5 = Excel rows 4–6 for "Serial Number" header
  for (let rowIndex = 3; rowIndex <= 5; rowIndex++) {
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
      const cellAddress = Excel.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = sheet[cellAddress]
      if (cell?.v?.toString().trim() === 'Serial Number') {
        return rowIndex
      }
    }
  }
  return null
}

export default class SerialNumbersController {
  /**
   * Display a list of resource
   */
  async index({ response }: HttpContext) {
    const data = await SerialNumber.query().preload('model')
    return response.ok(data)
  }

  // upload serial numbers from Excel file
  async uploadExcel({ request, response }: HttpContext) {
    const file = request.file('file', { extnames: ['xlsx', 'xls'], size: '5mb' })

    // ✅ Fix 2: Check file exists
    if (!file) return response.badRequest({ message: 'No file uploaded' })

    // ✅ Fix 3: Check size/extension validation errors
    if (file.hasErrors) {
      return response.badRequest({ message: 'File validation failed', errors: file.errors })
    }

    const filePath = Application.tmpPath(`uploads/${file.clientName}`)

    try {
      // ✅ Fix 4: file.move() inside try/catch
      await file.move(Application.tmpPath('uploads'), { name: file.clientName })

      if (file.hasErrors) {
        return response.badRequest({ message: 'Failed to save uploaded file', errors: file.errors })
      }

      const workbook = Excel.readFile(filePath)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      // ✅ Fix 5: Auto-detect "Serial Number" header row (row 4 or row 5 both work)
      const headerRowIndex = findHeaderRowIndex(sheet)

      if (headerRowIndex === null) {
        return response.badRequest({
          message: 'Could not find "Serial Number" header (checked rows 4–6)',
        })
      }

      // Extract metadata
      const modelName = sheet['D1']?.v
      const lotNo = sheet['B2']?.v?.toString()
      const lineNo = sheet['D2']?.v
      const shiftFromExcel = sheet['D3']?.v

      if (!modelName || !lotNo || !lineNo) {
        return response.badRequest({ message: 'Missing Model, Lot, or Line information in header' })
      }

      let shift: string

      if (lotNo.length === 6) {
        if (!shiftFromExcel) {
          return response.badRequest({
            message: 'Shift (D3) is required when Lot No length is 6',
          })
        }
        shift = shiftFromExcel.toString()
      } else {
        const lastChar = lotNo.toString().slice(-1)
        const lastDigit = parseInt(lastChar)

        if (isNaN(lastDigit)) {
          return response.badRequest({
            message: `Lot number '${lotNo}' must end in a digit to determine the shift.`,
          })
        }

        shift = lastDigit % 2 !== 0 ? 'A' : 'B'
      }

      const model = await Model.findBy('model_name', modelName)
      if (!model) return response.badRequest({ message: `Model '${modelName}' not found` })

      // ✅ Use detected header row instead of hardcoded range: 3
      const data = Excel.utils.sheet_to_json(sheet, { range: headerRowIndex })

      const formattedRows = data
        .map((row: any) => ({
          model_id: model.id,
          shift: shift,
          line_no: lineNo,
          lot_no: lotNo,
          serial_number: row['Serial Number'],
          serial_suffix: row['Serial Number']?.slice(-7),
          created_at: new Date(),
          updated_at: new Date(),
        }))
        .filter((row) => !!row.serial_number)

      let duplicates: string[] = []
      let uniqueRows: any[] = []

      if (model.isEricsson) {
        const suffixes = formattedRows.map((r) => r.serial_suffix)
        const existingSerials = await SerialNumber.query()
          .where('model_id', model.id)
          .whereIn('serial_suffix', suffixes)
          .select('serial_suffix')

        const existingSuffixSet = new Set(existingSerials.map((s) => s.serialSuffix))

        uniqueRows = formattedRows.filter((row) => {
          const suffix = row.serial_number.slice(-7)
          const isDup = existingSuffixSet.has(suffix)
          if (isDup) duplicates.push(row.serial_number)
          return !isDup
        })
      } else {
        const existingSerials = await SerialNumber.query()
          .where('model_id', model.id)
          .where('lot_no', lotNo)
          .select('serial_number')

        const existingSet = new Set(existingSerials.map((s) => s.serialNumber))

        uniqueRows = formattedRows.filter((row) => {
          const isDup = existingSet.has(row.serial_number)
          if (isDup) duplicates.push(row.serial_number)
          return !isDup
        })
      }

      if (uniqueRows.length > 0) {
        await db.table('serial_numbers').insert(uniqueRows)
        // ADDED: keep model_summary in sync with this batch so dataSummary()
        // reflects it immediately without recomputing from raw rows.
        await incrementModelSummaryBulk(uniqueRows)
      }

      return response.ok({
        message: 'Upload completed',
        inserted: uniqueRows.length,
        skipped: duplicates.length,
        shift_detected: shift,
      })
    } catch (error) {
      console.error(error)

      // ✅ Also try cleanup on error, but only after stream is done
      try {
        await fs.unlink(filePath)
      } catch {
        // Safe to ignore
      }
      return response.internalServerError({ message: 'Failed to process file' })
    }
  }

  async filter({ request, response }: HttpContext) {
    const modelName = request.input('modelName')
    const lotNo = request.input('lotNo')
    const serialNumber = request.input('serialNumber')
    const isDownload = request.input('download') === true || request.input('download') === 'true'

    if (!modelName || !lotNo) {
      return response.badRequest({ message: 'modelName and lotNo are required' })
    }

    const serialQuery = SerialNumber.query()
      .where('lot_no', lotNo)
      .whereHas('model', (query) => {
        query.where('model_name', modelName)
      })
      .preload('model', (query) => {
        query.select(['id', 'model_name', 'customer_pn', 'digit'])
      })
      .orderBy('created_at', 'desc')

    // ✅ Add serialNumber filter if provided
    if (serialNumber) {
      serialQuery.where('serial_number', serialNumber)
    }

    // ❌ Only apply limit if not downloading
    if (!isDownload) {
      serialQuery.limit(10)
    }

    const data = await serialQuery

    // Get model_id to count all serial numbers
    const model = await Model.findBy('model_name', modelName)
    let totalCount = 0

    // Total count of serial numbers for this model and lotNo
    if (model) {
      const countQuery = SerialNumber.query().where('model_id', model.id).where('lot_no', lotNo)

      if (serialNumber) {
        countQuery.where('serial_number', serialNumber)
      }

      const result = await countQuery.count('* as count').first()
      totalCount = Number(result?.$extras.count ?? 0)
    }

    return response.ok({
      data,
      totalSerialNumber: totalCount,
    })
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(serialNumberValidator)

    // 🔍 Destructure relevant fields from payload
    const { serialNumber, modelId, lotNo } = payload
    const serialSuffix = serialNumber.slice(-7)

    // 🔍 Get model to check customer_pn and digit
    const model = await Model.find(modelId)

    if (!model) {
      return response.badRequest({ success: false, message: 'Invalid model ID.' })
    }

    // 👉 Skip duplication check if customerPn length === digit
    const isBypassDuplication = model.customerPn.length === model.digit

    if (!isBypassDuplication) {
      if (model.isEricsson) {
        if (lotNo.length < 7 || serialNumber.length < 7) {
          return response.status(422).send({
            success: false,
            message: 'Invalid lot or serial number length for Ericsson model.',
          })
        }
        const exists = await SerialNumber.query()
          .where('model_id', modelId)
          .where('serial_suffix', serialSuffix)
          .first()

        if (exists) {
          return response.status(409).send({
            success: false,
            message: `Model: ${model.modelName} Serial number លេខចុងក្រោយ ${serialSuffix} Scan រួចម្តងហើយសូមចាប់ motor ទុកនៅ tray។`,
          })
        }
      } else {
        // 🔹 normal model logic
        const exists = await SerialNumber.query()
          .where('serial_number', serialNumber)
          .where('model_id', modelId)
          .where('lot_no', lotNo)
          .first()

        if (exists) {
          return response.status(409).send({
            success: false,
            message: `Serial number ${serialNumber} Scan រួចម្តងហើយសូមចាប់ motor ទុកនៅ tray។`,
          })
        }
      }
    }

    // ✅ If not duplicate, proceed to create
    const newSerialNumber = await SerialNumber.create({
      ...payload,
      serialSuffix: serialSuffix,
    })

    // ADDED: keep model_summary in sync. NOTE: verify `payload.shift` and
    // `payload.lineNo` match your actual serialNumberValidator field
    // names — adjust if your validator uses different keys.
    await incrementModelSummary(
      { modelId, lotNo, shift: (payload as any).shift, lineNo: (payload as any).lineNo },
      newSerialNumber.createdAt.toJSDate()
    )

    return response.status(201).send({
      success: true,
      data: newSerialNumber,
      message: 'Serial Number Created!',
    })
  }

  // DELETE /serial_numbers/:id
  async destroy({ params, response }: HttpContext) {
    const serialNumber = await SerialNumber.find(params.id)
    if (!serialNumber) {
      return response.notFound({ message: 'Serial number not found' })
    }

    // CHANGED: was two separate un-transactional calls — if decrement
    // failed after delete had already committed, model_summary would
    // silently drift too high relative to real data (exactly the bug
    // that caused the total mismatch you found). Now both happen in one
    // transaction: if decrement fails, the delete rolls back too.
    const groupKey = {
      modelId: (serialNumber as any).modelId,
      lotNo: (serialNumber as any).lotNo,
      shift: (serialNumber as any).shift,
      lineNo: (serialNumber as any).lineNo,
    }

    const trx = await db.transaction()
    try {
      await serialNumber.useTransaction(trx).delete()
      await decrementModelSummary(groupKey, trx)
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      return response.internalServerError({ message: 'Failed to delete serial number' })
    }

    return response.ok({ message: 'Serial number deleted successfully' })
  }

  /**
   * Helper: find which row index contains "Serial Number" header
   */
}
