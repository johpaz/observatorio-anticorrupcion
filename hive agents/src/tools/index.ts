/**
 * Tools registry for the active tool groups.
 *
 * Import this to get all tools:
 * import { createAllTools } from "./tools";
 */

import type { Tool } from "./types.ts";
import type { Config } from "../config/loader.ts";

// Filesystem (7)
import * as filesystem from "./filesystem/index.ts";

// Web (9)
import * as web from "./web/index.ts";

// Projects (8)
import * as projects from "./projects/index.ts";

// Cron (7) - Croner-based scheduler tools
import * as cron from "./cron/index.ts";

// Agents (14)
import * as agents from "./agents/index.ts";

// Core (4)
import * as core from "./core/index.ts";

// Office (8)
import * as office from "./office/index.ts";

// Meeting (4)
import * as meeting from "./meeting/index.ts";

// SECOP / Transparencia (6)
import { secopTools } from "./secop/index.ts";

/**
 * Creates all registered tools with proper configuration
 */
export function createAllTools(config: Config): Tool[] {
  return [
    // FILESYSTEM (7)
    ...filesystem.createTools(),

    // WEB (9)
    ...web.createTools(),

    // PROJECTS (8)
    ...projects.createTools(),

    // CRON (7)
    ...cron.createTools(),

    // AGENTS (14)
    ...agents.createTools(),

    // CORE (4)
    ...core.createTools(),

    // OFFICE (8)
    ...office.createTools(),

    // MEETING (4)
    ...meeting.createTools(),

    // SECOP / Transparencia (6)
    ...secopTools,
  ];
}

/**
 * Creates tools by category (for selective loading)
 */
export function createToolsByCategory(category: string, _config: Config): Tool[] {
  switch (category) {
    case "filesystem":
      return filesystem.createTools();
    case "web":
      return web.createTools();
    case "projects":
      return projects.createTools();
    case "cron":
      return cron.createTools();
    case "agents":
      return agents.createTools();
    case "core":
      return core.createTools();
    case "office":
      return office.createTools();
    case "meeting":
      return meeting.createTools();
    default:
      return [];
  }
}

// Export types
export * from "./types.ts";

// Export tools by category (avoiding createTools name collisions)
// Use category-specific imports or createAllTools/createToolsByCategory
export {
  fsEditTool,
  fsReadTool,
  fsWriteTool,
  fsDeleteTool,
  fsListTool,
  fsGlobTool,
  fsExistsTool,
} from "./filesystem/index.ts";

export {
  webSearchTool,
  webFetchTool,
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserTypeTool,
  browserExtractTool,
  browserScriptTool,
  browserWaitTool,
} from "./web/index.ts";

export {
  projectCreateTool,
  projectListTool,
  projectUpdateTool,
  projectDoneTool,
  projectFailTool,
  taskCreateTool,
  taskUpdateTool,
  taskEvaluateTool,
} from "./projects/index.ts";

export {
  cronCreateTool,
  cronListTool,
  cronUpdateTool,
  cronPauseTool,
  cronResumeTool,
  cronDeleteTool,
  cronTriggerTool,
  cronHistoryTool,
  setSchedulerInstance,
  resolveBestChannel,
} from "./cron/index.ts";

export {
  memoryWriteTool,
  memoryReadTool,
  memoryListTool,
  memorySearchTool,
  memoryDeleteTool,
  agentCreateTool,
  agentFindTool,
  agentArchiveTool,
  taskDelegateTool,
  taskDelegateCodeTool,
  taskStatusTool,
  busPublishTool,
  busReadTool,
  projectUpdatesTool,
} from "./agents/index.ts";

export {
  searchKnowledgeTool,
  notifyTool,
  saveNoteTool,
  reportProgressTool,
} from "./core/index.ts";

export {
  officeLeerPdfTool,
  officeEscribirPdfTool,
  officeLeerDocxTool,
  officeEscribirDocxTool,
  officeLeerXlsxTool,
  officeEscribirXlsxTool,
  officeLeerPptxTool,
  officeEscribirPptxTool,
} from "./office/index.ts";
