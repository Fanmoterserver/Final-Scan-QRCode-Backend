import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class SummaryController {
  async dataSummary({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = 10
    const offset = (page - 1) * perPage

    const modelName = request.input('modelName')
    const lotNo = request.input('lotNo')
    // const hasFilter = !!modelName || !!lotNo

    const applyFilters = (query: any) => {
      if (modelName) query.whereILike('models.model_name', `${modelName}%`)
      if (lotNo) query.whereILike('serial_numbers.lot_no', `${lotNo}%`)
    }

    // STEP 1: Get latest 100 unique group keys
    const baseGroupQuery = db
      .from('serial_numbers')
      .join('models', 'serial_numbers.model_id', '=', 'models.id')
      .select(
        'models.id as model_id',
        'serial_numbers.lot_no',
        'serial_numbers.shift',
        'serial_numbers.line_no',
        db.raw('MIN(serial_numbers.created_at) as firstCreatedAt')
      )
      .groupBy(
        'models.id',
        'serial_numbers.lot_no',
        'serial_numbers.shift',
        'serial_numbers.line_no'
      )
      .orderBy('firstCreatedAt', 'desc')
      .limit(100) // Always limit to 100 groups

    applyFilters(baseGroupQuery)

    const allGroups = await baseGroupQuery
    const total = allGroups.length
    const lastPage = Math.max(1, Math.ceil(total / perPage))

    // Get only groups for the current page
    const paginatedGroups = allGroups.slice(offset, offset + perPage)

    if (paginatedGroups.length === 0) {
      return response.ok({
        data: [],
        pagination: {
          total,
          perPage,
          currentPage: page,
          lastPage,
        },
      })
    }

    // STEP 2: Fetch full data for paginated group keys
    const dataQuery = db
      .from('serial_numbers')
      .join('models', 'serial_numbers.model_id', '=', 'models.id')
      .leftJoin('actual_records', function () {
        this.on('models.id', '=', 'actual_records.model_id').andOn(
          'serial_numbers.lot_no',
          '=',
          'actual_records.lot_no'
        )
      })
      .select(
        'models.id as modelId',
        'serial_numbers.lot_no as lotNo',
        'models.model_name as modelName',
        'models.customer_pn as customerPn',
        'models.digit',
        'serial_numbers.shift',
        'serial_numbers.line_no as lineNo',
        db.raw('MIN(serial_numbers.created_at) as firstCreatedAt'),
        db.raw('COUNT(*) as total'),
        db.raw('COALESCE(MAX(actual_records.actual), 0) as actual'),
        db.raw(`
          CASE
            WHEN MAX(actual_records.actual) IS NULL THEN ''
            WHEN COUNT(*) = MAX(actual_records.actual) THEN 'OK'
            ELSE 'NG'
          END as status
        `)
      )
      .groupBy(
        'models.id',
        'serial_numbers.lot_no',
        'serial_numbers.shift',
        'serial_numbers.line_no'
      )
      .orderBy('firstCreatedAt', 'desc')

    // Filter only by paginated groups
    dataQuery.where((query) => {
      for (const group of paginatedGroups) {
        query.orWhere((sub) => {
          sub
            .where('models.id', group.model_id)
            .where('serial_numbers.lot_no', group.lot_no)
            .where('serial_numbers.shift', group.shift)
            .where('serial_numbers.line_no', group.line_no)
        })
      }
    })

    const data = await dataQuery

    return response.ok({
      data,
      pagination: {
        total,
        perPage,
        currentPage: page,
        lastPage,
      },
    })
  }
}
