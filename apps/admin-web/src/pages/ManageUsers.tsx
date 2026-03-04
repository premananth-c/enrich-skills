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
  const [roleKey, setRoleKey] = useState('');
  const [permissions, setPermissions] = useState<Record<ModuleKey, PermissionLevel>>(defaultPermissions);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRole, setAdminRole] = useState('admin');

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
      ...roles.map((r) => ({ key: r.roleKey, label: r.displayName })),
    ],
    [roles]
  );

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/users/roles', {
      method: 'POST',
      body: JSON.stringify({
        roleKey,
        displayName: roleName,
        permissions,
      }),
    });
    setRoleName('');
    setRoleKey('');
    setPermissions(defaultPermissions);
    await load();
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

  const handleRoleChange = async (userId: string, roleKey: string) => {
    await api(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roleKey }),
    });
    await load();
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

        <form onSubmit={handleCreateRole} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Create Custom Role</h3>
          <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Display name (e.g. Test Reviewer)" required style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          <input value={roleKey} onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="role_key" required style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />
          <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.8rem' }}>
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
          <button type="submit" style={{ padding: '0.55rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>
            Create Role
          </button>
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
                <td style={{ padding: '0.75rem 1rem' }}>{u.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
