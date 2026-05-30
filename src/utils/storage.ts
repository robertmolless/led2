import type { ProjectConfig, SavedProject } from "../types";

const STORAGE_KEY = "led-scheme-builder.projects.v1";
const CURRENT_KEY = "led-scheme-builder.current.v1";

function readAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function listProjects(): SavedProject[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProject(config: ProjectConfig, existingId?: string): SavedProject {
  const list = readAll();
  const now = Date.now();
  if (existingId) {
    const idx = list.findIndex((p) => p.id === existingId);
    if (idx >= 0) {
      const updated: SavedProject = {
        ...list[idx],
        config,
        updatedAt: now
      };
      list[idx] = updated;
      writeAll(list);
      return updated;
    }
  }
  const id = `proj_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const project: SavedProject = {
    id,
    createdAt: now,
    updatedAt: now,
    config
  };
  list.push(project);
  writeAll(list);
  return project;
}

export function deleteProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function duplicateProject(id: string): SavedProject | null {
  const list = readAll();
  const src = list.find((p) => p.id === id);
  if (!src) return null;
  return saveProject({
    ...src.config,
    projectName: `${src.config.projectName} (копия)`
  });
}

export function getCurrentId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentId(id: string | null) {
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else localStorage.removeItem(CURRENT_KEY);
}

export function getProjectById(id: string): SavedProject | null {
  return readAll().find((p) => p.id === id) ?? null;
}
