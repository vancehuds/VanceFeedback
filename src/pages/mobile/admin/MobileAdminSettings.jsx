import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import { ChevronLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import Loading from '../../../components/Loading';

export default function MobileAdminSettings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            setSettings(res.data);
        } catch (err) {
            console.error('Failed to fetch settings:', err);
            setMessage('加载设置失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        // Process lists (convert string back to array if needed, but here we bind directly)
        // Actually, for simplicity, let's assume we handle array inputs as special fields or just ignore complex ones for now?
        // Let's support basic fields first.

        try {
            await api.put('/settings', settings);
            setMessage('设置已保存');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage(err.response?.data?.error || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // Helper for array fields (comma separated)
    const handleArrayChange = (key, value) => {
        const array = value.split(/[,\n]+/).map(item => item.trim()).filter(Boolean);
        handleChange(key, array);
    };

    const getArrayString = (key) => {
        return Array.isArray(settings[key]) ? settings[key].join('\n') : '';
    };

    if (loading) return <Loading variant="section" />;

    return (
        <div className="mobile-page">
            <header className="mobile-admin-header flex items-center gap-2">
                <button onClick={() => navigate('/m/admin/more')} className="p-1 -ml-2">
                    <ChevronLeft size={24} className="text-slate-600" />
                </button>
                <h1 className="text-lg font-bold text-slate-800">系统设置</h1>
            </header>

            <form onSubmit={handleSave} className="px-4 py-4 space-y-5">
                {message && (
                    <div className={`p-3 rounded-xl text-sm ${message.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {message}
                    </div>
                )}

                {/* Email Settings */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">SMTP 设置</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SMTP 服务器</label>
                        <input
                            type="text"
                            value={settings.smtp_host || ''}
                            onChange={e => handleChange('smtp_host', e.target.value)}
                            className="mobile-input"
                            placeholder="smtp.example.com"
                        />
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">端口</label>
                            <input
                                type="number"
                                value={settings.smtp_port || ''}
                                onChange={e => handleChange('smtp_port', parseInt(e.target.value) || 0)}
                                className="mobile-input"
                                placeholder="465"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">发送者名称</label>
                            <input
                                type="text"
                                value={settings.email_from_name || ''}
                                onChange={e => handleChange('email_from_name', e.target.value)}
                                className="mobile-input"
                                placeholder="反馈系统"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SMTP 用户名</label>
                        <input
                            type="text"
                            value={settings.smtp_user || ''}
                            onChange={e => handleChange('smtp_user', e.target.value)}
                            className="mobile-input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SMTP 密码</label>
                        <input
                            type="password"
                            value={settings.smtp_pass || ''}
                            onChange={e => handleChange('smtp_pass', e.target.value)}
                            className="mobile-input"
                        />
                    </div>
                </section>

                {/* Notification Settings */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">通知设置</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            通知邮箱列表 (一行一个)
                        </label>
                        <textarea
                            value={getArrayString('notification_emails')}
                            onChange={e => handleArrayChange('notification_emails', e.target.value)}
                            className="mobile-input min-h-[100px]"
                            placeholder="admin@example.com"
                        />
                    </div>
                </section>

                {/* Repository Information */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">关于系统</h3>

                    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <svg className="w-6 h-6 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 mb-1">VanceFeedback</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    开源的智能反馈和工单管理系统
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <a
                                href="https://github.com/vancehuds/VanceFeedback"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                                GitHub 仓库
                            </a>

                            <a
                                href="https://github.com/vancehuds/VanceFeedback/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors active:scale-95"
                            >
                                <AlertCircle size={16} />
                                问题反馈
                            </a>

                            <a
                                href="https://github.com/vancehuds/VanceFeedback#readme"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                使用文档
                            </a>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs text-slate-500">
                                💡 遇到问题可以访问 GitHub 仓库
                            </p>
                        </div>
                    </div>
                </section>

                <div className="pt-4 pb-8">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        保存设置
                    </button>
                </div>
            </form>
        </div>
    );
}
