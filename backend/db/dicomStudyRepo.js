const db = require('./sqlite');

function toStudy(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    studyInstanceUid: row.studyInstanceUid,
    orthancStudyId: row.orthancStudyId,
    patientId: row.patientId,
    patientName: row.patientName || '',
    patientBirthDate: row.patientBirthDate || '',
    patientSex: row.patientSex || '',
    studyDate: row.studyDate || '',
    studyTime: row.studyTime || '',
    studyDescription: row.studyDescription || '',
    accessionNumber: row.accessionNumber || '',
    referringPhysicianName: row.referringPhysicianName || '',
    modalitiesInStudy: row.modalitiesInStudy || '',
    seriesCount: row.seriesCount || 0,
    instancesCount: row.instancesCount || 0,
    hospital: row.hospital,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName || '',
    uploadedAt: row.uploadedAt,
    updatedAt: row.updatedAt
  };
}

function findById(id) {
  const row = db.prepare('SELECT * FROM dicom_studies WHERE id = ?').get(id);
  return toStudy(row);
}

function findOne(query) {
  if (query.studyInstanceUid != null) {
    const row = db.prepare('SELECT * FROM dicom_studies WHERE studyInstanceUid = ?').get(query.studyInstanceUid);
    return toStudy(row);
  }
  if (query.orthancStudyId != null) {
    const row = db.prepare('SELECT * FROM dicom_studies WHERE orthancStudyId = ?').get(query.orthancStudyId);
    return toStudy(row);
  }
  return null;
}

function find(query, options) {
  options = options || {};
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  let sql = 'SELECT * FROM dicom_studies WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
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
  return rows.map(toStudy);
}

function create(fields) {
  const now = Date.now();
  const stmt = db.prepare('INSERT INTO dicom_studies (studyInstanceUid, orthancStudyId, patientId, patientName, patientBirthDate, patientSex, studyDate, studyTime, studyDescription, accessionNumber, referringPhysicianName, modalitiesInStudy, seriesCount, instancesCount, hospital, uploadedBy, uploadedByName, uploadedAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(
    fields.studyInstanceUid, fields.orthancStudyId, fields.patientId,
    fields.patientName || '', fields.patientBirthDate || '', fields.patientSex || '',
    fields.studyDate || '', fields.studyTime || '', fields.studyDescription || '',
    fields.accessionNumber || '', fields.referringPhysicianName || '', fields.modalitiesInStudy || '',
    fields.seriesCount ?? 0, fields.instancesCount ?? 0,
    fields.hospital ?? null, fields.uploadedBy ?? null, fields.uploadedByName || '',
    fields.uploadedAt ?? now, fields.updatedAt ?? now
  );
  return findById(result.lastInsertRowid);
}

function update(id, fields) {
  const allowed = ['patientName', 'patientBirthDate', 'patientSex', 'studyDate', 'studyTime', 'studyDescription', 'accessionNumber', 'referringPhysicianName', 'modalitiesInStudy', 'seriesCount', 'instancesCount', 'hospital', 'uploadedBy', 'uploadedByName', 'uploadedAt', 'updatedAt'];
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
  db.prepare('UPDATE dicom_studies SET ' + set.join(', ') + ' WHERE id = ?').run(...values);
  return findById(id);
}

function countDocuments(query) {
  let sql = 'SELECT COUNT(*) AS n FROM dicom_studies WHERE 1=1';
  const params = [];
  if (query.hospital != null) {
    sql += ' AND hospital = ?';
    params.push(query.hospital);
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
    return db.prepare('DELETE FROM dicom_studies WHERE hospital = ?').run(query.hospital);
  }
  if (query.studyInstanceUid != null) {
    return db.prepare('DELETE FROM dicom_studies WHERE studyInstanceUid = ?').run(query.studyInstanceUid);
  }
  return { changes: 0 };
}

function deleteById(id) {
  db.prepare('DELETE FROM dicom_studies WHERE id = ?').run(id);
}

module.exports = { findById, findOne, find, create, update, countDocuments, deleteMany, deleteById };
