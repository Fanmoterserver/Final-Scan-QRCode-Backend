import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'models'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('model_name', 45).notNullable().unique()
      table.string('customer_pn', 45).notNullable()
      table.integer('digit', 45).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
