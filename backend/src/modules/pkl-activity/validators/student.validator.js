const { z } = require('zod');

// Schema untuk validasi PATCH /api/v1/siswa/tugas/:taskId
const toggleTaskSchema = z.object({
  params: z.object({
    taskId: z.string().min(1, 'Parameter taskId wajib disertakan di URL')
  }),
  body: z.object({
    is_completed: z.boolean({
      required_error: 'Field is_completed wajib disertakan',
      invalid_type_error: 'Field is_completed harus bernilai boolean (true/false)'
    })
  })
});

/**
 * Middleware wrapper untuk validasi skema Zod
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const details = err.issues.map(e => ({
        field: e.path.slice(1).join('.'), // body.is_completed -> is_completed
        message: e.message
      }));
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_INPUT',
          message: 'Validasi data masukan gagal.',
          details
        }
      });
    }
    next(err);
  }
};

module.exports = {
  validateToggleTask: validate(toggleTaskSchema)
};
