export class SkillLoader {
  private workspacePath: string

  constructor(options: { workspacePath: string }) {
    this.workspacePath = options.workspacePath
  }

  loadBundledSkills(): any[] {
    return []
  }
}
