import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['model_id']) // Drop old constraint
      table
        .integer('model_id')
        .unsigned()
        .references('id')
        .inTable('models')
        .onDelete('CASCADE')
        .alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['model_id'])
      table.integer('model_id').unsigned().references('id').inTable('models').alter()
    })
  }
}
