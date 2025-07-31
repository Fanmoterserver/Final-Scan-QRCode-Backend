import type { HttpContext } from '@adonisjs/core/http'
import ActualRecord from '#models/actual_record'
import { actualRecordValidator } from '#validators/actual_record'

export default class ActualRecordsController {
  // GET /actual-records?modelId=1&lotNo=LOT123

  async index({ request, response }: HttpContext) {
    try {
      const modelId = request.input('modelId')
      const lotNo = request.input('lotNo')

      const record = await ActualRecord.query()
        .where('model_id', modelId)
        .where('lot_no', lotNo)
        .first()

      return response.ok({
        success: true,
        data: record,
        message: 'Actual record fetched successfully',
      })
    } catch (error) {
      return response.status(500).send({
        success: false,
        message: 'Something went wrong',
      })
    }
  }
  async store({ request, response }: HttpContext) {
    try {
      const { modelId, lotNo, actual } = await request.validateUsing(actualRecordValidator)

      // Get or create record
      const record = await ActualRecord.firstOrCreate({ modelId, lotNo }, { actual })

      // If record existed and actual value is different, update it
      if (record.actual !== actual) {
        record.actual = actual
        await record.save()
      }
      return response.ok({ success: true, data: record, message: 'Actual record success' })
    } catch (error) {
      if (error.status === 422) {
        return response.status(422).send({
          success: false,
          errors: error.messages.map((e: { field: any; message: any }) => ({
            field: e.field,
            message: e.message,
          })),
        })
      }

      // fallback for unknown errors
      return response.status(500).send({
        success: false,
        errors: [{ field: 'form', message: 'Something went wrong. Please try again.' }],
      })
    }
  }
}
