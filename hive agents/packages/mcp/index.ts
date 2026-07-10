export interface MCPClientManager {
  initialize(): Promise<void>
  updateConfig(config: any): Promise<void>
  getServerTools(serverName: string): any[] | null
  config?: any
}

export function createMCPManager(config: any): MCPClientManager {
  let _config = { ...config }

  const manager: MCPClientManager = {
    get config() { return _config },
    async initialize() {},
    async updateConfig(newConfig: any) {
      _config = { ...newConfig }
    },
    getServerTools(_serverName: string): any[] {
      return []
    },
  }

  return manager
}
