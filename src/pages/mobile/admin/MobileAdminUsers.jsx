import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../../api';
import {
    Users, Search, Shield, Crown, User, Plus, X,
    ChevronRight, Mail, Calendar, MoreVertical,
    FileText, UserCog, Eye, Key, Check, AlertCircle,
    Ticket, CheckCircle, Clock, Edit3, Save, Loader2, Bot, RotateCcw
} from 'lucide-react';
import Loading from '../../../components/Loading';
import { formatDateOnly, formatDate } from '../../../utils/date';

const roleConfig = {
    super_admin: {
        label: '超级管理员',
        icon: Crown,
        className: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200',
        bgColor: 'bg-amber-50',
    },
    admin: {
        label: '管理员',
        icon: Shield,
        className: 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-200',
        bgColor: 'bg-indigo-50',
    },
    user: {
        label: '普通用户',
        icon: User,
        className: 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-600 border border-slate-200',
        bgColor: 'bg-slate-50',
    },
};

// Skeleton loading component
const UserCardSkeleton = () => (
    <div className="mobile-admin-user-card animate-pulse">
        <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 bg-slate-200 rounded w-24" />
                    <div className="h-5 bg-slate-200 rounded-full w-16" />
                </div>
                <div className="h-3 bg-slate-200 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-24" />
            </div>
        </div>
    </div>
);

