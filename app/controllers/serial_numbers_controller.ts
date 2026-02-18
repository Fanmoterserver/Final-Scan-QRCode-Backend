import type { HttpContext } from '@adonisjs/core/http'
import SerialNumber from '#models/serial_number'
import { serialNumberValidator } from '#validators/serial_number'
import Model from '#models/model'

// Import upload excel file
import Excel from 'xlsx'
import Application from '@adonisjs/core/services/app'
import fs from 'fs/promises'
import db from '@adonisjs/lucid/services/db'

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
    if (!file) return response.badRequest({ message: 'No file uploaded' })

    const filePath = Application.tmpPath(`uploads/${file.clientName}`)
    await file.move(Application.tmpPath('uploads'), { name: file.clientName })

    try {
      const workbook = Excel.readFile(filePath)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      // 1. Extract Metadata from specific cells
      // Note: xlsx cells are 0-indexed internally, but standard access uses names
      const modelName = sheet['D1']?.v // Cell D1
      const lotNo = sheet['B2']?.v?.toString() // Cell B2
      const lineNo = sheet['D2']?.v // Cell D2

      if (!modelName || !lotNo || !lineNo) {
        return response.badRequest({ message: 'Missing Model, Lot, or Line information in header' })
      }

      // 2. Logic for Shift (Odd = A, Even = B)
      const lastChar = lotNo.toString().slice(-1)
      const lastDigit = parseInt(lastChar)

      if (isNaN(lastDigit)) {
        return response.badRequest({
          message: `Lot number '${lotNo}' must end in a digit to determine the shift.`,
        })
      }

      const shift = lastDigit % 2 !== 0 ? 'A' : 'B'

      // 3. Get Model ID
      const model = await Model.findBy('model_name', modelName)
      if (!model) return response.badRequest({ message: `Model '${modelName}' not found` })

      // 4. Extract Serial Numbers starting from Row 5
      // 'range: 4' tells it to skip the first 4 rows (0, 1, 2, 3)
      const data = Excel.utils.sheet_to_json(sheet, { range: 3 })

      const formattedRows = data
        .map((row: any) => ({
          model_id: model.id,
          shift: shift,
          line_no: lineNo,
          lot_no: lotNo,
          serial_number: row['Serial Number'], // Matches the green header in your image
          created_at: new Date(),
          updated_at: new Date(),
        }))
        .filter((row) => !!row.serial_number)

      // ... (rest of your existing duplicate checking and insert logic) ...

      // Existing duplicate check logic remains the same
      const existingSerials = await SerialNumber.query()
        .where('model_id', model.id)
        .where('lot_no', lotNo)
        .select('serial_number')

      const existingSet = new Set(existingSerials.map((s) => s.serialNumber))
      const duplicates: string[] = []
      const uniqueRows = formattedRows.filter((row) => {
        const isDup = existingSet.has(row.serial_number)
        if (isDup) duplicates.push(row.serial_number)
        return !isDup
      })

      if (uniqueRows.length > 0) {
        await db.table('serial_numbers').insert(uniqueRows)
      }

      await fs.unlink(filePath)

      return response.ok({
        message: 'Upload completed',
        inserted: uniqueRows.length,
        skipped: duplicates.length,
        shift_detected: shift,
      })
    } catch (error) {
      console.error(error)
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

        const lotPrefix = lotNo.slice(0, 4)
        const serialSuffix = serialNumber.slice(-7)
        console.log('lot prefix:', lotPrefix, 'and serial suffix:', serialSuffix)

        const exists = await SerialNumber.query()
          .where('model_id', modelId)
          .whereRaw('LEFT(lot_no, 4) = ?', [lotPrefix])
          .whereRaw('RIGHT(serial_number, 7) = ?', [serialSuffix])
          .first()

        if (exists) {
          return response.status(409).send({
            success: false,
            message: 'Duplicate serial number not allowed.',
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
            message: 'Duplicate serial number not allowed.',
          })
        }
      }
    }

    // ✅ If not duplicate, proceed to create
    const newSerialNumber = await SerialNumber.create(payload)

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
    await serialNumber.delete()
    return response.ok({ message: 'Serial number deleted successfully' })
  }
}
