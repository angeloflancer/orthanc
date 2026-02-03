const db = require('./sqlite');

function toWordFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    filePath: row.filePath,
    fileSize: row.fileSize,
    mimeType: row.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    patientId: row.patientId,
    patientName: row.patientName,
    hospital: row.hospital,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName,
    uploadStatus: row.uploadStatus || 'completed',
    uploadedAt: row.uploadedAt
  };
}

function findById(id) {
  const row = db.prepare('SELECT * FROM word_files WHERE id = ?').get(id);
  return toWordFile(row);
}

function find(query, options = {}) {
  const { limit = 100, skip = 0 } = options;
  let sql = 'SELECT * FROM word_files WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
  }
  if (query.hospitalIds && Array.isArray(query.hospitalIds) && query.hospitalIds.length > 0) {
    sql += ' AND hospital IN (' + query.hospitalIds.map(() => '?').join(',') + ')';
    params.push(...query.hospitalIds);
  }
  if (query.patientId != null) {
    sql += ' AND patientId = ?';
    params.push(query.patientId);
  }
  if (query.uploadedBy != null) {
    sql += ' AND uploadedBy = ?';
    params.push(query.uploadedBy);
  }
  sql += ' ORDER BY uploadedAt DESC LIMIT ? OFFSET ?';
  params.push(limit, skip);
  const rows = db.prepare(sql).all(...params);
  return rows.map(toWordFile);
}

function create(fields) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO word_files (fileName, originalFileName, filePath, fileSize, mimeType, patientId, patientName, hospital, uploadedBy, uploadedByName, uploadStatus, uploadedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    fields.fileName,
    fields.originalFileName,
    fields.filePath,
    fields.fileSize,
    fields.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fields.patientId,
    fields.patientName,
    fields.hospital ?? null,
    fields.uploadedBy,
    fields.uploadedByName,
    fields.uploadStatus || 'completed',
    fields.uploadedAt ?? now
  );
  return findById(result.lastInsertRowid);
}

function countDocuments(query) {
  let sql = 'SELECT COUNT(*) AS n FROM word_files WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
  }
  if (query.hospitalIds && Array.isArray(query.hospitalIds) && query.hospitalIds.length > 0) {
    sql += ' AND hospital IN (' + query.hospitalIds.map(() => '?').join(',') + ')';
    params.push(...query.hospitalIds);
  }
  if (query.patientId != null) {
    sql += ' AND patientId = ?';
    params.push(query.patientId);
  }
  if (query.uploadedBy != null) {
    sql += ' AND uploadedBy = ?';
    params.push(query.uploadedBy);
  }
  const row = db.prepare(sql).get(...params);
  return row ? row.n : 0;
}

function deleteMany(query) {
  if (query.hospital != null) {
    return db.prepare('DELETE FROM word_files WHERE hospital = ?').run(query.hospital);
  }
  if (query.patientId != null) {
    return db.prepare('DELETE FROM word_files WHERE patientId = ?').run(query.patientId);
  }
  return { changes: 0 };
}

function deleteById(id) {
  db.prepare('DELETE FROM word_files WHERE id = ?').run(id);
}

module.exports = {
  findById,
  find,
  create,
  countDocuments,
  deleteMany,
  deleteById
};
