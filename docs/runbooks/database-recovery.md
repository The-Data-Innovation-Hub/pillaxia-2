# Database Recovery Runbook

## Backup Strategy

### Azure PostgreSQL Automated Backups

Azure Database for PostgreSQL Flexible Server provides:
- **Automatic backups** every 24 hours (full) with continuous WAL archiving
- **Retention period**: 7-35 days (configurable)
- **Geo-redundant backup storage** (if enabled)

### Verifying Backup Status

```bash
# List available restore points
az postgres flexible-server backup list \
  -g $RESOURCE_GROUP \
  -n $PG_SERVER_NAME \
  --output table
```

## Point-in-Time Restore

Restore the database to any point within the retention window:

```bash
# Restore to a specific timestamp
az postgres flexible-server restore \
  -g $RESOURCE_GROUP \
  --name $PG_SERVER_NAME-restored \
  --source-server $PG_SERVER_NAME \
  --restore-time "2026-02-05T10:00:00Z"
```

After restore:
1. Verify data integrity on the restored server
2. Update `DATABASE_URL` in App Service to point to restored server
3. Restart API: `az webapp restart -g $RG -n $APP_NAME`
4. Run health check to confirm connectivity
5. Rename servers if needed (swap old and restored)

## Migration Rollback

### Schema Migration Tracking

Migrations are tracked in the `schema_migrations` table:

```sql
-- View applied migrations
SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 20;

-- Check if a specific migration was applied
SELECT * FROM schema_migrations WHERE filename = '20260205_add_missing_indexes.sql';
```

### Rolling Back a Migration

Most migrations use `IF NOT EXISTS` or `IF EXISTS` patterns and are idempotent. To undo a migration:

1. **Write a reverse migration** (e.g., `20260206_revert_xyz.sql`)
2. **Apply it manually**:
   ```bash
   psql "$CONN" -f path/to/revert_migration.sql
   ```
3. **Remove from tracking**:
   ```sql
   DELETE FROM schema_migrations WHERE filename = 'problematic_migration.sql';
   ```

### Emergency: Skip a Broken Migration

If CI is stuck on a migration:

```sql
-- Mark as applied without actually running it
INSERT INTO schema_migrations (filename) VALUES ('broken_migration.sql');
```

Then fix the migration and deploy the corrected version.

## Data Recovery Scenarios

### Accidental Row Deletion

1. **Check audit logs** for the delete operation:
   ```sql
   SELECT * FROM audit_logs WHERE table_name = 'affected_table' AND action = 'DELETE'
   ORDER BY created_at DESC LIMIT 10;
   ```
2. **Restore from backup** using point-in-time restore
3. **Export affected rows** from restored server:
   ```bash
   pg_dump -h restored-server -t affected_table --data-only > recovery.sql
   ```
4. **Import into production**:
   ```bash
   psql -h production-server -f recovery.sql
   ```

### Table/Schema Corruption

1. Perform a point-in-time restore
2. Compare schemas between production and restored
3. Use `pg_dump --schema-only` to diff table structures
4. Apply corrections via migration

### Full Database Recovery

1. Stop the API: `az webapp stop -g $RG -n $APP_NAME`
2. Perform point-in-time restore
3. Update connection strings
4. Start the API
5. Run health checks
6. Verify data integrity via spot checks

## Monitoring

- **Azure Portal**: PostgreSQL > Metrics (connections, storage, CPU)
- **Health endpoint**: `GET /health/ready` includes DB latency
- **Connection pool**: Monitor `pool.total`, `pool.idle`, `pool.waiting` from health endpoint
- **Sentry**: DB-related errors surface as API errors

## Contacts

- Azure PostgreSQL documentation: https://learn.microsoft.com/azure/postgresql/
- Azure Support: For infrastructure issues, open a support ticket in Azure Portal
