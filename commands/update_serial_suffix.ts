import { BaseCommand } from '@adonisjs/core/ace'

export default class UpdateSerialSuffix extends BaseCommand {
  static commandName = 'serial:update-suffix'
  static description = 'Update serial_suffix in batches'

  // 👇 This tells AdonisJS to boot the full app before running the command
  static options = {
    startApp: true,
  }

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')

    const chunkSize = 10000
    let updated = 0

    this.logger.info('🚀 Start updating serial_suffix...')

    while (true) {
      const rows = await db
        .from('serial_numbers')
        .whereNull('serial_suffix')
        .limit(chunkSize)
        .select('id', 'serial_number')

      if (rows.length === 0) break

      for (const row of rows) {
        await db
          .from('serial_numbers')
          .where('id', row.id)
          .update({ serial_suffix: row.serial_number.slice(-7) })
      }

      updated += rows.length
      this.logger.info(`✅ Updated ${updated} rows...`)
    }

    this.logger.success('🎉 Done updating all serial_suffix!')
  }
}
