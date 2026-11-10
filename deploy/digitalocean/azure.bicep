targetScope = 'resourceGroup'

param location string = resourceGroup().location
param name string
@secure()
@minLength(32)
param postgresPassword string
param egressIps array

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: name
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '18'
    administratorLogin: 'kaneo'
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 64, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'kaneo'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource firewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for (ip, index) in egressIps: {
  parent: postgres
  name: 'app-platform-${index}'
  properties: { startIpAddress: ip, endIpAddress: ip }
}]

resource extensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'azure.extensions'
  properties: { value: 'VECTOR,PGCRYPTO,PG_TRGM', source: 'user-override' }
}

resource redis 'Microsoft.Cache/redisEnterprise@2025-07-01' = {
  name: name
  location: location
  sku: { name: 'Balanced_B0' }
  properties: {
    highAvailability: 'Disabled'
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2025-07-01' = {
  parent: redis
  name: 'default'
  properties: {
    accessKeysAuthentication: 'Enabled'
    clientProtocol: 'Encrypted'
    clusteringPolicy: 'EnterpriseCluster'
    evictionPolicy: 'NoEviction'
    port: 10000
  }
}

resource postgresLock 'Microsoft.Authorization/locks@2020-05-01' = {
  scope: postgres
  name: 'protect-data'
  properties: { level: 'CanNotDelete', notes: 'Remove explicitly before deleting Kaneo data.' }
}

output postgresHost string = postgres.properties.fullyQualifiedDomainName
output redisHost string = redis.properties.hostName
output redisDatabaseId string = redisDatabase.id
