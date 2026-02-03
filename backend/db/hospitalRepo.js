const crypto = require('crypto');
const db = require('./sqlite');

function toHospital(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    hospitalId: row.hospitalId,
    name: row.name,
    address: row.address || '',
    admin: row.admin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function generateHospitalId() {
  let hospitalId;
  let exists = true;
  while (exists) {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    hospitalId = `HSP-${randomPart}`;
    const row = db.prepare('SELECT id FROM hospitals WHERE hospitalId = ?').get(hospitalId);
    exists = !!row;
  }
  return hospitalId;
}

function findById(id) {
  const row = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(id);
  return toHospital(row);
}

function findOne(query) {
  if (query.admin != null) {
    const row = db.prepare('SELECT * FROM hospitals WHERE admin = ?').get(query.admin);
    return toHospital(row);
  }
  if (query.hospitalId != null) {
    const row = db.prepare('SELECT * FROM hospitals WHERE hospitalId = ?').get(query.hospitalId);
    return toHospital(row);
  }
  return null;
}

function create(fields) {
  const hospitalId = fields.hospitalId || generateHospitalId();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO hospitals (hospitalId, name, address, admin, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    hospitalId,
    (fields.name || '').trim(),
    (fields.address || '').trim(),
    fields.admin,
    fields.createdAt ?? now,
    fields.updatedAt ?? now
  );
  return findById(result.lastInsertRowid);
}

function update(id, fields) {
  const allowed = ['name', 'address', 'admin', 'updatedAt'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    set.push(`${key} = ?`);
    values.push(fields[key]);
  }
  if (set.length === 0) return findById(id);
  const now = Date.now();
  if (!fields.updatedAt) {
    set.push('updatedAt = ?');
    values.push(now);
  }
  values.push(id);
  db.prepare(`UPDATE hospitals SET ${set.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function find(options) {
  options = options || {};
  const limit = options.limit != null ? options.limit : 100000;
  const skip = options.skip || 0;
  const order = options.order === 'desc' ? 'DESC' : 'ASC';
  let sql = 'SELECT * FROM hospitals WHERE 1=1';
  const params = [];
  if (options.nameSearch) {
    sql += ' AND name LIKE ?';
    params.push('%' + String(options.nameSearch).replace(/%/g, '\\%') + '%');
  }
  sql += ' ORDER BY createdAt ' + order + ' LIMIT ? OFFSET ?';
  params.push(limit, skip);
  const rows = db.prepare(sql).all(...params);
  return rows.map(toHospital);
}

function countDocuments() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM hospitals').get();
  return row ? row.n : 0;
}

function deleteById(id) {
  db.prepare('DELETE FROM hospitals WHERE id = ?').run(id);
}

module.exports = {
  findById,
  findOne,
  create,
  update,
  find,
  countDocuments,
  deleteById
};
