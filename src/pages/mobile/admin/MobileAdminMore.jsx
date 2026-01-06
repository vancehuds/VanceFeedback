import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Bell, Tag, Mail, FileText,
    Megaphone, Shield, ChevronRight, Monitor, Sparkles, Book
} from 'lucide-react';

const settingsItems = [
    {
        label: '系统设置',
        description: '基础配置、邮件通知等',
        icon: Settings,
        gradient: 'from-indigo-500 to-purple-500',
        path: '/m/admin/settings',
        roles: ['super_admin']
    },
    {
        label: '问题类型管理',
        description: '配置反馈类型',
        icon: Tag,
        gradient: 'from-blue-500 to-cyan-500',
        path: '/m/admin/question-types',
        roles: ['super_admin']
    },
    {
        label: '邮件模板',
        description: '自定义通知邮件内容',
        icon: Mail,
        gradient: 'from-emerald-500 to-green-500',
        action: () => alert('请在电脑端配置邮件模板'),
        roles: ['super_admin']
    },
    {
        label: '公告管理',
        description: '发布系统公告',
        icon: Megaphone,
        gradient: 'from-amber-500 to-orange-500',
        path: '/m/admin/announcements',
        roles: ['super_admin']
    },
    {
        label: '审计日志',
        description: '查看系统操作记录',
        icon: FileText,
        gradient: 'from-rose-500 to-pink-500',
        path: '/m/admin/audit',
        roles: ['super_admin']
    },
    {
        label: 'AI 设置',
        description: '配置智能回复功能',
        icon: Sparkles,
        gradient: 'from-violet-500 to-purple-500',
        action: () => alert('请在电脑端配置 AI 设置'),
        roles: ['super_admin']
    },
    {
        label: '知识库管理',
        description: '管理 FAQ 和帮助文档',
        icon: Book,
        gradient: 'from-emerald-500 to-teal-500',
        path: '/m/admin/knowledge-base',
        roles: ['admin', 'super_admin']
    },
];

export default function MobileAdminMore() {
    const navigate = useNavigate();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // Both admin and super_admin can access this page
    if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin') {
        return (
            <div className="mobile-page">
                <header className="mobile-admin-header">
                    <h1 className="text-lg font-bold text-slate-800">无权访问</h1>
                </header>
                <div className="px-4 py-12 text-center text-slate-500">
                    <Shield size={48} className="mx-auto mb-4 opacity-50" />
                    <p>此页面仅限管理员访问</p>
                </div>
            </div>
        );
    }

    // Filter items based on current user's role
    const visibleItems = settingsItems.filter(item =>
        item.roles.includes(currentUser?.role)
    );

    return (
        <div className="mobile-page">
            {/* Header */}
            <header className="mobile-admin-header">
                <h1 className="text-lg font-bold text-slate-800">更多设置</h1>
            </header>

            {/* Settings List */}
            <div className="px-4 py-4 space-y-3">
                {/* Notice */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Monitor size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">电脑端管理</h3>
                            <p className="text-sm text-slate-600">
                                部分高级功能请访问 <span className="font-medium text-indigo-600">/dashboard</span> 进行操作。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Settings Items */}
                {visibleItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className="mobile-card flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                            onClick={() => {
                                if (item.path) {
                                    navigate(item.path);
                                } else if (item.action) {
                                    item.action();
                                }
                            }}
                        >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center flex-shrink-0`}>
                                <Icon size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-800">{item.label}</div>
                                <div className="text-xs text-slate-500">{item.description}</div>
                            </div>
                            <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
                        </div>
                    );
                })}
            </div>

            {/* Logout Section */}
            <div className="px-4 py-4">
                <button
                    onClick={() => {
                        if (confirm('确定退出登录？')) {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            navigate('/m/login');
                        }
                    }}
                    className="w-full py-3 text-center text-red-500 bg-red-50 rounded-xl font-medium"
                >
                    退出登录
                </button>
            </div>
        </div>
    );
}
