// Azure Database for PostgreSQL - Flexible Server
// Pillaxia database with required extensions

@description('Azure region')
param location string

@description('PostgreSQL server name')
param serverName string

@description('Administrator login')
@secure()
param administratorLogin string

@description('Administrator password')
@secure()
param administratorLoginPassword string

@description('Environment tag')
param environment string = 'dev'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: 'Standard_D2ds_v4'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '15'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 128
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
  tags: {
    environment: environment
    project: 'pillaxia'
  }
}

// Firewall rule - Allow Azure services and client IPs
// Restrict to specific IPs in production
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgres
  name: 'AllowAll'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Database for application
resource pillaxiaDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgres
  name: 'pillaxia'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output serverId string = postgres.id
output serverFqdn string = postgres.properties.fullyQualifiedDomainName
output databaseName string = pillaxiaDb.name
