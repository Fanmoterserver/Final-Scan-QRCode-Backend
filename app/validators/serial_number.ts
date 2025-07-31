import vine from '@vinejs/vine'

export const serialNumberValidator = vine.compile(
  vine.object({
    modelId: vine.number().exists(async (db, value) => {
      const row = await db.from('models').where('id', value).first()
      return !!row
    }),

    shift: vine.enum(['A', 'B'] as const),

    lineNo: vine.string().maxLength(10).trim().minLength(1),

    lotNo: vine.string().maxLength(10).trim().minLength(1),

    serialNumber: vine.string().maxLength(30).trim().minLength(1),
  })
)
