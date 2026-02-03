const db = require('./sqlite');

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'doctor' CHECK(role IN ('doctor','admin','owner')),
      blocked INTEGER NOT NULL DEFAULT 0,
      blockedBy TEXT CHECK(blockedBy IN ('owner','admin') OR blockedBy IS NULL),
      blockedReason TEXT DEFAULT '',
      emailVerified INTEGER NOT NULL DEFAULT 0,
      emailVerificationToken TEXT,
      emailVerificationTokenExpiry INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospitalId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      admin INTEGER NOT NULL UNIQUE REFERENCES users(id),
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_hospitals_admin ON hospitals(admin);
    CREATE INDEX IF NOT EXISTS idx_hospitals_hospitalId ON hospitals(hospitalId);

    CREATE TABLE IF NOT EXISTS hospital_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital INTEGER NOT NULL REFERENCES hospitals(id),
      user INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pending_invitation','accepted','kicked','blocked','cancelled')),
      invitedBy INTEGER REFERENCES users(id),
      joinedAt INTEGER,
      statusChangedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      UNIQUE(hospital, user)
    );
    CREATE INDEX IF NOT EXISTS idx_hospital_members_hospital ON hospital_members(hospital);
    CREATE INDEX IF NOT EXISTS idx_hospital_members_user ON hospital_members(user);
    CREATE INDEX IF NOT EXISTS idx_hospital_members_status ON hospital_members(status);

    CREATE TABLE IF NOT EXISTS hospital_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital INTEGER NOT NULL UNIQUE REFERENCES hospitals(id),
      planType TEXT NOT NULL CHECK(planType IN ('monthly','yearly','forever')),
      expiresAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_hospital_subscriptions_hospital ON hospital_subscriptions(hospital);
    CREATE INDEX IF NOT EXISTS idx_hospital_subscriptions_expiresAt ON hospital_subscriptions(expiresAt);

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId TEXT NOT NULL UNIQUE,
      hospital INTEGER REFERENCES hospitals(id),
      patientName TEXT NOT NULL,
      patientBirthDate TEXT DEFAULT '',
      patientSex TEXT DEFAULT '',
      otherPatientIds TEXT DEFAULT '',
      dicomStudyCount INTEGER NOT NULL DEFAULT 0,
      wordFileCount INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_patients_patientId ON patients(patientId);
    CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital);

    CREATE TABLE IF NOT EXISTS dicom_studies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studyInstanceUid TEXT NOT NULL UNIQUE,
      orthancStudyId TEXT NOT NULL,
      patientId TEXT NOT NULL,
      patientName TEXT DEFAULT '',
      patientBirthDate TEXT DEFAULT '',
      patientSex TEXT DEFAULT '',
      studyDate TEXT DEFAULT '',
      studyTime TEXT DEFAULT '',
      studyDescription TEXT DEFAULT '',
      accessionNumber TEXT DEFAULT '',
      referringPhysicianName TEXT DEFAULT '',
      modalitiesInStudy TEXT DEFAULT '',
      seriesCount INTEGER NOT NULL DEFAULT 0,
      instancesCount INTEGER NOT NULL DEFAULT 0,
      hospital INTEGER REFERENCES hospitals(id),
      uploadedBy INTEGER REFERENCES users(id),
      uploadedByName TEXT DEFAULT '',
      uploadedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_dicom_studies_studyInstanceUid ON dicom_studies(studyInstanceUid);
    CREATE INDEX IF NOT EXISTS idx_dicom_studies_orthancStudyId ON dicom_studies(orthancStudyId);
    CREATE INDEX IF NOT EXISTS idx_dicom_studies_patientId ON dicom_studies(patientId);
    CREATE INDEX IF NOT EXISTS idx_dicom_studies_hospital ON dicom_studies(hospital);
    CREATE INDEX IF NOT EXISTS idx_dicom_studies_hospital_patientId ON dicom_studies(hospital, patientId);

    CREATE TABLE IF NOT EXISTS word_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      originalFileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      mimeType TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      patientId TEXT NOT NULL,
      patientName TEXT NOT NULL,
      hospital INTEGER REFERENCES hospitals(id),
      uploadedBy INTEGER NOT NULL REFERENCES users(id),
      uploadedByName TEXT NOT NULL,
      uploadStatus TEXT NOT NULL DEFAULT 'completed' CHECK(uploadStatus IN ('pending','completed','failed')),
      uploadedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE INDEX IF NOT EXISTS idx_word_files_hospital ON word_files(hospital);
    CREATE INDEX IF NOT EXISTS idx_word_files_patientId ON word_files(patientId);
    CREATE INDEX IF NOT EXISTS idx_word_files_uploadedBy ON word_files(uploadedBy);
  `);
}

module.exports = { runMigrations };
