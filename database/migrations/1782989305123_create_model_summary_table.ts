import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'model_summary'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('model_id').notNullable()
      table.string('lot_no', 255).notNullable()
      table.string('shift', 50).notNullable()
      table.string('line_no', 50).notNullable()

      table.integer('total').notNullable().defaultTo(0)
      // NULL means "no actual/target set yet" — distinct from actual = 0.
      // Mirrors the original CASE WHEN MAX(actual_records.actual) IS NULL
      // THEN '' logic from the old live-aggregated query.
      table.integer('actual').nullable().defaultTo(null)
      table.string('status', 10).notNullable().defaultTo('')

      table.datetime('first_created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // One row per group — this IS the group, so it's the natural primary key.
      table.primary(['model_id', 'lot_no', 'shift', 'line_no'])

      // Powers dataSummary()'s default ORDER BY firstCreatedAt DESC LIMIT/OFFSET
      table.index(['first_created_at'], 'idx_model_summary_first_created_at')
      // Powers lotNo filter search
      table.index(['lot_no'], 'idx_model_summary_lot_no')
      // Powers modelName filter search (joins to models.id)
      table.index(['model_id'], 'idx_model_summary_model_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
