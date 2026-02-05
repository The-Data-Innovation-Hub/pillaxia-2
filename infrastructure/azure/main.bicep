// Pillaxia Azure Infrastructure - Main Bicep Template
// Deploys: PostgreSQL Flexible Server, App Service, Functions, Blob Storage, Key Vault

targetScope = 'subscription'

@description('Name of the resource group to create')
param resourceGroupName string = 'pillaxia-rg'

@description('Azure region for deployment (northeurope = Ireland/Dublin)')
param location string = 'northeurope'

@description('Environment tag (dev, staging, prod)')
param environment string = 'dev'

@description('PostgreSQL administrator login')
@secure()
param postgresAdminLogin string

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

// Create resource group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    environment: environment
    project: 'pillaxia'
  }
}

// Deploy all resources to the resource group
module resources 'main.rg.bicep' = {
  scope: rg
  name: 'pillaxia-resources'
  params: {
    location: location
    environment: environment
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
  }
}

output resourceGroupName string = rg.name
output resourceGroupId string = rg.id
