import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    MessageSquare, Eye, BarChart2, Users, Mail, FileText,
    Settings, Tag, Bell, ChevronLeft, ChevronRight, LogOut,
    Crown, Shield, Home, Menu, X, Book
} from 'lucide-react';
import api from '../../api';

export default function AdminLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [kbEnabled, setKbEnabled] = useState(true);
    const navigate = useNavigate();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    useEffect(() => {
        const checkSettings = async () => {
            try {
                const res = await api.get('/settings/public');
                setKbEnabled(res.data.knowledge_base_enabled !== false);
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        checkSettings();
    }, []);

    // Check if user is admin
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        navigate('/login');
        return null;
    }

    const isSuperAdmin = currentUser.role === 'super_admin';

    // Navigation items configuration
    const navItems = [
        {
            path: '/admin/tickets',
            icon: MessageSquare,
            label: '工单管理',
            roles: ['admin', 'super_admin']
        },
        {
            path: '/admin/review',
            icon: Eye,
            label: '工单审核',
            roles: ['admin', 'super_admin']
        },
        {
            path: '/admin/analysis',
            icon: BarChart2,
            label: '数据分析',
            roles: ['admin', 'super_admin']
        },
        {
            path: '/admin/users',
            icon: Users,
            label: '用户管理',
            roles: ['admin', 'super_admin']
        },
        {
            path: '/admin/knowledge-base',
            icon: Book,
            label: '知识库',
            roles: ['admin', 'super_admin']
        },
        {
            path: '/admin/notifications',
            icon: Mail,
            label: '邮件通知',
            roles: ['admin', 'super_admin']
        },
        {
            type: 'divider',
            label: '超级管理员',
            roles: ['super_admin']
        },
        {
            path: '/admin/audit',
            icon: FileText,
            label: '审计日志',
            roles: ['super_admin']
        },
        {
            path: '/admin/settings',
            icon: Settings,
            label: '系统设置',
            roles: ['super_admin']
        },
        {
            path: '/admin/question-types',
            icon: Tag,
            label: '问题类型',
            roles: ['super_admin']
        },
        {
            path: '/admin/email-templates',
            icon: Mail,
            label: '邮件模版',
            roles: ['super_admin']
        },
        {
            path: '/admin/announcements',
            icon: Bell,
            label: '公告管理',
            roles: ['super_admin']
        }
    ];

    // Filter items based on user role and settings
    const visibleNavItems = navItems.filter(item => {
        // Role check
        if (!item.roles.includes(currentUser.role)) return false;

        // Knowledge Base check
        if (item.path === '/admin/knowledge-base' && !isSuperAdmin && !kbEnabled) {
            return false;
        }

        return true;
    });

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const NavItem = ({ item }) => {
        if (item.type === 'divider') {
            return (
                <div className={`px-4 py-2 mt-4 ${collapsed ? 'hidden' : ''}`}>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {item.label}
                    </span>
                </div>
            );
        }

        const Icon = item.icon;
        return (
            <NavLink
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-200 group ${isActive
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                    }`
                }
            >
                <Icon size={20} className={collapsed ? 'mx-auto' : ''} />
                {!collapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                )}
            </NavLink>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4">
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-slate-800">管理后台</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50
                transition-all duration-300 ease-in-out
                ${collapsed ? 'w-20' : 'w-64'}
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                {/* Logo Section */}
                <div className="h-20 flex items-center justify-between px-4 border-b border-slate-100">
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25">
                                <MessageSquare className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-slate-800 text-lg">管理后台</h1>
                                <p className="text-xs text-slate-400">后台管理中心</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div className="mx-auto p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="py-4 flex-1 overflow-y-auto h-[calc(100%-10rem)]">
                    <div className="space-y-1">
                        {visibleNavItems.map((item, index) => (
                            <NavItem key={item.path || `divider-${index}`} item={item} />
                        ))}
                    </div>
                </nav>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
                    {!collapsed ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {currentUser.username?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{currentUser.username}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        {isSuperAdmin ? <Crown size={10} /> : <Shield size={10} />}
                                        {isSuperAdmin ? '超级管理员' : '管理员'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex-1 py-2 px-3 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Home size={16} />
                                    首页
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 py-2 px-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} />
                                    退出
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {currentUser.username?.charAt(0)?.toUpperCase()}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Collapse Toggle (Desktop Only) */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-colors"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </aside>

            {/* Main Content */}
            <main className={`
                transition-all duration-300 ease-in-out
                pt-16 lg:pt-0
                ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}
            `}>
                <div className="p-6 lg:p-8 min-h-screen">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
