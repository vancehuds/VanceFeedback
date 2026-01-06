import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import {
    Users, UserPlus, Edit, X, Shield, Crown, Bot, RotateCcw
} from 'lucide-react';
import Loading from '../../components/Loading';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '', password: '', role: 'user', email: '',
        student_id: '', real_name: '', nickname: '', email_notification_enabled: 1
    });
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // Pagination
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    // AI ban tracking
    const [aiBans, setAiBans] = useState(new Set());

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users', { params: { page: pagination.page, limit: 20 } });
            if (res.data.pagination) {
                setUsers(res.data.users);
                setPagination(res.data.pagination);
            } else {
                setUsers(res.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (currentUser.role === 'super_admin') {
            fetchAiBans();
        }
    }, [pagination.page]);

    // Fetch AI bans
    const fetchAiBans = async () => {
        try {
            const res = await api.get('/ai-qa/admin/banned');
            setAiBans(new Set(res.data.map(b => b.user_id)));
        } catch (err) {
            console.error('Failed to fetch AI bans:', err);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePromote = async (userId, role) => {
        if (!confirm(`确定将该用户设置为 ${role === 'admin' ? '管理员' : '普通用户'}?`)) return;
        await api.post('/users/promote', { userId, role });
        fetchData();
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
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            username: '', password: '', role: 'user', email: '',
            student_id: '', real_name: '', nickname: '', email_notification_enabled: 1
        });
        setIsModalOpen(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            email: user.email || '',
            student_id: user.student_id || '',
            real_name: user.real_name || '',
            nickname: user.nickname || '',
            email_notification_enabled: user.email_notification_enabled !== undefined ? user.email_notification_enabled : 1
        });
        setIsModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                const data = { ...formData };
                if (!data.password) delete data.password;
                await api.put(`/users/${editingUser.id}`, data);
            } else {
                await api.post('/users', formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">用户管理</h1>
                    <p className="text-slate-500 mt-1">管理系统用户和权限</p>
                </div>
            </div>

            {/* User List */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        用户列表
                    </span>
                    <button
                        onClick={openCreateModal}
                        className="btn-primary flex items-center gap-2 py-2.5 px-4 w-full sm:w-auto justify-center"
                    >
                        <UserPlus size={18} />
                        添加用户
                    </button>
                </div>

                {loading && users.length === 0 ? (
                    <Loading variant="section" text="正在加载用户列表..." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-sm">
                                <tr>
                                    <th className="p-4 font-semibold">ID</th>
                                    <th className="p-4 font-semibold">用户名</th>
                                    <th className="p-4 font-semibold">昵称</th>
                                    <th className="p-4 font-semibold">学号</th>
                                    <th className="p-4 font-semibold">姓名</th>
                                    <th className="p-4 font-semibold">邮箱</th>
                                    <th className="p-4 font-semibold">邮件通知</th>
                                    <th className="p-4 font-semibold">角色</th>
                                    <th className="p-4 font-semibold">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-600">{u.id}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                                    {u.username?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-800">{u.username}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600">{u.nickname || '-'}</td>
                                        <td className="p-4 text-slate-600">{u.student_id || '-'}</td>
                                        <td className="p-4 text-slate-600">{u.real_name || '-'}</td>
                                        <td className="p-4 text-slate-600">{u.email || '-'}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${u.email_notification_enabled
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {u.email_notification_enabled ? '已开启' : '已关闭'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${u.role === 'super_admin'
                                                ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700'
                                                : u.role === 'admin'
                                                    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700'
                                                    : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {u.role === 'super_admin' && <Crown size={12} />}
                                                {u.role === 'admin' && <Shield size={12} />}
                                                {u.role === 'super_admin' ? '超级管理员' : u.role === 'admin' ? '管理员' : '普通用户'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {((currentUser.role === 'super_admin' && u.role !== 'super_admin') ||
                                                (currentUser.role === 'admin' && u.role === 'user')) && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openEditModal(u)}
                                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="编辑"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        {currentUser.role === 'super_admin' && (
                                                            <>
                                                                {u.role === 'user' && (
                                                                    <button
                                                                        onClick={() => handlePromote(u.id, 'admin')}
                                                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                                                    >
                                                                        设为管理员
                                                                    </button>
                                                                )}
                                                                {u.role === 'admin' && (
                                                                    <button
                                                                        onClick={() => handlePromote(u.id, 'user')}
                                                                        className="text-xs font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                                    >
                                                                        降级为用户
                                                                    </button>
                                                                )}
                                                            </>)}
                                                        {/* AI Management - Super Admin Only */}
                                                        {currentUser.role === 'super_admin' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleToggleAiBan(u.id, aiBans.has(u.id))}
                                                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${aiBans.has(u.id)
                                                                        ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                                                        : 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                                                                        }`}
                                                                    title={aiBans.has(u.id) ? '解除AI封禁' : '封禁AI'}
                                                                >
                                                                    <Bot size={14} />
                                                                    {aiBans.has(u.id) ? '解禁AI' : '禁用AI'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResetAiLimit(u.id)}
                                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                                                                    title="重置AI问答次数"
                                                                >
                                                                    <RotateCcw size={14} />
                                                                    重置次数
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
                        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                            <button
                                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                                disabled={pagination.page === 1}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1.5 text-sm font-medium text-slate-600 flex items-center">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 sm:p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 sm:p-6 relative max-h-[88vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                                {editingUser ? <Edit className="w-6 h-6 text-white" /> : <UserPlus className="w-6 h-6 text-white" />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingUser ? '编辑用户' : '添加用户'}
                            </h3>
                        </div>

                        <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">用户名</label>
                                <input
                                    required
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">密码 {editingUser && '(留空则不修改)'}</label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">学号</label>
                                <input
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.student_id}
                                    onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                                    placeholder="选填"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">姓名</label>
                                <input
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.real_name}
                                    onChange={e => setFormData({ ...formData, real_name: e.target.value })}
                                    placeholder="选填"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">昵称</label>
                                <input
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.nickname}
                                    onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                                    placeholder="选填"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">邮箱</label>
                                <input
                                    type="email"
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="选填"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="email_notification"
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={formData.email_notification_enabled !== 0}
                                    onChange={e => setFormData({ ...formData, email_notification_enabled: e.target.checked ? 1 : 0 })}
                                />
                                <label htmlFor="email_notification" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                                    接收工单回复邮件通知
                                </label>
                            </div>
                            {currentUser.role === 'super_admin' && (
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold mb-2 text-slate-700">角色</label>
                                    <select
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="user">普通用户</option>
                                        <option value="admin">管理员</option>
                                        <option value="super_admin">超级管理员</option>
                                    </select>
                                </div>
                            )}
                            <button className="col-span-1 md:col-span-2 w-full btn-primary py-4 rounded-xl text-lg mt-2">
                                {editingUser ? '保存修改' : '立即创建'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
