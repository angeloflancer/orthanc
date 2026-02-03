const db = require('./sqlite');

function toSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    hospital: row.hospital,
    planType: row.planType,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function isActive(row) {
  if (!row) return false;
  if (row.planType === 'forever') return true;
  if (!row.expiresAt) return true;
  return row.expiresAt > Date.now();
}

function getDaysUntilExpiration(row) {
  if (!row || row.planType === 'forever' || !row.expiresAt) return null;
  const diffTime = row.expiresAt - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function shouldShowWarning(row) {
  if (!row || row.planType === 'forever' || !row.expiresAt) return false;
  const daysUntil = getDaysUntilExpiration(row);
  return daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
}

function findOne(query) {
  if (query.hospital != null) {
    const row = db.prepare('SELECT * FROM hospital_subscriptions WHERE hospital = ?').get(query.hospital);
    return toSubscription(row);
  }
  return null;
}

function create(fields) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO hospital_subscriptions (hospital, planType, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    fields.hospital,
    fields.planType,
    fields.expiresAt ?? null,
    fields.createdAt ?? now,
    fields.updatedAt ?? now
  );
  return findOne({ hospital: fields.hospital });
}

function update(idOrHospital, fields) {
  const allowed = ['planType', 'expiresAt', 'updatedAt'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    set.push(`${key} = ?`);
    values.push(fields[key]);
  }
  if (set.length === 0) {
    const row = typeof idOrHospital === 'number' ? db.prepare('SELECT * FROM hospital_subscriptions WHERE id = ?').get(idOrHospital) : db.prepare('SELECT * FROM hospital_subscriptions WHERE hospital = ?').get(idOrHospital);
    return toSubscription(row);
  }
  set.push('updatedAt = ?');
  values.push(Date.now());
  const byId = typeof idOrHospital === 'number';
  if (byId) {
    values.push(idOrHospital);
    db.prepare(`UPDATE hospital_subscriptions SET ${set.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM hospital_subscriptions WHERE id = ?').get(idOrHospital);
    return toSubscription(row);
  } else {
    values.push(idOrHospital);
    db.prepare(`UPDATE hospital_subscriptions SET ${set.join(', ')} WHERE hospital = ?`).run(...values);
    return findOne({ hospital: idOrHospital });
  }
}

function deleteByHospital(hospitalId) {
  db.prepare('DELETE FROM hospital_subscriptions WHERE hospital = ?').run(hospitalId);
}

module.exports = {
  findOne,
  create,
  update,
  deleteByHospital,
  isActive,
  getDaysUntilExpiration,
  shouldShowWarning
};
