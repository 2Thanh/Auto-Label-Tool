import React, { useState, useEffect, FormEvent } from 'react';
import { Session, StoredUser, UserRole } from '../types';
import {
  createUser,
  deleteUser,
  getStoredUsers,
  updateUserPassword,
  updateUserRole,
} from '../services/authService';

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: Session;
}

const ROLE_BADGE: Record<UserRole, string> = {
  annotator: 'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  reviewer:  'bg-amber-900/60 text-amber-300 border-amber-700',
  admin:     'bg-red-900/60 text-red-300 border-red-700',
};

const UserManagerModal: React.FC<UserManagerModalProps> = ({
  isOpen,
  onClose,
  currentSession,
}) => {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('annotator');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('annotator');
  const [newError, setNewError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const reload = () => setUsers(getStoredUsers());

  useEffect(() => {
    if (isOpen) { reload(); setEditingId(null); setNewUsername(''); setNewPassword(''); setNewError(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const startEdit = (user: StoredUser) => {
    setEditingId(user.id);
    setEditRole(user.role);
    setEditPassword('');
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (editPassword && editPassword.length < 4) {
      setEditError('Password must be at least 4 characters.');
      return;
    }
    if (editPassword) await updateUserPassword(editingId, editPassword);
    updateUserRole(editingId, editRole);
    reload();
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!window.confirm(`Delete user "${user?.username}"? This cannot be undone.`)) return;
    const result = deleteUser(id);
    if (!result.ok) { alert(result.error); return; }
    reload();
    if (editingId === id) setEditingId(null);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    if (newPassword.length < 4) { setNewError('Password must be at least 4 characters.'); return; }
    setIsCreating(true);
    setNewError('');
    const result = await createUser(newUsername.trim(), newPassword, newRole);
    setIsCreating(false);
    if (!result.ok) { setNewError(result.error); return; }
    setNewUsername('');
    setNewPassword('');
    setNewRole('annotator');
    reload();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-100">User Manager</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage accounts and role assignments</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {users.map(user => {
            const isSelf = user.id === currentSession.userId;
            const isEditing = editingId === user.id;

            return (
              <div
                key={user.id}
                className={`rounded-lg border p-3 transition-colors ${isEditing ? 'border-indigo-600 bg-gray-750' : 'border-gray-700 bg-gray-900/50'}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-200 font-semibold">{user.username}</span>
                      {isSelf && <span className="text-xs text-indigo-400">(you)</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Role</label>
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as UserRole)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="annotator">Annotator</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">New password <span className="text-gray-600">(optional)</span></label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={e => { setEditPassword(e.target.value); setEditError(''); }}
                          placeholder="leave blank to keep"
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {editError && <p className="text-xs text-red-400">{editError}</p>}

                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors font-medium">Save</button>
                      <button onClick={cancelEdit} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-200 font-semibold">{user.username}</span>
                        {isSelf && <span className="text-xs text-indigo-400">(you)</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold capitalize ${ROLE_BADGE[user.role]}`}>
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Created {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(user)}
                        className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isSelf}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isSelf ? "Can't delete your own account" : "Delete user"}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add user form */}
        <div className="border-t border-gray-700 px-5 py-4 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Add New User</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => { setNewUsername(e.target.value); setNewError(''); }}
                  placeholder="username"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setNewError(''); }}
                  placeholder="min 4 characters"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="annotator">Annotator</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isCreating || !newUsername.trim() || !newPassword}
                className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded transition-colors font-medium flex items-center gap-2"
              >
                {isCreating
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                }
                Add User
              </button>
            </div>

            {newError && <p className="text-xs text-red-400">{newError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserManagerModal;
