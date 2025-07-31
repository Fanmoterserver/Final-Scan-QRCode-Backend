import vine from '@vinejs/vine'

export const actualRecordValidator = vine.compile(
  vine.object({
    modelId: vine.number().positive().min(1),
    lotNo: vine.string().trim().minLength(1).maxLength(50),
    actual: vine.number().positive().min(1),
  })
)
