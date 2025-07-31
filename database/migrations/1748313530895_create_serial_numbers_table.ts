import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('model_id', 45).unsigned().references('models.id').notNullable()
      table.string('shift', 45).notNullable()
      table.string('line_no', 45).notNullable()
      table.string('lot_no', 45).notNullable()
      table.string('serial_number', 45).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
