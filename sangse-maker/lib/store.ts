import type { Page, Plan, ProductInput } from "./schema";

/** 브라우저 IndexedDB 에 프로젝트를 저장 (사진 data URL 이 커서 localStorage 대신 사용) */
export interface Project {
  id: string;
  updatedAt: number;
  input: ProductInput;
  images: string[];
  plan: Plan | null;
  page: Page | null;
}

const DB = "sangse-maker";
const STORE = "projects";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveProject = (p: Project) => tx("readwrite", (s) => s.put({ ...p, updatedAt: Date.now() })).catch(() => undefined);
export const loadProject = (id: string) => tx<Project | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
export const deleteProject = (id: string) => tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
export const listProjects = () =>
  tx<Project[]>("readonly", (s) => s.getAll())
    .then((all) => all.sort((a, b) => b.updatedAt - a.updatedAt))
    .catch(() => [] as Project[]);

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
