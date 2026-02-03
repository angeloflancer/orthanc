# Deployment on rental computer (SQLite + SQLCipher)

When you install the app on a computer you rent out to someone, the database is a single encrypted SQLite file. You control access by keeping the encryption key (`DB_KEY`) and database path (`DB_PATH`) in `.env`; the tenant receives the app and a configured `.env` that does not expose your backup or key management.

## One-time setup (do this before handing over to tenant)

### 1. Set .env on the rental machine

Create or edit `backend/.env` with at least:

```env
DB_PATH=./data/orthanc.db
DB_KEY=your-secure-encryption-key
PORT=5830
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:5829
TARGET_SERVICE=http://localhost:8042
# Owner and email settings as needed (see .env.example)
```

- **`DB_PATH`** – Path to the SQLite file (e.g. `./data/orthanc.db`). The directory is created automatically if it does not exist. Use a path the app can read/write.
- **`DB_KEY`** – Passphrase for SQLCipher. **Must be set.** Wrong key makes the database unreadable. Store a backup of this key securely; without it, the DB cannot be decrypted.
- Ensure `.env` is in `.gitignore` (it already is) so credentials are not committed.

### 2. Start the app and hand over

Start your Node backend (and frontend if not using the single exe). Hand the computer over to the tenant. **Do not give them:**

- Your backup of the database file or `DB_KEY`
- Any copy of `.env` that you use for your own backups

The tenant has the app and a `.env` that points to a local DB and key. They can use the application normally; the database is encrypted at rest.

## Backup and key management

- **Back up** the file at `DB_PATH` and store **`DB_KEY`** securely. Restore by placing the file and using the same `DB_KEY` in `.env`.
- Do not embed `DB_KEY` in source code or ship it in the frontend. Keep it only in `.env` (or in the embedded config when using the single exe build).

## Summary

| Item     | Purpose                          |
|----------|-----------------------------------|
| `DB_PATH`| Path to the SQLite database file  |
| `DB_KEY` | Encryption passphrase (SQLCipher)|

The app creates the database and tables on first run if the file does not exist. Schema is applied automatically.
