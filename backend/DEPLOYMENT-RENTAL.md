# Deployment on rental computer (MongoDB protection)

When you install the app on a computer you rent out to someone, protect the database by enabling MongoDB authentication and using an **app-only user**. The tenant receives only the app and a connection string for that user; they never get the MongoDB admin account, so they cannot create/drop users, drop the database, or change MongoDB configuration.

## One-time setup (do this before handing over to tenant)

### 1. Install MongoDB

Install MongoDB on the rental computer using the [official installer](https://www.mongodb.com/try/download/community) or your package manager (e.g. `brew install mongodb-community` on macOS, or Windows/MSI installer).

### 2. Start MongoDB without auth

Start MongoDB with default settings (no authentication yet):

- **Windows:** Start the MongoDB service, or run `mongod` from the installation bin folder.
- **macOS (Homebrew):** `brew services start mongodb-community`
- **Linux:** `sudo systemctl start mongod` or run `mongod`

### 3. Create users (mongosh or mongo)

Connect with `mongosh` (or legacy `mongo`) and run the following. Replace `<your-strong-admin-password>` and `<strong-app-password>` with strong passwords. **Store the admin credentials securely; never give them to the tenant.**

```javascript
// 1) Create admin user (for you only - store credentials securely, never give to tenant)
use admin
db.createUser({
  user: "admin",
  pwd: "<your-strong-admin-password>",
  roles: [ "userAdminAnyDatabase", "readWriteAnyDatabase", "dbAdminAnyDatabase" ]
})

// 2) Create app-only user (this is what goes in MONGODB_URI)
use orthanc
db.createUser({
  user: "orthancapp",
  pwd: "<strong-app-password>",
  roles: [ { role: "readWrite", db: "orthanc" } ]
})
```

### 4. Restart MongoDB with auth enabled

Stop MongoDB, then start it with authentication:

- **Windows:** Add `--auth` when starting `mongod`, or set `security.authorization: enabled` in `mongod.cfg` and restart the service.
- **macOS/Linux:** Run `mongod --auth`, or add to config file:
  ```yaml
  security:
    authorization: enabled
  ```
  Then restart MongoDB (e.g. `brew services restart mongodb-community` or `sudo systemctl restart mongod`).

### 5. Set .env on the rental machine

Create or edit `backend/.env` so that **only** the app user is used. Use the same app password you set in step 3:

```env
MONGODB_URI=mongodb://orthancapp:<strong-app-password>@localhost:27017/orthanc?authSource=orthanc
```

- `authSource=orthanc` is required because the app user is defined in the `orthanc` database.
- Ensure `.env` is in `.gitignore` (it already is) so credentials are not committed.

### 6. (Optional) Run migrations

If you have existing data or need to run the hospital migration script:

```bash
cd backend
node scripts/migrateDataToHospital.js
```

This uses `MONGODB_URI` from `.env` (the app user); the app user has sufficient rights for the migration.

### 7. Start the app and hand over

Start your Node backend and frontend as usual. Hand the computer over to the tenant. **Do not give them:**

- The MongoDB admin username or password
- Any connection string that uses the admin user

The tenant only has the app and the `.env` with the app-user connection string. They can use the application normally but cannot log in to MongoDB as admin or change schema/users.

## Summary

| User        | Purpose                          | Who has it   |
|------------|-----------------------------------|--------------|
| `admin`    | Full MongoDB management           | You only     |
| `orthancapp` | App connection (readWrite on orthanc) | In .env on rental PC |

The app user has only `readWrite` on the `orthanc` database, so even if the tenant opens MongoDB shell with the app credentials, they cannot create users, drop the database, or alter other databases.
