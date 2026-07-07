import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { deleteModelSummaryForModelAndLot } from '#services/model_summary_service'

export default class SummaryController {
  // GET /summary/data-summary
  //
  // Reads from the precomputed model_summary table instead of aggregating
  // serial_numbers/actual_records on every request. total, actual, status,
  // and firstCreatedAt are already computed and kept in sync by the write
  // paths (serial_numbers_controller store/uploadExcel/destroy,
  // actual_records_controller store) — see model_summary_service.ts.
  //
  // CHANGED: removed the "latest 100 groups" cap for the no-filter case.
  // That cap existed to keep the old serial_numbers aggregation fast, but
  // model_summary is small and indexed, so browsing the full table (with
  // real pagination all the way through) is just as fast as searching.
  // Both filtered and unfiltered requests now use the exact same query
  // shape — a plain indexed SELECT + ORDER BY + LIMIT/OFFSET.
  async dataSummary({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = 10
    const offset = (page - 1) * perPage

    const modelName = request.input('modelName')
    const lotNo = request.input('lotNo')

    const baseQuery = () => {
      const query = db
        .from('model_summary')
        .join('models', 'model_summary.model_id', '=', 'models.id')

      // Case-insensitive prefix match, same behavior as the original
      // controller (whereILike).
      if (modelName) query.whereILike('models.model_name', `${modelName}%`)
      if (lotNo) query.whereILike('model_summary.lot_no', `${lotNo}%`)

      return query
    }

    const total = await baseQuery().count('* as count').first()
    const totalCount = Number(total?.count ?? 0)
    const lastPage = Math.max(1, Math.ceil(totalCount / perPage))

    if (totalCount === 0) {
      return response.ok({
        data: [],
        pagination: { total: 0, perPage, currentPage: page, lastPage },
      })
    }

    const data = await baseQuery()
      .select(
        'models.id as modelId',
        'model_summary.lot_no as lotNo',
        'models.model_name as modelName',
        'models.customer_pn as customerPn',
        'models.pn',
        'models.digit',
        'model_summary.shift',
        'model_summary.line_no as lineNo',
        'model_summary.first_created_at as firstCreatedAt',
        'model_summary.total',
        db.raw('COALESCE(model_summary.actual, 0) as actual'),
        'model_summary.status'
      )
      .orderBy('model_summary.first_created_at', 'desc')
      .limit(perPage)
      .offset(offset)

    return response.ok({
      data,
      pagination: {
        total: totalCount,
        perPage,
        currentPage: page,
        lastPage,
      },
    })
  }
  // DELETE /summary/delete-by-model-and-lot
  async deleteByModelNameAndLot({ request, response }: HttpContext) {
    const modelName = request.input('modelName')
    const lotNo = request.input('lotNo')

    if (!modelName || !lotNo) {
      return response.badRequest({
        message: 'modelName and lotNo are required',
      })
    }

    const trx = await db.transaction()

    try {
      // 1️⃣ Find model id by name
      const model = await trx.from('models').where('model_name', modelName).select('id').first()

      if (!model) {
        await trx.rollback()
        return response.notFound({
          message: 'Model not found',
        })
      }

      // 2️⃣ Delete serial numbers
      const deletedSerials = await trx
        .from('serial_numbers')
        .where('model_id', model.id)
        .where('lot_no', lotNo)
        .delete()

      // 3️⃣ Delete actual records
      await trx.from('actual_records').where('model_id', model.id).where('lot_no', lotNo).delete()

      // 4️⃣ ADDED: keep model_summary in sync — its rows are now stale/orphaned
      // since the underlying serial_numbers/actual_records are gone.
      await deleteModelSummaryForModelAndLot(model.id, lotNo, trx)

      await trx.commit()

      return response.ok({
        message: 'Deleted successfully',
        deletedSerials,
      })
    } catch (error) {
      await trx.rollback()
      return response.internalServerError({
        message: 'Delete failed',
      })
    }
  }
}
