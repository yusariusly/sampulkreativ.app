/**
 * @module PKLActivityMiddlewares
 * @description Authentication, Authorization (RBAC), and Data Ownership middlewares for PKL Activity.
 */

/**
 * JWT / Device Session validation middleware
 */
const validateDeviceSession = async (req, res, next) => {
  try {
    const user_id = req.body.user_id || req.query.user_id || req.headers['x-user-id'];
    const device_id = req.body.device_id || req.query.device_id || req.headers['x-device-id'];

    if (!user_id) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_INPUT',
          message: 'User ID wajib disertakan'
        }
      });
    }

    const [rows] = await req.app.pool.query(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        error: {
          code: 'NOT_FOUND',
          message: 'Pengguna tidak ditemukan'
        }
      });
    }

    const user = rows[0];

    // Hanya validasi device session untuk employee, student, atau mentor role
    if (['employee', 'student', 'mentor'].includes(user.role)) {
      if (user.is_active !== 1) {
        return res.status(403).json({
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'Akun Anda dinonaktifkan atau belum disetujui admin'
          }
        });
      }

      if (!user.device_id || user.device_id.trim() === '') {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Perangkat Anda belum terdaftar atau telah di-reset. Silakan login kembali.'
          }
        });
      }

      if (!device_id || device_id !== user.device_id) {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Sesi perangkat Anda tidak valid. Silakan login kembali.'
          }
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error in validateDeviceSession middleware:', error);
    res.status(500).json({
      status: 'error',
      error: {
        code: 'SERVER_ERROR',
        message: 'Terjadi kesalahan verifikasi sesi perangkat'
      }
    });
  }
};

/**
 * RBAC (Role-Based Access Control) middleware
 * @param {Array<string>} allowedRoles 
 */
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      status: 'error',
      error: {
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki akses ke rute ini'
      }
    });
  }
  next();
};

/**
 * Data Ownership Check middleware (Mentor-Student relationship validation)
 */
const verifyStudentOwnership = async (req, res, next) => {
  try {
    const mentorId = req.user.id;
    const studentId = req.params.studentId || req.body.student_id;

    if (!studentId) {
      return next();
    }

    const [rows] = await req.app.pool.query(
      'SELECT 1 FROM pkl_students WHERE id = ? AND mentor_id = ? LIMIT 1',
      [studentId, mentorId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        error: {
          code: 'FORBIDDEN',
          message: 'Anda tidak memiliki akses ke data siswa ini'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Error verifying student ownership in middleware:', error);
    res.status(500).json({
      status: 'error',
      error: {
        code: 'SERVER_ERROR',
        message: 'Terjadi kesalahan verifikasi kepemilikan data bimbingan'
      }
    });
  }
};

module.exports = {
  validateDeviceSession,
  requireRole,
  verifyStudentOwnership
};
