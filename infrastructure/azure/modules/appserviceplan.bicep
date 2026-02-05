// App Service Plan - Hosts App Service (API) and Azure Functions

@description('Azure region')
param location string

@description('App Service Plan name')
param appServicePlanName string

@description('Environment tag')
param environment string = 'dev'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
  tags: {
    environment: environment
    project: 'pillaxia'
  }
}

output appServicePlanId string = appServicePlan.id
