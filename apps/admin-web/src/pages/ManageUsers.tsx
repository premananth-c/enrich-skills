import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type PermissionLevel = 'none' | 'view' | 'edit';
type ModuleKey = 'courses' | 'batches' | 'tests' | 'questions' | 'students' | 'reports' | 'manage_users';

interface RoleDefinition {
  id: string;
  roleKey: string;
  displayName: string;
  permissions: Record<ModuleKey, PermissionLevel>;
  isActive: boolean;
}

interface UserRow {
  id: string;
  name: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const moduleLabels: Record<ModuleKey, string> = {
  courses: 'Courses',
  batches: 'Batches',
  tests: 'Tests',
  questions: 'Questions',
  students: 'Students',
  reports: 'Reports',
  manage_users: 'Manage Users',
};

const configurableModuleKeys: ModuleKey[] = ['courses', 'batches', 'tests', 'questions', 'students', 'reports'];

const defaultPermissions: Record<ModuleKey, PermissionLevel> = {
  courses: 'none',
  batches: 'none',
  tests: 'none',
  questions: 'none',
  students: 'none',
  reports: 'none',
  manage_users: 'none',
};

export default function ManageUsers() {
  const { isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleName, setRoleName] = useState('');
  const [permissions, setPermissions] = useState<Record<ModuleKey, PermissionLevel>>(defaultPermissions);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRole, setAdminRole] = useState('admin');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [roleRows, userRows] = await Promise.all([
        api<RoleDefinition[]>('/users/roles'),
        api<UserRow[]>('/users'),
      ]);
      setRoles(roleRows);
      setUsers(userRows.filter((u) => u.role !== 'student'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  const roleOptions = useMemo(
    () => [
      { key: 'admin', label: 'Admin (full module access)' },
      { key: 'super_admin', label: 'Super Admin (all access)' },
      { key: 'invited', label: 'Invited (no access)' },
      ...roles.map((r) => ({ key: r.roleKey, label: r.displayName })),
    ],
    [roles]
  );

  const rolePanelOptions = useMemo(
    () => [{ value: '', label: 'Create new role' }, ...roles.map((r) => ({ value: r.id, label: r.displayName }))],
    [roles]
  );

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);

  useEffect(() => {
    if (selectedRoleId === '') {
      setRoleName('');
      setPermissions(defaultPermissions);
    } else {
      const r = roles.find((x) => x.id === selectedRoleId);
      if (r) {
        setRoleName(r.displayName);
        setPermissions({ ...defaultPermissions, ...r.permissions } as Record<ModuleKey, PermissionLevel>);
      }
    }
  }, [selectedRoleId, roles]);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleSaveLoading(true);
    try {
      if (selectedRoleId === '') {
        await api('/users/roles', {
          method: 'POST',
          body: JSON.stringify({
            displayName: roleName,
            permissions,
          }),
        });
        setRoleName('');
        setPermissions(defaultPermissions);
        setSelectedRoleId('');
      } else {
        await api(`/users/roles/${selectedRoleId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            displayName: roleName,
            permissions,
          }),
        });
      }
      await load();
    } finally {
      setRoleSaveLoading(false);
    }
  };

  const handleCancelRole = () => {
    setSelectedRoleId('');
    setRoleName('');
    setPermissions(defaultPermissions);
  };

  const handleDeleteRole = async () => {
    if (!selectedRoleId) return;
    const role = roles.find((x) => x.id === selectedRoleId);
    if (!role) return;
    if (!confirm(`Delete role "${role.displayName}"? Users with this role will be moved to "Invited" (no access). This cannot be undone.`)) return;
    setRoleSaveLoading(true);
    try {
      await api(`/users/roles/${selectedRoleId}`, { method: 'DELETE' });
      setSelectedRoleId('');
      setRoleName('');
      setPermissions(defaultPermissions);
      await load();
    } finally {
      setRoleSaveLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try {
      await api(`/users/admins/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await load();
    } catch {
      // toast is already emitted by the api() wrapper
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/users/admins', {
      method: 'POST',
      body: JSON.stringify({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        roleKey: adminRole,
      }),
    });
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminRole('admin');
    await load();
  };

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api('/users/admins/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail('');
      await load();
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, roleKey: string) => {
    await api(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roleKey }),
    });
    await load();
  };

  const handleDeleteAdmin = async (user: UserRow) => {
    if (!confirm(`Permanently delete admin user "${user.name}"? This action cannot be undone.`)) return;
    try {
      await api(`/users/admins/${user.id}`, { method: 'DELETE' });
      await load();
    } catch {
      // toast is already emitted by the api() wrapper
    }
  };

  const handleEmailChange = async (userId: string) => {
    setEditError('');
    try {
      await api(`/users/${userId}/email`, {
        method: 'PATCH',
        body: JSON.stringify({ email: editEmail }),
      });
      setEditEmail('');
      setEditUserId(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handlePasswordReset = async (userId: string) => {
    setEditError('');
    try {
      await api(`/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: editPassword }),
      });
      setEditPassword('');
      setEditUserId(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>
        You dont have permission to view this page.
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Manage Users</h1>

      <form onSubmit={handleInviteAdmin} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Invite Admin by Email</h3>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>A temporary password will be emailed. They won't have module access until assigned a role.</p>
        </div>
        <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="admin@example.com" required style={{ padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: '0.95rem', flex: 1, minWidth: 220 }} />
        <button type="submit" disabled={inviting} style={{ padding: '0.55rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap', opacity: inviting ? 0.65 : 1, cursor: 'pointer' }}>
          {inviting ? 'Sending...' : 'Send Invite'}
        </button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <form onSubmit={handleCreateAdmin} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Create Admin User</h3>
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Name" required style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Email" required style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password (min 8)" required minLength={8} style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          <select value={adminRole} onChange={(e) => setAdminRole(e.target.value)} style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
            {roleOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <button type="submit" style={{ padding: '0.55rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>
            Create Admin
          </button>
        </form>

        <form onSubmit={handleSaveRole} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Create or Edit Custom Role</h3>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Role</label>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            style={{ width: '100%', marginBottom: '0.8rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
          >
            {rolePanelOptions.map((opt) => (
              <option key={opt.value || 'new'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Display name</label>
          <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Test Reviewer" required style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          {selectedRoleId && (() => {
            const r = roles.find((x) => x.id === selectedRoleId);
            return r ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Role key: <code style={{ background: 'var(--color-bg)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{r.roleKey}</code>
              </p>
            ) : null;
          })()}
          <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '1rem' }}>
            {configurableModuleKeys.map((moduleKey) => (
              <div key={moduleKey} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <span>{moduleLabels[moduleKey]}</span>
                <select
                  value={permissions[moduleKey]}
                  onChange={(e) =>
                    setPermissions((prev) => ({
                      ...prev,
                      [moduleKey]: e.target.value as PermissionLevel,
                    }))
                  }
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                >
                  <option value="none">None</option>
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {selectedRoleId && (
                <button type="button" onClick={handleDeleteRole} disabled={roleSaveLoading} style={{ padding: '0.55rem 1rem', borderRadius: 6, border: '1px solid #ef444444', background: '#ef444422', color: '#f87171', fontWeight: 600, cursor: 'pointer', opacity: roleSaveLoading ? 0.65 : 1 }}>
                  Delete Role
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleCancelRole} style={{ padding: '0.55rem 1rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={roleSaveLoading} style={{ padding: '0.55rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: roleSaveLoading ? 0.65 : 1 }}>
                {roleSaveLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem' }}>Role</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>Created</th>
              <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>{u.name}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{u.email ?? '--'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <select value={u.role} onChange={(e) => void handleRoleChange(u.id, e.target.value)} style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    {roleOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                    <option value="student">Student</option>
                  </select>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {u.role === 'super_admin' ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>{u.isActive ? 'Active' : 'Disabled'}</span>
                  ) : (
                    <select
                      value={u.isActive ? 'active' : 'disabled'}
                      onChange={(e) => void handleStatusChange(u.id, e.target.value === 'active')}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setEditUserId(editUserId === u.id ? null : u.id); setEditEmail(u.email ?? ''); setEditPassword(''); setEditError(''); }}
                      style={{ padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      {editUserId === u.id ? 'Close' : 'Edit'}
                    </button>
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => handleDeleteAdmin(u)}
                        style={{ padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid #ef444444', background: '#ef444422', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {editUserId && (() => {
              const editUser = users.find((u) => u.id === editUserId);
              const isSA = editUser?.role === 'super_admin';
              return (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', background: 'var(--color-bg)' }}>
                    {editError && <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem' }}>{editError}</div>}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Change Email</label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="New email" style={{ padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.9rem', width: 220 }} />
                          <button onClick={() => handleEmailChange(editUserId)} style={{ padding: '0.45rem 0.8rem', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>Save</button>
                        </div>
                      </div>
                      {!isSA && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Change Password</label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="New password (min 8)" minLength={8} style={{ padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.9rem', width: 220 }} />
                            <button onClick={() => handlePasswordReset(editUserId)} style={{ padding: '0.45rem 0.8rem', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>Change Password</button>
                          </div>
                        </div>
                      )}
                      {isSA && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                          Password change is not available for super admin users.
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
