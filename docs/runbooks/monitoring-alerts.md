# Monitoring and Alerts Runbook

## What to Monitor

### API Health

| Metric | Endpoint/Source | Threshold | Action |
|--------|----------------|-----------|--------|
| API availability | `GET /health/ready` | < 99.9% | SEV-1 if down > 5 min |
| Response time (p95) | Azure App Service metrics | > 2s | SEV-3, investigate slow queries |
| Error rate (5xx) | Azure App Service metrics | > 1% | SEV-2, check logs |
| DB latency | `/health/ready` `.db.latencyMs` | > 500ms | SEV-3, check DB load |
| DB connections | `/health/ready` `.pool.waiting` | > 5 | SEV-3, possible pool exhaustion |

### Database

| Metric | Source | Threshold | Action |
|--------|--------|-----------|--------|
| CPU usage | Azure PostgreSQL metrics | > 80% sustained | Scale up or optimize queries |
| Storage usage | Azure PostgreSQL metrics | > 80% | Increase storage or archive data |
| Active connections | Azure PostgreSQL metrics | > 80% of max | Check for connection leaks |
| Failed connections | Azure PostgreSQL metrics | > 10/min | Check firewall, credentials |
| Replication lag | Azure PostgreSQL metrics | > 30s | Check replica health |

### Frontend

| Metric | Source | Threshold | Action |
|--------|--------|-----------|--------|
| JS errors | Sentry | > 50/hour | SEV-3, investigate error patterns |
| Core Web Vitals (LCP) | Sentry Performance | > 2.5s | Optimize loading performance |
| Auth failures | Sentry | > 10/hour | Check Azure AD B2C status |
| API call failures | Sentry breadcrumbs | > 5% error rate | Check API health |

### Azure Functions

| Metric | Source | Threshold | Action |
|--------|--------|-----------|--------|
| Execution failures | Azure Functions metrics | > 5% | Check function logs |
| Duration | Azure Functions metrics | > 5 min for timers | Optimize or increase timeout |
| Invocation count | Azure Functions metrics | Drop to 0 for timers | Check schedule, function health |

## Setting Up Alerts

### Azure Monitor Alerts

```bash
# Create alert for API 5xx errors
az monitor metrics alert create \
  -n "Pillaxia API 5xx Alert" \
  -g $RESOURCE_GROUP \
  --scopes "/subscriptions/.../Microsoft.Web/sites/$APP_NAME" \
  --condition "total Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group $ACTION_GROUP_ID

# Create alert for DB CPU
az monitor metrics alert create \
  -n "Pillaxia DB CPU Alert" \
  -g $RESOURCE_GROUP \
  --scopes "/subscriptions/.../Microsoft.DBforPostgreSQL/flexibleServers/$PG_SERVER" \
  --condition "avg cpu_percent > 80" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --action-group $ACTION_GROUP_ID
```

### Sentry Alerts

Configure in Sentry dashboard:
1. **New issue alert**: Notify on first occurrence of new error types
2. **Error spike alert**: Notify when error count exceeds 2x baseline
3. **Performance alert**: Notify when p95 response time > 3s

## Health Check Endpoints

```bash
# Quick status check
curl -s https://pillaxia-dev-api.azurewebsites.net/health/ready | jq

# Expected healthy response:
# {
#   "status": "ok",
#   "timestamp": "2026-02-05T12:00:00.000Z",
#   "db": { "status": "connected", "latencyMs": 12 },
#   "pool": { "total": 10, "idle": 8, "waiting": 0 }
# }

# Liveness (for container orchestrators)
curl -s https://pillaxia-dev-api.azurewebsites.net/health/live | jq
# { "status": "ok" }
```

## Response Procedures

### High Error Rate Alert

1. Check Sentry for error patterns
2. Check recent deployments
3. If caused by deployment: rollback
4. If DB-related: check PostgreSQL metrics
5. If auth-related: check Azure AD B2C

### DB CPU/Memory Alert

1. Check Azure PostgreSQL metrics for query load
2. Identify slow queries: use Azure PostgreSQL Query Performance Insights
3. Short-term: kill long-running queries
4. Long-term: add indexes, optimize queries, or scale up

### Pool Exhaustion Alert

1. Check `pool.waiting` in health endpoint
2. Look for connection leaks (transactions not committed/rolled back)
3. Increase `PG_POOL_MAX` if legitimate load increase
4. Check for long-running queries holding connections

## Dashboard URLs

- **Azure Portal**: https://portal.azure.com/#resource/.../overview
- **Sentry**: https://sentry.io/organizations/{org}/issues/
- **GitHub Actions**: https://github.com/{org}/{repo}/actions
- **API Docs**: https://pillaxia-dev-api.azurewebsites.net/docs
