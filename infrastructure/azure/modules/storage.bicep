// Azure Storage Account for Blob Storage
// Replaces Supabase Storage for: lab results, prescription attachments, avatars

@description('Azure region')
param location string

@description('Storage account name (must be globally unique, 3-24 chars, lowercase alphanumeric)')
param storageAccountName string

@description('Environment tag')
param environment string = 'dev'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
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

// Default blob service (implicit with storage account)
resource defaultBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' existing = {
  parent: storageAccount
  name: 'default'
}

// Blob container for lab results
resource labResultsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: defaultBlobService
  name: 'lab-results'
  properties: {
    publicAccess: 'None'
  }
}

// Blob container for prescription attachments
resource prescriptionAttachmentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: defaultBlobService
  name: 'prescription-attachments'
  properties: {
    publicAccess: 'None'
  }
}

// Blob container for avatars
resource avatarsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: defaultBlobService
  name: 'avatars'
  properties: {
    publicAccess: 'None'
  }
}

var storageKeys = storageAccount.listKeys()

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageKeys.keys[0].value};EndpointSuffix=core.windows.net'
