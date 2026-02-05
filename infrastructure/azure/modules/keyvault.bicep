// Azure Key Vault for secrets
// Stores: DB connection strings, Stripe keys, Resend API key, Twilio credentials

@description('Azure region')
param location string

@description('Key Vault name (must be globally unique, 3-24 chars, alphanumeric)')
param keyVaultName string

@description('Environment tag')
param environment string = 'dev'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  tags: {
    environment: environment
    project: 'pillaxia'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
