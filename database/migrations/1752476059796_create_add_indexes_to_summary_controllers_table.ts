import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_indexes_to_summary_controllers'

  async up() {
    this.schema.raw('CREATE INDEX idx_model_name ON models(model_name)')
    this.schema.raw('CREATE INDEX idx_lot_no ON serial_numbers(lot_no)')
    this.schema.raw('CREATE INDEX idx_model_id ON serial_numbers(model_id)')
    this.schema.raw('CREATE INDEX idx_actual_model_lot ON actual_records(model_id, lot_no)')
  }

  async down() {
    this.schema.raw('DROP INDEX idx_model_name ON models')
    this.schema.raw('DROP INDEX idx_lot_no ON serial_numbers')
    this.schema.raw('DROP INDEX idx_model_id ON serial_numbers')
    this.schema.raw('DROP INDEX idx_actual_model_lot ON actual_records')
  }
}
