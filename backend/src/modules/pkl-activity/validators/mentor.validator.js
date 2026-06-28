const { z } = require('zod');

// Regex untuk YYYY-MM-DD
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Schema untuk GET /api/v1/mentor/siswa
const getSiswaBimbinganSchema = z.object({
  query: z.object({
    date: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD').optional()
  })
});

// Schema untuk PUT /api/v1/mentor/evaluasi-harian
const dailyEvaluationSchema = z.object({
  body: z.object({
    evaluation_date: z.string({
      required_error: 'Field evaluation_date wajib diisi'
    }).regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
    
    student_id: z.string({
      required_error: 'Field student_id wajib diisi'
    }).min(1, 'student_id tidak boleh kosong'),

    wkt_point: z.union([z.literal(0), z.literal(1)], {
      errorMap: () => ({ message: 'Poin aspek wkt_point harus bernilai 0 atau 1.' })
    }),
    skp_point: z.union([z.literal(0), z.literal(1)], {
      errorMap: () => ({ message: 'Poin aspek skp_point harus bernilai 0 atau 1.' })
    }),
    has_point: z.union([z.literal(0), z.literal(1)], {
      errorMap: () => ({ message: 'Poin aspek has_point harus bernilai 0 atau 1.' })
    }),
    ker_point: z.union([z.literal(0), z.literal(1)], {
      errorMap: () => ({ message: 'Poin aspek ker_point harus bernilai 0 atau 1.' })
    }),
    ini_point: z.union([z.literal(0), z.literal(1)], {
      errorMap: () => ({ message: 'Poin aspek ini_point harus bernilai 0 atau 1.' })
    })
  })
});

// Schema untuk POST /api/v1/mentor/evaluasi-harian/kirim
const submitSessionSchema = z.object({
  body: z.object({
    session_date: z.string({
      required_error: 'Field session_date wajib diisi'
    }).regex(dateRegex, 'Format tanggal harus YYYY-MM-DD')
  })
});

// Schema untuk GET /api/v1/mentor/rekap-mingguan
const getWeeklyRekapSchema = z.object({
  query: z.object({
    week_number: z.string({
      required_error: 'Query parameter week_number wajib diisi'
    }).refine(val => !isNaN(parseInt(val, 10)), {
      message: 'Query parameter week_number wajib berupa angka'
    })
  })
});

// Schema untuk PUT /api/v1/mentor/rekap-mingguan/:studentId
const weeklyFeedbackSchema = z.object({
  params: z.object({
    studentId: z.string().min(1, 'Parameter studentId wajib disertakan di URL')
  }),
  body: z.object({
    week_number: z.number({
      required_error: 'Field week_number wajib diisi',
      invalid_type_error: 'Field week_number harus berupa angka/integer'
    }).int(),
    tags: z.array(z.string().min(1, 'Tag tidak boleh kosong'), {
      required_error: 'Tag apresiasi cepat minimal harus dipilih satu',
      invalid_type_error: 'Tags harus berupa array of string'
    }).min(1, 'Tag apresiasi cepat minimal harus dipilih satu'),
    comments: z.string().optional().nullable()
  })
});

// Schema untuk POST /api/v1/mentor/rekap-mingguan/publikasikan
const publishSummarySchema = z.object({
  body: z.object({
    week_number: z.number({
      required_error: 'Field week_number wajib diisi',
      invalid_type_error: 'Field week_number harus berupa angka/integer'
    }).int()
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
        field: e.path.slice(1).join('.'), // body.evaluation_date -> evaluation_date
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
  validateGetSiswaBimbingan: validate(getSiswaBimbinganSchema),
  validateDailyEvaluation: validate(dailyEvaluationSchema),
  validateSubmitSession: validate(submitSessionSchema),
  validateGetWeeklyRekap: validate(getWeeklyRekapSchema),
  validateWeeklyFeedback: validate(weeklyFeedbackSchema),
  validatePublishSummary: validate(publishSummarySchema)
};
