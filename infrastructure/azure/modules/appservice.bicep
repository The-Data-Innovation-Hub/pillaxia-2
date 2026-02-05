// App Service - Hosts PostgREST API or custom API server

@description('Azure region')
param location string

@description('App Service name')
param appServiceName string

@description('App Service Plan ID')
param appServicePlanId string

@description('Environment tag')
param environment string = 'dev'

@description('CORS allowed origins (e.g. http://localhost:8080, https://myapp.azurestaticapps.net)')
param corsAllowedOrigins array = [
  'http://localhost:8080'
  'http://localhost:5173'
  'http://127.0.0.1:8080'
  'http://127.0.0.1:5173'
]

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlanId
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      cors: {
        allowedOrigins: corsAllowedOrigins
        supportCredentials: true
      }
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'NODE_VERSION'
          value: '~20'
        }
      ]
    }
    httpsOnly: true
  }
  tags: {
    environment: environment
    project: 'pillaxia'
  }
}

output appServiceId string = appService.id
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
