const db = require('./sqlite');

function toMember(row, hospitalFields) {
  if (!row) return null;
  const obj = {
    id: row.id,
    _id: row.id,
    hospital: row.hospital,
    user: row.user,
    status: row.status,
    invitedBy: row.invitedBy,
    joinedAt: row.joinedAt,
    statusChangedAt: row.statusChangedAt,
    createdAt: row.createdAt
  };
  if (hospitalFields) obj.hospital = hospitalFields;
  return obj;
}

function findById(id) {
  const row = db.prepare('SELECT * FROM hospital_members WHERE id = ?').get(id);
  return toMember(row);
}

function findOne(query, options) {
  options = options || {};
  const withHospital = options.withHospital === true;
  if (query.user != null && query.status == null && query.hospital == null) {
    const row = db.prepare('SELECT * FROM hospital_members WHERE user = ? ORDER BY id DESC LIMIT 1').get(query.user);
    if (!row) return null;
    if (withHospital) {
      const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(row.hospital);
      const h = hospital ? { id: hospital.id, _id: hospital.id, hospitalId: hospital.hospitalId, name: hospital.name, address: hospital.address, admin: hospital.admin, createdAt: hospital.createdAt, updatedAt: hospital.updatedAt } : null;
      return toMember(row, h);
    }
    return toMember(row);
  }
  if (query.hospital != null && query.user != null) {
    const row = db.prepare('SELECT * FROM hospital_members WHERE hospital = ? AND user = ?').get(query.hospital, query.user);
    if (!row) return null;
    if (withHospital) {
      const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(row.hospital);
      const h = hospital ? { id: hospital.id, _id: hospital.id, hospitalId: hospital.hospitalId, name: hospital.name, address: hospital.address, admin: hospital.admin, createdAt: hospital.createdAt, updatedAt: hospital.updatedAt } : null;
      return toMember(row, h);
    }
    return toMember(row);
  }
  if (query.user != null && query.status != null) {
    const row = db.prepare('SELECT m.*, h.id AS h_id, h.hospitalId AS h_hospitalId, h.name AS h_name, h.address AS h_address, h.admin AS h_admin, h.createdAt AS h_createdAt, h.updatedAt AS h_updatedAt FROM hospital_members m LEFT JOIN hospitals h ON m.hospital = h.id WHERE m.user = ? AND m.status = ?').get(query.user, query.status);
    if (!row) return null;
    const memberRow = { id: row.id, hospital: row.hospital, user: row.user, status: row.status, invitedBy: row.invitedBy, joinedAt: row.joinedAt, statusChangedAt: row.statusChangedAt, createdAt: row.createdAt };
    if (withHospital && row.h_id != null) {
      const hospitalFields = { id: row.h_id, _id: row.h_id, hospitalId: row.h_hospitalId, name: row.h_name, address: row.h_address, admin: row.h_admin, createdAt: row.h_createdAt, updatedAt: row.h_updatedAt };
      return toMember(memberRow, hospitalFields);
    }
    return toMember(memberRow);
  }
  return null;
}

function find(query, options) {
  options = options || {};
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  const withHospital = options.withHospital === true;
  if (query.hospital == null) return { rows: [], total: 0 };
  let countSql = 'SELECT COUNT(*) AS n FROM hospital_members WHERE hospital = ?';
  let listSql = 'SELECT * FROM hospital_members WHERE hospital = ?';
  const countParams = [query.hospital];
  const listParams = [query.hospital];
  if (query.status != null) {
    countSql += ' AND status = ?';
    listSql += ' AND status = ?';
    countParams.push(query.status);
    listParams.push(query.status);
  }
  listSql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  listParams.push(limit, skip);
  const countRow = db.prepare(countSql).get(...countParams);
  const total = countRow ? countRow.n : 0;
  const rows = db.prepare(listSql).all(...listParams);
  if (withHospital && rows.length > 0) {
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(query.hospital);
    const hospitalFields = hospital ? { id: hospital.id, _id: hospital.id, hospitalId: hospital.hospitalId, name: hospital.name, address: hospital.address, admin: hospital.admin, createdAt: hospital.createdAt, updatedAt: hospital.updatedAt } : null;
    return { rows: rows.map(r => toMember(r, hospitalFields)), total };
  }
  return { rows: rows.map(toMember), total };
}

function create(fields) {
  const now = Date.now();
  const joinedAt = fields.status === 'accepted' ? (fields.joinedAt || now) : null;
  const stmt = db.prepare('INSERT INTO hospital_members (hospital, user, status, invitedBy, joinedAt, statusChangedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(fields.hospital, fields.user, fields.status || 'pending', fields.invitedBy ?? null, joinedAt, fields.statusChangedAt ?? now, fields.createdAt ?? now);
  const row = db.prepare('SELECT * FROM hospital_members WHERE id = ?').get(result.lastInsertRowid);
  return toMember(row);
}

function update(id, fields) {
  const allowed = ['status', 'joinedAt', 'statusChangedAt'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    set.push(key + ' = ?');
    values.push(fields[key]);
  }
  if (set.length === 0) {
    const row = db.prepare('SELECT * FROM hospital_members WHERE id = ?').get(id);
    return toMember(row);
  }
  if (fields.status === 'accepted') {
    const row = db.prepare('SELECT joinedAt FROM hospital_members WHERE id = ?').get(id);
    if (row && !row.joinedAt) {
      set.push('joinedAt = ?');
      values.push(Date.now());
    }
  }
  values.push(id);
  db.prepare('UPDATE hospital_members SET ' + set.join(', ') + ' WHERE id = ?').run(...values);
  const updated = db.prepare('SELECT * FROM hospital_members WHERE id = ?').get(id);
  return toMember(updated);
}

function deleteById(id) {
  return db.prepare('DELETE FROM hospital_members WHERE id = ?').run(id);
}

function deleteMany(query) {
  if (query.hospital != null && query.user != null) {
    return db.prepare('DELETE FROM hospital_members WHERE hospital = ? AND user = ?').run(query.hospital, query.user);
  }
  if (query.hospital != null) {
    return db.prepare('DELETE FROM hospital_members WHERE hospital = ?').run(query.hospital);
  }
  if (query.user != null) {
    return db.prepare('DELETE FROM hospital_members WHERE user = ?').run(query.user);
  }
  return { changes: 0 };
}

function countDocuments(query) {
  if (query.hospital != null) {
    let sql = 'SELECT COUNT(*) AS n FROM hospital_members WHERE hospital = ?';
    const params = [query.hospital];
    if (query.status != null) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    const row = db.prepare(sql).get(...params);
    return row ? row.n : 0;
  }
  const row = db.prepare('SELECT COUNT(*) AS n FROM hospital_members').get();
  return row ? row.n : 0;
}

module.exports = { findById, findOne, find, create, update, deleteById, deleteMany, countDocuments };
