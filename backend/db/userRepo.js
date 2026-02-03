const db = require('./sqlite');

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    blocked: Boolean(row.blocked),
    blockedBy: row.blockedBy,
    blockedReason: row.blockedReason || '',
    emailVerified: Boolean(row.emailVerified),
    emailVerificationToken: row.emailVerificationToken,
    emailVerificationTokenExpiry: row.emailVerificationTokenExpiry,
    createdAt: row.createdAt
  };
}

function findById(id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toUser(row);
}

function findOne(query) {
  if (query.username != null) {
    const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(query.username);
    return toUser(row);
  }
  if (query.email != null) {
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(query.email);
    return toUser(row);
  }
  return null;
}

function findOneByVerificationToken(token) {
  if (!token) return null;
  const now = Date.now();
  const row = db.prepare('SELECT * FROM users WHERE emailVerificationToken = ? AND emailVerificationTokenExpiry > ?').get(token, now);
  return toUser(row);
}

function create(fields) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password, name, role, blocked, blockedBy, blockedReason,
      emailVerified, emailVerificationToken, emailVerificationTokenExpiry, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    (fields.username || '').toLowerCase().trim(),
    (fields.email || '').toLowerCase().trim(),
    fields.password,
    (fields.name || '').trim(),
    fields.role || 'doctor',
    fields.blocked ? 1 : 0,
    fields.blockedBy || null,
    fields.blockedReason || '',
    fields.emailVerified ? 1 : 0,
    fields.emailVerificationToken || null,
    fields.emailVerificationTokenExpiry ?? null,
    fields.createdAt ?? now
  );
  return findById(result.lastInsertRowid);
}

function update(id, fields) {
  const allowed = ['username', 'email', 'password', 'name', 'role', 'blocked', 'blockedBy', 'blockedReason',
    'emailVerified', 'emailVerificationToken', 'emailVerificationTokenExpiry'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    if (key === 'blocked' || key === 'emailVerified') {
      set.push(`${key} = ?`);
      values.push(fields[key] ? 1 : 0);
    } else {
      set.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (set.length === 0) return findById(id);
  values.push(id);
  db.prepare(`UPDATE users SET ${set.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function find(query, options = {}) {
  const { limit = 100, skip = 0 } = options;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (query.role != null) {
    if (Array.isArray(query.role)) {
      sql += ' AND role IN (' + query.role.map(() => '?').join(',') + ')';
      params.push(...query.role);
    } else {
      sql += ' AND role = ?';
      params.push(query.role);
    }
  }
  if (query.blocked != null) {
    sql += ' AND blocked = ?';
    params.push(query.blocked ? 1 : 0);
  }
  if (query.emailVerified != null) {
    sql += ' AND emailVerified = ?';
    params.push(query.emailVerified ? 1 : 0);
  }
  if (query.search) {
    const term = '%' + String(query.search).replace(/%/g, '\\%') + '%';
    sql += ' AND (username LIKE ? OR name LIKE ? OR email LIKE ?)';
    params.push(term, term, term);
  }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, skip);
  const rows = db.prepare(sql).all(...params);
  return rows.map(toUser);
}

function countDocuments(query) {
  let sql = 'SELECT COUNT(*) AS n FROM users WHERE 1=1';
  const params = [];
  if (query.role != null) {
    if (Array.isArray(query.role)) {
      sql += ' AND role IN (' + query.role.map(() => '?').join(',') + ')';
      params.push(...query.role);
    } else {
      sql += ' AND role = ?';
      params.push(query.role);
    }
  }
  if (query.blocked != null) {
    sql += ' AND blocked = ?';
    params.push(query.blocked ? 1 : 0);
  }
  if (query.emailVerified != null) {
    sql += ' AND emailVerified = ?';
    params.push(query.emailVerified ? 1 : 0);
  }
  if (query.search) {
    const term = '%' + String(query.search).replace(/%/g, '\\%') + '%';
    sql += ' AND (username LIKE ? OR name LIKE ? OR email LIKE ?)';
    params.push(term, term, term);
  }
  const row = db.prepare(sql).get(...params);
  return row ? row.n : 0;
}

module.exports = {
  findById,
  findOne,
  findOneByVerificationToken,
  create,
  update,
  find,
  countDocuments
};
