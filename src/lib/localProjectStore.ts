import type { Project } from '../types'

const KEY = 'planos:projects'

function readAll(): Record<string, Project> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, Project>) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function localListProjects(): Project[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function localLoadProject(id: string): Project | null {
  return readAll()[id] ?? null
}

export function localSaveProject(project: Project): void {
  const all = readAll()
  all[project.id] = project
  writeAll(all)
}

export function localDeleteProject(id: string): void {
  const all = readAll()
  delete all[id]
  writeAll(all)
}
