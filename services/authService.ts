import { AppRole, Session, StoredUser, UserRole } from '../types';

const USERS_KEY = 'neurolabel_users';
const SESSION_KEY = 'neurolabel_session';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

// ─── Password Hashing ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── User Storage ──────────────────────────────────────────────────────────

export function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ─── Seed Default Admin ────────────────────────────────────────────────────

export async function seedAdminIfNeeded(): Promise<void> {
  const users = getStoredUsers();
  if (users.length === 0) {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    const admin: StoredUser = {
      id: crypto.randomUUID(),
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    saveStoredUsers([admin]);
  }
}

// ─── Check if Default Password Still Set ──────────────────────────────────

export async function isDefaultAdminPasswordActive(): Promise<boolean> {
  const users = getStoredUsers();
  const admin = users.find(u => u.username === DEFAULT_ADMIN_USERNAME && u.role === 'admin');
  if (!admin) return false;
  const defaultHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  return admin.passwordHash === defaultHash;
}

// ─── Authentication ────────────────────────────────────────────────────────

export async function authenticate(
  username: string,
  password: string
): Promise<Session | null> {
  const users = getStoredUsers();
  const hash = await hashPassword(password);
  const user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash
  );
  if (!user) return null;
  return { userId: user.id, username: user.username, role: user.role };
}

// ─── Session Storage ───────────────────────────────────────────────────────

export function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── User Management ───────────────────────────────────────────────────────

export async function createUser(
  username: string,
  password: string,
  role: UserRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const users = getStoredUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: `Username "${username}" is already taken.` };
  }
  const passwordHash = await hashPassword(password);
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };
  saveStoredUsers([...users, newUser]);
  return { ok: true };
}

export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
  const users = getStoredUsers();
  const passwordHash = await hashPassword(newPassword);
  saveStoredUsers(users.map(u => u.id === id ? { ...u, passwordHash } : u));
}

export function updateUserRole(id: string, role: UserRole): void {
  const users = getStoredUsers();
  saveStoredUsers(users.map(u => u.id === id ? { ...u, role } : u));
}

export function deleteUser(id: string): { ok: true } | { ok: false; error: string } {
  const users = getStoredUsers();
  const admins = users.filter(u => u.role === 'admin');
  const target = users.find(u => u.id === id);
  if (target?.role === 'admin' && admins.length <= 1) {
    return { ok: false, error: 'Cannot delete the last admin account.' };
  }
  saveStoredUsers(users.filter(u => u.id !== id));
  return { ok: true };
}

// ─── Role Mapping ──────────────────────────────────────────────────────────

export function toAppRole(userRole: UserRole): AppRole {
  return userRole === 'annotator' ? 'annotator' : 'reviewer';
}