export default function MobileAdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Modal states
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(null);

    // Form states
    const [createForm, setCreateForm] = useState({
        username: '', password: '', email: '', real_name: '', role: 'user'
    });
    const [editForm, setEditForm] = useState({
        username: '', email: '', real_name: '', nickname: '', role: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Password change specific
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setFormError('两次输入的密码不一致');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setFormError('密码长度不能少于6位');
            return;
        }

        setFormLoading(true);
        setFormError('');
        try {
            await api.put(`/users/${selectedUser.id}/password`, { password: passwordForm.newPassword });
            setShowPasswordModal(false);
            alert('密码修改成功');
        } catch (err) {
            setFormError(err.response?.data?.error || '修改密码失败');
        } finally {
            setFormLoading(false);
        }
    };

    const openPasswordModal = (user) => {
        setSelectedUser(user);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setFormError('');
        setShowPasswordModal(true);
        setShowDetailModal(false);
        setShowActionMenu(null);
    };

    // User stats
    const [userStats, setUserStats] = useState({
        total: 0, admins: 0, users: 0
    });

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const isSuperAdmin = currentUser?.role === 'super_admin';

    // AI ban tracking
    const [aiBans, setAiBans] = useState(new Set());

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setPagination(p => ({ ...p, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Role filter change
    const handleRoleFilterChange = (role) => {
        setRoleFilter(role);
        setPagination(p => ({ ...p, page: 1 }));
    }

    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        fetchUsers();
        if (isSuperAdmin) {
            fetchAiBans();
        }
    }, [pagination.page, debouncedSearchQuery, roleFilter]);

    // Fetch AI bans
    const fetchAiBans = async () => {
        try {
            const res = await api.get('/ai-qa/admin/banned');
            setAiBans(new Set(res.data.map(b => b.user_id)));
        } catch (err) {
            console.error('Failed to fetch AI bans:', err);
        }
    };

    // Toggle AI ban
    const handleToggleAiBan = async (userId, isBanned) => {
        const action = isBanned ? '解除封禁' : '封禁';
        if (!confirm(`确定要${action}该用户的 AI 功能？`)) return;
        try {
            if (isBanned) {
                await api.delete(`/ai-qa/admin/ban/${userId}`);
            } else {
                await api.post(`/ai-qa/admin/ban/${userId}`, { reason: '管理员操作' });
            }
            fetchAiBans();
            setShowActionMenu(null);
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        }
    };

    // Reset AI rate limit
    const handleResetAiLimit = async (userId) => {
        if (!confirm('确定要重置该用户的今日 AI 问答次数？')) return;
        try {
            await api.post(`/ai-qa/admin/reset-limit/${userId}`);
            alert('已成功重置');
            setShowActionMenu(null);
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            //console.log('[MobileAdminUsers] Fetching users...', { page: pagination.page, role: roleFilter, search: debouncedSearchQuery });

            const params = {
                page: pagination.page,
                limit: 20, // Match desktop limit
            };

            // Only add filters if valid
            if (roleFilter && roleFilter !== 'all') {
                params.role = roleFilter;
            }
            if (debouncedSearchQuery) {
                params.search = debouncedSearchQuery;
            }

            const res = await api.get('/users', { params });
            //console.log('[MobileAdminUsers] Response:', res.data);

            if (res.data.pagination) {
                const fetchedUsers = res.data.users || [];
                setUsers(fetchedUsers);
                setPagination(res.data.pagination);

                // Update stats
                if (res.data.stats) {
                    setUserStats({
                        total: res.data.pagination.total || 0,
                        admins: res.data.stats.total_admins || 0,
                        users: res.data.stats.total_users || 0
                    });
                } else {
                    // Fallback using current page data (approximate)
                    setUserStats({
                        total: res.data.pagination.total || fetchedUsers.length,
                        admins: 0,
                        users: 0
                    });
                }
            } else {
                // Compatibility with non-paginated response
                const list = Array.isArray(res.data) ? res.data : [];
                setUsers(list);
                setUserStats({
                    total: list.length,
                    admins: list.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
                    users: list.filter(u => u.role === 'user').length
                });
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError(err.response?.data?.error || '加载用户列表失败');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const handlePromote = async (userId, newRole) => {
        const roleLabel = newRole === 'admin' ? '管理员' : '普通用户';
        if (!confirm(`确定将该用户设置为${roleLabel}?`)) return;

        try {
            await api.post('/users/promote', { userId, role: newRole });
            fetchUsers();
            setShowDetailModal(false);
            setShowActionMenu(null);
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!createForm.username || !createForm.password) {
            setFormError('用户名和密码为必填项');
            return;
        }

        setFormLoading(true);
        setFormError('');
        try {
            await api.post('/users', createForm);
            setShowCreateModal(false);
            setCreateForm({ username: '', password: '', email: '', real_name: '', role: 'user' });
            fetchUsers();
        } catch (err) {
            setFormError(err.response?.data?.error || '创建失败');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;

        setFormLoading(true);
        setFormError('');
        try {
            await api.put(`/users/${selectedUser.id}`, editForm);
            setShowEditModal(false);
            fetchUsers();
        } catch (err) {
            setFormError(err.response?.data?.error || '更新失败');
        } finally {
            setFormLoading(false);
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditForm({
            username: user.username || '',
            email: user.email || '',
            real_name: user.real_name || '',
            nickname: user.nickname || '',
            role: user.role || 'user'
        });
        setFormError('');
        setShowEditModal(true);
        setShowDetailModal(false);
        setShowActionMenu(null);
    };

    const openDetailModal = (user) => {
        setSelectedUser(user);
        setShowDetailModal(true);
        setShowActionMenu(null);
    };

    // Use users directly instead of client-side filtering
    const filteredUsers = users;


    const getRoleInfo = (role) => roleConfig[role] || roleConfig.user;

    const roleFilters = [
        { key: 'all', label: '全部' },
        { key: 'super_admin', label: '超管' },
        { key: 'admin', label: '管理员' },
        { key: 'user', label: '普通用户' },
    ];

    return (
        <div className="mobile-page">
            {/* Header */}
            <header className="mobile-admin-header">
                <div>
                    <h1 className="text-lg font-bold text-slate-800">用户管理</h1>
                    <span className="text-xs text-slate-500">共 {userStats.total || pagination.total || users.length} 人</span>
                </div>
                {isSuperAdmin && (
                    <button
                        onClick={() => {
                            setFormError('');
                            setShowCreateModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg"
                    >
                        <Plus size={16} />
                        <span>创建</span>
                    </button>
                )}
            </header>

            {/* Stats Cards */}
            <div className="px-4 py-3 bg-white border-b border-slate-100">
                <div className="grid grid-cols-3 gap-3">
                    <div className="mobile-admin-stat-card text-center">
                        <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
                            <Users size={16} className="text-indigo-600" />
                        </div>
                        <div className="text-lg font-bold text-slate-800">{userStats.total}</div>
                        <div className="text-xs text-slate-500">总用户</div>
                    </div>
                    <div className="mobile-admin-stat-card text-center">
                        <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg">
                            <Shield size={16} className="text-amber-600" />
                        </div>
                        <div className="text-lg font-bold text-slate-800">{userStats.admins}</div>
                        <div className="text-xs text-slate-500">管理员</div>
                    </div>
                    <div className="mobile-admin-stat-card text-center">
                        <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gradient-to-br from-slate-100 to-gray-100 rounded-lg">
                            <User size={16} className="text-slate-600" />
                        </div>
                        <div className="text-lg font-bold text-slate-800">{userStats.users}</div>
                        <div className="text-xs text-slate-500">普通用户</div>
                    </div>
                </div>
            </div>

            {/* Role Filter Chips */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 overflow-x-auto">
                <div className="flex gap-2">
                    {roleFilters.map(filter => (
                        <button
                            key={filter.key}
                            onClick={() => handleRoleFilterChange(filter.key)}
                            className={`mobile-filter-chip ${roleFilter === filter.key ? 'active' : ''}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-3 bg-white border-b border-slate-100">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索用户名、邮箱、姓名..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Refresh Button */}
            <div className="flex justify-center py-2">
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                >
                    <Loader2 size={14} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? '刷新中...' : '刷新列表'}
                </button>
            </div>

            {/* User List */}
            <div className="px-4 py-2 space-y-3">
                {error ? (
                    <div className="text-center py-12 text-slate-400">
                        <AlertCircle size={40} className="mx-auto mb-2 text-red-400 opacity-80" />
                        <p className="text-slate-600 mb-2">{error}</p>
                        <button
                            onClick={handleRefresh}
                            className="text-indigo-600 font-medium px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                        >
                            重试
                        </button>
                    </div>
                ) : loading ? (
                    <>
                        <UserCardSkeleton />
                        <UserCardSkeleton />
                        <UserCardSkeleton />
                        <UserCardSkeleton />
                    </>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Users size={40} className="mx-auto mb-2 opacity-50" />
                        <p>暂无用户</p>
                    </div>
                ) : (
                    filteredUsers.map((user, index) => {
                        const roleInfo = getRoleInfo(user.role);
                        const RoleIcon = roleInfo.icon;
                        const canPromote = currentUser.role === 'super_admin' && user.id !== currentUser.id;

                        return (
                            <div
                                key={user.id}
                                className="mobile-admin-user-card"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Avatar - Clickable for details */}
                                    <div
                                        onClick={() => openDetailModal(user)}
                                        className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                                    >
                                        {user.username?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>

                                    {/* Info - Clickable for details */}
                                    <div
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => openDetailModal(user)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-slate-800 truncate">
                                                {user.real_name || user.username}
                                            </span>
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.className}`}>
                                                <RoleIcon size={10} />
                                                {roleInfo.label}
                                            </span>
                                        </div>

                                        {user.email && (
                                            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                                <Mail size={12} />
                                                <span className="truncate">{user.email}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Calendar size={12} />
                                            <span>注册于 {formatDateOnly(user.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Actions Menu Button */}
                                    <div className="relative flex-shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowActionMenu(showActionMenu === user.id ? null : user.id);
                                            }}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <MoreVertical size={18} className="text-slate-400" />
                                        </button>

                                        {/* Action Menu Dropdown */}
                                        {showActionMenu === user.id && (
                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 min-w-[140px]">
                                                <button
                                                    onClick={() => openDetailModal(user)}
                                                    className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                                                >
                                                    <Eye size={14} />
                                                    查看详情
                                                </button>
                                                {isSuperAdmin && user.id !== currentUser.id && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(user)}
                                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                                                        >
                                                            <Edit3 size={14} />
                                                            编辑信息
                                                        </button>
                                                        {user.role === 'user' && (
                                                            <button
                                                                onClick={() => handlePromote(user.id, 'admin')}
                                                                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-indigo-600 hover:bg-indigo-50"
                                                            >
                                                                <Shield size={14} />
                                                                设为管理员
                                                            </button>
                                                        )}
                                                        {user.role === 'admin' && (
                                                            <button
                                                                onClick={() => handlePromote(user.id, 'user')}
                                                                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                                                            >
                                                                <User size={14} />
                                                                取消管理员
                                                            </button>
                                                        )}
                                                        {/* AI Management */}
                                                        <div className="border-t border-slate-100 my-1" />
                                                        <button
                                                            onClick={() => handleToggleAiBan(user.id, aiBans.has(user.id))}
                                                            className={`flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm ${aiBans.has(user.id) ? 'text-emerald-600 hover:bg-emerald-50' : 'text-orange-600 hover:bg-orange-50'}`}
                                                        >
                                                            <Bot size={14} />
                                                            {aiBans.has(user.id) ? '解禁AI' : '禁用AI'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetAiLimit(user.id)}
                                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50"
                                                        >
                                                            <RotateCcw size={14} />
                                                            重置AI次数
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 pt-4">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-4 py-2 text-sm text-slate-600">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </div>

            {/* Click outside to close action menu */}
            {showActionMenu && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActionMenu(null)}
                />
            )}

            {/* User Detail Modal */}
            {showDetailModal && selectedUser && (
                <div className="mobile-modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                        <div className="mobile-modal-header">
                            <h2 className="text-lg font-bold text-slate-800">用户详情</h2>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="mobile-modal-close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mobile-modal-content">
                            {/* User Profile Card */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
                                    {selectedUser.username?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {selectedUser.real_name || selectedUser.username}
                                    </h3>
                                    <p className="text-sm text-slate-500">@{selectedUser.username}</p>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${getRoleInfo(selectedUser.role).className}`}>
                                        {React.createElement(getRoleInfo(selectedUser.role).icon, { size: 10 })}
                                        {getRoleInfo(selectedUser.role).label}
                                    </span>
                                </div>
                            </div>

                            {/* User Info */}
                            <div className="space-y-3 mb-6">
                                {selectedUser.email && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <Mail size={18} className="text-slate-400" />
                                        <div>
                                            <div className="text-xs text-slate-400">邮箱</div>
                                            <div className="text-sm text-slate-700">{selectedUser.email}</div>
                                        </div>
                                    </div>
                                )}
                                {selectedUser.student_id && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <FileText size={18} className="text-slate-400" />
                                        <div>
                                            <div className="text-xs text-slate-400">学号</div>
                                            <div className="text-sm text-slate-700">{selectedUser.student_id}</div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <Calendar size={18} className="text-slate-400" />
                                    <div>
                                        <div className="text-xs text-slate-400">注册时间</div>
                                        <div className="text-sm text-slate-700">{formatDate(selectedUser.created_at)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <Mail size={18} className="text-slate-400" />
                                    <div>
                                        <div className="text-xs text-slate-400">邮件通知</div>
                                        <div className={`text-sm ${selectedUser.email_notification_enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {selectedUser.email_notification_enabled ? '已开启' : '已关闭'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            {isSuperAdmin && selectedUser.id !== currentUser.id && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => openEditModal(selectedUser)}
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-50 text-indigo-600 rounded-xl font-medium"
                                    >
                                        <Edit3 size={16} />
                                        编辑用户信息
                                    </button>
                                    {selectedUser.role === 'user' ? (
                                        <button
                                            onClick={() => handlePromote(selectedUser.id, 'admin')}
                                            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-amber-50 text-amber-600 rounded-xl font-medium"
                                        >
                                            <Shield size={16} />
                                            设为管理员
                                        </button>
                                    ) : selectedUser.role === 'admin' ? (
                                        <button
                                            onClick={() => handlePromote(selectedUser.id, 'user')}
                                            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-medium"
                                        >
                                            <User size={16} />
                                            取消管理员
                                        </button>
                                    ) : null}
                                    <button
                                        onClick={() => openPasswordModal(selectedUser)}
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-medium"
                                    >
                                        <Key size={16} />
                                        修改密码
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {
                showCreateModal && (
                    <div className="mobile-modal-overlay" onClick={() => setShowCreateModal(false)}>
                        <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                            <div className="mobile-modal-header">
                                <h2 className="text-lg font-bold text-slate-800">创建用户</h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="mobile-modal-close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mobile-modal-content">
                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                                            <AlertCircle size={16} />
                                            {formError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            用户名 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.username}
                                            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请输入用户名"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            密码 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={createForm.password}
                                            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请输入密码"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                        <input
                                            type="email"
                                            value={createForm.email}
                                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请输入邮箱"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">真实姓名</label>
                                        <input
                                            type="text"
                                            value={createForm.real_name}
                                            onChange={(e) => setCreateForm({ ...createForm, real_name: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请输入真实姓名"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">角色</label>
                                        <select
                                            value={createForm.role}
                                            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                                        >
                                            <option value="user">普通用户</option>
                                            <option value="admin">管理员</option>
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {formLoading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                创建中...
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={16} />
                                                创建用户
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Change Password Modal */}
            {
                showPasswordModal && selectedUser && (
                    <div className="mobile-modal-overlay" onClick={() => setShowPasswordModal(false)}>
                        <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                            <div className="mobile-modal-header">
                                <h2 className="text-lg font-bold text-slate-800">修改密码</h2>
                                <button onClick={() => setShowPasswordModal(false)} className="mobile-modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mobile-modal-content">
                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-sm flex items-start gap-2">
                                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                        <span>正在修改用户 <b>{selectedUser.username}</b> 的密码。此操作将强制重置该用户的登录密码。</span>
                                    </div>
                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                                            <AlertCircle size={16} />
                                            {formError}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">新密码</label>
                                        <input
                                            type="password"
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请输入新密码"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">确认新密码</label>
                                        <input
                                            type="password"
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="请再次输入新密码"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                                        确认修改
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit User Modal */}
            {
                showEditModal && selectedUser && (
                    <div className="mobile-modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                            <div className="mobile-modal-header">
                                <h2 className="text-lg font-bold text-slate-800">编辑用户</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="mobile-modal-close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mobile-modal-content">
                                <form onSubmit={handleEditUser} className="space-y-4">
                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                                            <AlertCircle size={16} />
                                            {formError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                                        <input
                                            type="text"
                                            value={editForm.username}
                                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">真实姓名</label>
                                        <input
                                            type="text"
                                            value={editForm.real_name}
                                            onChange={(e) => setEditForm({ ...editForm, real_name: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">昵称</label>
                                        <input
                                            type="text"
                                            value={editForm.nickname}
                                            onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">角色</label>
                                        <select
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                                        >
                                            <option value="user">普通用户</option>
                                            <option value="admin">管理员</option>
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {formLoading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                保存中...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                保存更改
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
