// Pillaxia Azure Resources - Resource Group Level
// Modules: PostgreSQL, Key Vault, Storage, App Service, Functions

targetScope = 'resourceGroup'

@description('Azure region')
param location string

@description('Environment tag')
param environment string = 'dev'

@description('PostgreSQL administrator login')
@secure()
param postgresAdminLogin string

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

// Base naming
var baseName = 'pillaxia-${environment}'

// PostgreSQL Flexible Server
module postgres 'modules/postgres.bicep' = {
  name: 'postgres-deployment'
  params: {
    location: location
    serverName: '${baseName}-pg'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    environment: environment
  }
}

// Key Vault
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    location: location
    keyVaultName: '${replace(baseName, '-', '')}kv'
    environment: environment
  }
}

// Storage Account (Blob)
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    location: location
    storageAccountName: '${replace(baseName, '-', '')}st'
    environment: environment
  }
}

// App Service Plan
module appServicePlan 'modules/appserviceplan.bicep' = {
  name: 'appserviceplan-deployment'
  params: {
    location: location
    appServicePlanName: '${baseName}-asp'
    environment: environment
  }
}

// App Service (API/PostgREST)
module appService 'modules/appservice.bicep' = {
  name: 'appservice-deployment'
  params: {
    location: location
    appServiceName: '${baseName}-api'
    appServicePlanId: appServicePlan.outputs.appServicePlanId
    environment: environment
  }
}

// Azure Functions
module functions 'modules/functions.bicep' = {
  name: 'functions-deployment'
  params: {
    location: location
    functionAppName: '${baseName}-func'
    appServicePlanId: appServicePlan.outputs.appServicePlanId
    storageConnectionString: storage.outputs.connectionString
    environment: environment
  }
}

output postgresServerFqdn string = postgres.outputs.serverFqdn
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output storageAccountName string = storage.outputs.storageAccountName
output storageConnectionString string = storage.outputs.connectionString
output appServiceUrl string = appService.outputs.appServiceUrl
output functionAppUrl string = functions.outputs.functionAppUrl
