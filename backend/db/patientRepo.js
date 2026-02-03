const db = require('./sqlite');

function toPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    patientId: row.patientId,
    hospital: row.hospital,
    patientName: row.patientName,
    patientBirthDate: row.patientBirthDate || '',
    patientSex: row.patientSex || '',
    otherPatientIds: row.otherPatientIds || '',
    dicomStudyCount: row.dicomStudyCount || 0,
    wordFileCount: row.wordFileCount || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function findById(id) {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  return toPatient(row);
}

function findOne(query) {
  if (query.patientId != null && query.hospital != null) {
    const row = db.prepare('SELECT * FROM patients WHERE patientId = ? AND hospital = ?').get(query.patientId, query.hospital);
    return toPatient(row);
  }
  if (query.patientId != null) {
    const row = db.prepare('SELECT * FROM patients WHERE patientId = ?').get(query.patientId);
    return toPatient(row);
  }
  return null;
}

function find(query, options) {
  options = options || {};
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
  }
  if (query.patientId) {
    sql += ' AND patientId LIKE ?';
    params.push('%' + String(query.patientId).replace(/%/g, '\\%') + '%');
  }
  if (query.patientName) {
    sql += ' AND patientName LIKE ?';
    params.push('%' + String(query.patientName).replace(/%/g, '\\%') + '%');
  }
  if (query.patientSex) {
    sql += ' AND patientSex = ?';
    params.push(query.patientSex);
  }
  if (query.patientBirthDateFrom) {
    sql += ' AND patientBirthDate >= ?';
    params.push(query.patientBirthDateFrom);
  }
  if (query.patientBirthDateTo) {
    sql += ' AND patientBirthDate <= ?';
    params.push(query.patientBirthDateTo);
  }
  sql += ' ORDER BY updatedAt DESC LIMIT ? OFFSET ?';
  params.push(limit, skip);
  const rows = db.prepare(sql).all(...params);
  return rows.map(toPatient);
}

function create(fields) {
  const now = Date.now();
  const stmt = db.prepare('INSERT INTO patients (patientId, hospital, patientName, patientBirthDate, patientSex, otherPatientIds, dicomStudyCount, wordFileCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(
    fields.patientId,
    fields.hospital ?? null,
    fields.patientName,
    fields.patientBirthDate || '',
    fields.patientSex || '',
    fields.otherPatientIds || '',
    fields.dicomStudyCount ?? 0,
    fields.wordFileCount ?? 0,
    fields.createdAt ?? now,
    fields.updatedAt ?? now
  );
  return findById(result.lastInsertRowid);
}

function update(id, fields) {
  const allowed = ['patientName', 'patientBirthDate', 'patientSex', 'otherPatientIds', 'dicomStudyCount', 'wordFileCount', 'hospital', 'updatedAt'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    set.push(key + ' = ?');
    values.push(fields[key]);
  }
  if (set.length === 0) return findById(id);
  set.push('updatedAt = ?');
  values.push(Date.now());
  values.push(id);
  db.prepare('UPDATE patients SET ' + set.join(', ') + ' WHERE id = ?').run(...values);
  return findById(id);
}

function countDocuments(query) {
  let sql = 'SELECT COUNT(*) AS n FROM patients WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
  }
  if (query.patientId) {
    sql += ' AND patientId LIKE ?';
    params.push('%' + String(query.patientId).replace(/%/g, '\\%') + '%');
  }
  if (query.patientName) {
    sql += ' AND patientName LIKE ?';
    params.push('%' + String(query.patientName).replace(/%/g, '\\%') + '%');
  }
  if (query.patientSex) {
    sql += ' AND patientSex = ?';
    params.push(query.patientSex);
  }
  if (query.patientBirthDateFrom) {
    sql += ' AND patientBirthDate >= ?';
    params.push(query.patientBirthDateFrom);
  }
  if (query.patientBirthDateTo) {
    sql += ' AND patientBirthDate <= ?';
    params.push(query.patientBirthDateTo);
  }
  const row = db.prepare(sql).get(...params);
  return row ? row.n : 0;
}

function deleteMany(query) {
  if (query.hospital != null) {
    return db.prepare('DELETE FROM patients WHERE hospital = ?').run(query.hospital);
  }
  return { changes: 0 };
}

module.exports = { findById, findOne, find, create, update, countDocuments, deleteMany };
