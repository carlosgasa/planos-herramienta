import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase'
import { localDeleteProject, localListProjects, localLoadProject, localSaveProject } from './localProjectStore'
import { makeBlankProject } from '../data/seedProject'
import type { Project } from '../types'

const PROJECTS_COLLECTION = 'projects'

export async function listProjects(): Promise<Project[]> {
  if (firebaseEnabled && db) {
    const q = query(collection(db, PROJECTS_COLLECTION), orderBy('updatedAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => d.data() as Project)
  }
  return localListProjects()
}

export async function loadProject(projectId: string): Promise<Project | null> {
  if (firebaseEnabled && db) {
    const snap = await getDoc(doc(db, PROJECTS_COLLECTION, projectId))
    return snap.exists() ? (snap.data() as Project) : null
  }
  return localLoadProject(projectId)
}

export async function saveProject(project: Project): Promise<void> {
  const withTimestamp: Project = { ...project, updatedAt: Date.now() }
  if (firebaseEnabled && db) {
    await setDoc(doc(db, PROJECTS_COLLECTION, project.id), withTimestamp)
    return
  }
  localSaveProject(withTimestamp)
}

export async function deleteProject(projectId: string): Promise<void> {
  if (firebaseEnabled && db) {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId))
    return
  }
  localDeleteProject(projectId)
}

export async function createProject(name: string): Promise<Project> {
  const project = makeBlankProject(name)
  await saveProject(project)
  return project
}
