# Incident Response Runbook

## Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| **SEV-1 (Critical)** | Platform down or data loss | 15 min | API returning 5xx for all users, DB connection lost |
| **SEV-2 (High)** | Major feature broken | 1 hour | Auth flow broken, medications not loading |
| **SEV-3 (Medium)** | Feature degraded | 4 hours | Slow queries, intermittent errors, notifications delayed |
| **SEV-4 (Low)** | Minor issue | 24 hours | UI glitch, non-critical feature bug |

## Immediate Response (SEV-1/SEV-2)

### 1. Assess

```bash
# Check API health
curl -s https://pillaxia-dev-api.azurewebsites.net/health/ready | jq

# Check Azure resource health
az webapp show -g $RESOURCE_GROUP -n $APP_NAME --query state

# Check recent deployments
gh run list --workflow "Azure Deploy" --limit 5
```

### 2. Mitigate

- **If caused by recent deployment**: Trigger rollback
  ```bash
  gh workflow run "Rollback Production" -f confirm=rollback
  ```
- **If DB issue**: Check Azure PostgreSQL status in Azure Portal
- **If rate limiting**: Check for DDoS patterns in logs

### 3. Communicate

- Post in team channel: severity, impact, ETA
- If user-facing: update status page

### 4. Investigate

```bash
# View API logs (last 30 min)
az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME --filter Error

# Check Sentry for errors
# Open https://sentry.io/organizations/{org}/issues/

# Check DB connections
# Via Azure Portal > PostgreSQL > Metrics > Active Connections
```

### 5. Resolve

- Fix root cause
- Deploy fix (or confirm rollback resolved it)
- Verify health endpoints
- Update incident timeline

### 6. Post-Mortem

After resolution, create a post-mortem document covering:
- Timeline of events
- Root cause analysis
- Impact assessment (users affected, duration)
- Action items to prevent recurrence

## Common Scenarios

### API 5xx Errors

1. Check `/health/ready` -- if 503, likely DB connection issue
2. Check Azure App Service metrics (CPU, memory, connections)
3. Restart App Service if needed: `az webapp restart -g $RG -n $APP_NAME`
4. Check database connection pool exhaustion

### Authentication Failures

1. Check Azure AD B2C tenant status
2. Verify `AZURE_B2C_CLIENT_ID` and tenant configuration
3. Check MSAL token refresh in frontend console
4. Verify CORS configuration allows the frontend origin

### Database Connection Issues

1. Check Azure PostgreSQL status in portal
2. Verify firewall rules allow App Service IP
3. Check connection string (`DATABASE_URL`) in App Service config
4. Monitor active connections vs. pool limits

### High Error Rate

1. Check Sentry dashboard for error patterns
2. Review recent deployment changes
3. Check rate limiting -- legitimate traffic vs. abuse
4. Scale up if needed: `az webapp scale -g $RG -n $APP_NAME --sku P1V2`

## Escalation Path

1. **On-call engineer** -- first responder
2. **Team lead** -- if SEV-1 not resolved in 30 min
3. **Platform owner** -- if SEV-1 not resolved in 1 hour
4. **Azure Support** -- if Azure infrastructure issue confirmed
