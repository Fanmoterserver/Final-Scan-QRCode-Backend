import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'models'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('pn', 45).after('digit')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pn')
    })
  }
}
