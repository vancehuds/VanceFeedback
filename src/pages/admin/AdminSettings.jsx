import React, { useState, useEffect } from 'react';
import api from '../../api';
import {
    Settings, Save, RefreshCcw, CheckCircle, AlertCircle, Shield, Mail,
    AtSign, Sparkles, Bell, Monitor, Plus, Minus, Key, FileText, Send,
    ToggleLeft, ToggleRight
} from 'lucide-react';
import Loading from '../../components/Loading';

export default function AdminSettings() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings');
            setSettings(res.data);
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.put('/settings', settings);
            setMessage({ type: 'success', text: '设置保存成功' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    const addToList = (key) => {
        const value = window.prompt(`请输入要添加的${key === 'email_suffix_whitelist' ? '邮箱后缀' : '邮箱'}：`);
        if (value && value.trim()) {
            const currentList = settings[key] || [];
            updateSetting(key, [...currentList, value.trim()]);
        }
    };

    const removeFromList = (key, index) => {
        const currentList = settings[key] || [];
        updateSetting(key, currentList.filter((_, i) => i !== index));
    };

    if (loading) {
        return <Loading variant="section" text="正在加载设置..." />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">系统设置</h1>
                    <p className="text-slate-500 mt-1">配置系统参数和功能（仅超级管理员可见）</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSettings}
                        className="btn-secondary px-4 py-2.5 flex items-center gap-2"
                    >
                        <RefreshCcw size={16} />
                        刷新
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="btn-primary px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loading variant="inline" text="保存中..." /> : <><Save size={16} /> 保存设置</>}
                    </button>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <span className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-500" />
                        系统设置
                    </span>
                </div>

                <div className="p-6 space-y-8">
                    {/* Captcha Settings */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Shield className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">人机验证配置</h3>
                                    <p className="text-sm text-slate-500">防止机器人提交，支持 Cloudflare Turnstile 和 Altcha (PoW)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('recaptcha_enabled', !settings.recaptcha_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.recaptcha_enabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.recaptcha_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {settings.recaptcha_enabled && (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {/* Provider Selection */}
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-slate-700">验证服务提供商</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="recaptcha_provider"
                                                value="turnstile"
                                                checked={!settings.recaptcha_provider || settings.recaptcha_provider === 'turnstile'}
                                                onChange={() => updateSetting('recaptcha_provider', 'turnstile')}
                                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700">Cloudflare Turnstile (推荐)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="recaptcha_provider"
                                                value="altcha"
                                                checked={settings.recaptcha_provider === 'altcha'}
                                                onChange={() => updateSetting('recaptcha_provider', 'altcha')}
                                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700">Altcha (PoW, 无需API Key)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Turnstile Settings */}
                                {(!settings.recaptcha_provider || settings.recaptcha_provider === 'turnstile') && (
                                    <div className="grid grid-cols-1 gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Site Key</label>
                                            <input
                                                type="text"
                                                value={settings.recaptcha_site_key || ''}
                                                onChange={e => updateSetting('recaptcha_site_key', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                placeholder="0x..."
                                            />
                                            <p className="text-xs text-slate-500 mt-1">从 Cloudflare Dashboard 获取</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                                            <input
                                                type="password"
                                                value={settings.recaptcha_secret_key || ''}
                                                onChange={e => updateSetting('recaptcha_secret_key', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                placeholder="********"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Altcha Settings */}
                                {settings.recaptcha_provider === 'altcha' && (
                                    <div className="grid grid-cols-1 gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">HMAC Key (服务端验证密钥)</label>
                                            <input
                                                type="password"
                                                value={settings.altcha_hmac_key || ''}
                                                onChange={e => updateSetting('altcha_hmac_key', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                                                placeholder="******** (留空将自动生成)"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">用于生成和验证 PoW 挑战，建议由系统自动管理</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SMTP Settings */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <Mail className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">SMTP 邮件服务</h3>
                                <p className="text-sm text-slate-500">用于发送验证码和通知邮件</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">SMTP 服务器</label>
                                <input
                                    type="text"
                                    value={settings.smtp_host || ''}
                                    onChange={e => updateSetting('smtp_host', e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="smtp.example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">端口</label>
                                <input
                                    type="number"
                                    value={settings.smtp_port || ''}
                                    onChange={e => updateSetting('smtp_port', e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="587"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                                <input
                                    type="text"
                                    value={settings.smtp_user || ''}
                                    onChange={e => updateSetting('smtp_user', e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                                <input
                                    type="password"
                                    value={settings.smtp_pass || ''}
                                    onChange={e => updateSetting('smtp_pass', e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="********"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">发件人地址</label>
                                <input
                                    type="text"
                                    value={settings.smtp_from || ''}
                                    onChange={e => updateSetting('smtp_from', e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="noreply@example.com"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={settings.smtp_secure || false}
                                    onChange={e => updateSetting('smtp_secure', e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="text-sm font-medium text-slate-700">使用 SSL/TLS</label>
                            </div>
                        </div>
                    </div>

                    {/* Email Verification Section */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Key className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">邮箱验证</h3>
                                    <p className="text-sm text-slate-500">注册时需要验证邮箱</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('email_verification_enabled', !settings.email_verification_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.email_verification_enabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.email_verification_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {settings.email_verification_enabled && (
                            <div className="pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-700">邮箱后缀白名单</label>
                                    <button
                                        onClick={() => addToList('email_suffix_whitelist')}
                                        className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                                    >
                                        <Plus size={16} /> 添加
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(settings.email_suffix_whitelist || []).map((suffix, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm">
                                            @{suffix}
                                            <button onClick={() => removeFromList('email_suffix_whitelist', i)} className="text-slate-400 hover:text-red-500">
                                                <Minus size={14} />
                                            </button>
                                        </span>
                                    ))}
                                    {(!settings.email_suffix_whitelist || settings.email_suffix_whitelist.length === 0) && (
                                        <span className="text-slate-400 text-sm">未设置白名单，允许所有邮箱后缀</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* AI Configuration */}
                    <div className="border-t border-slate-100 pt-6"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">AI 智能助手配置</h3>
                            <p className="text-sm text-slate-500">配置 AI 回复建议功能</p>
                        </div>
                    </div>

                    <div className="p-5 bg-purple-50/50 rounded-xl space-y-6 border border-purple-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-slate-800">启用 AI 功能</h4>
                                <p className="text-xs text-slate-500">开启后可使用 AI 智能建议回复</p>
                            </div>
                            <button
                                onClick={() => updateSetting('ai_enabled', !settings.ai_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.ai_enabled ? 'bg-purple-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.ai_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {settings.ai_enabled && (
                            <div className="space-y-4">
                                {/* Provider Selection */}
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-slate-700">AI 提供商</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="ai_provider"
                                                value="gemini"
                                                checked={settings.ai_provider === 'gemini'}
                                                onChange={() => updateSetting('ai_provider', 'gemini')}
                                                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-slate-700">Google Gemini</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="ai_provider"
                                                value="bigmodel"
                                                checked={settings.ai_provider === 'bigmodel'}
                                                onChange={() => updateSetting('ai_provider', 'bigmodel')}
                                                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-slate-700">智谱 BigModel</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Functionality Switches */}
                                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-200">
                                    <h5 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                                        <Sparkles size={14} className="text-purple-500" />
                                        功能开关
                                    </h5>
                                    <div className="space-y-2">
                                        <label className="flex items-center justify-between cursor-pointer group hover:bg-white p-2 rounded-lg transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">AI 回复建议</span>
                                                <span className="text-xs text-slate-400">在回复工单时提供智能建议</span>
                                            </div>
                                            <div className="relative inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ai_reply_enabled !== false}
                                                    onChange={(e) => updateSetting('ai_reply_enabled', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between cursor-pointer group hover:bg-white p-2 rounded-lg transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">AI 工单总结</span>
                                                <span className="text-xs text-slate-400">自动生成工单内容摘要和关键点</span>
                                            </div>
                                            <div className="relative inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ai_summary_enabled !== false}
                                                    onChange={(e) => updateSetting('ai_summary_enabled', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between cursor-pointer group hover:bg-white p-2 rounded-lg transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">AI 趋势分析</span>
                                                <span className="text-xs text-slate-400">分析工单趋势并提供洞察（需管理员权限）</span>
                                            </div>
                                            <div className="relative inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ai_analysis_enabled !== false}
                                                    onChange={(e) => updateSetting('ai_analysis_enabled', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Gemini Configuration */}
                                {settings.ai_provider === 'gemini' && (
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                                        <h5 className="font-medium text-slate-700">🌟 Gemini 配置</h5>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                                            <input
                                                type="password"
                                                value={settings.gemini_api_key || ''}
                                                onChange={(e) => updateSetting('gemini_api_key', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                                                placeholder="AIza..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">模型</label>
                                            <input
                                                type="text"
                                                value={settings.gemini_model || 'gemini-3-flash-preview'}
                                                onChange={(e) => updateSetting('gemini_model', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* BigModel Configuration */}
                                {settings.ai_provider === 'bigmodel' && (
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                                        <h5 className="font-medium text-slate-700">🧠 智谱 BigModel 配置</h5>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                                            <input
                                                type="password"
                                                value={settings.bigmodel_api_key || ''}
                                                onChange={(e) => updateSetting('bigmodel_api_key', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                                                placeholder="xxxx.xxxxxxxx"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">模型</label>
                                            <input
                                                type="text"
                                                value={settings.bigmodel_model || 'glm-4'}
                                                onChange={(e) => updateSetting('bigmodel_model', e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Test AI Connection */}
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={async () => {
                                            await handleSaveSettings();
                                            try {
                                                const res = await api.post('/settings/test-ai');
                                                alert(`✅ ${res.data.message}`);
                                            } catch (err) {
                                                alert(`❌ ${err.response?.data?.error || err.message}`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-white border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 transition-colors text-sm font-medium flex items-center gap-2"
                                    >
                                        <Sparkles size={14} />
                                        测试 AI 连接
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DingTalk Settings */}
                    <div className="border-t border-slate-100 pt-6"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">钉钉通知配置</h3>
                            <p className="text-sm text-slate-500">设置钉钉机器人 Webhook</p>
                        </div>
                    </div>

                    <div className="p-5 bg-blue-50/50 rounded-xl space-y-4 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">启用钉钉通知</span>
                            <button
                                onClick={() => updateSetting('dingtalk_enabled', !settings.dingtalk_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.dingtalk_enabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.dingtalk_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {settings.dingtalk_enabled && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-slate-700">Webhook 地址</label>
                                    <input
                                        type="text"
                                        value={settings.dingtalk_webhook || ''}
                                        onChange={(e) => updateSetting('dingtalk_webhook', e.target.value)}
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-slate-700">加签密钥 (Secret)</label>
                                    <input
                                        type="password"
                                        value={settings.dingtalk_secret || ''}
                                        onChange={(e) => updateSetting('dingtalk_secret', e.target.value)}
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        placeholder="SEC..."
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={async () => {
                                            const webhook = settings.dingtalk_webhook;
                                            const secret = settings.dingtalk_secret;
                                            if (!webhook) {
                                                alert('请先填写 Webhook 地址');
                                                return;
                                            }
                                            try {
                                                await api.post('/settings/test-dingtalk', { webhook, secret });
                                                alert('✅ 测试消息发送成功！');
                                            } catch (err) {
                                                alert(`❌ 发送失败: ${err.response?.data?.error || err.message}`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-sm font-medium flex items-center gap-2"
                                    >
                                        <Send size={14} />
                                        测试连接
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Homepage Customization */}
                    <div className="border-t border-slate-100 pt-6"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Monitor className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">首页定制</h3>
                            <p className="text-sm text-slate-500">自定义首页欢迎语和Logo</p>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">系统名称 / 大学名称</label>
                            <input
                                type="text"
                                value={settings.university_name || ''}
                                onChange={(e) => updateSetting('university_name', e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="xx大学"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">欢迎语</label>
                            <textarea
                                value={settings.welcome_message || ''}
                                onChange={(e) => updateSetting('welcome_message', e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                rows={3}
                                placeholder="致力于打造更好的阅读环境..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">站点Logo URL</label>
                            <input
                                type="url"
                                value={settings.site_logo_url || ''}
                                onChange={(e) => updateSetting('site_logo_url', e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="输入Logo图片URL"
                            />
                            {settings.site_logo_url && (
                                <div className="mt-3 p-4 bg-white rounded-xl border border-slate-200">
                                    <p className="text-xs font-medium text-slate-600 mb-2">预览:</p>
                                    <img
                                        src={settings.site_logo_url}
                                        alt="Logo Preview"
                                        className="h-8 w-8 object-contain"
                                        onError={(e) => { e.target.src = ''; e.target.alt = 'Logo加载失败'; }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* GitHub Link Toggle */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">显示 GitHub 仓库链接</h3>
                                    <p className="text-sm text-slate-500">在公开首页底部显示 GitHub 仓库链接</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('show_github_link', settings.show_github_link === false ? true : false)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.show_github_link !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.show_github_link !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Forgot Password Text */}
                    <div className="border-t border-slate-100 pt-6"></div>
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-100 rounded-lg">
                                <Key className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">忘记密码提示文本</h3>
                                <p className="text-sm text-slate-500">当邮箱验证未开启时显示</p>
                            </div>
                        </div>
                        <textarea
                            value={settings.forgot_password_text || ''}
                            onChange={e => updateSetting('forgot_password_text', e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            rows={3}
                            placeholder="请联系管理员重置密码"
                        />
                    </div>

                    {/* About Us Content */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <FileText className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">关于我们页面内容</h3>
                                <p className="text-sm text-slate-500">配置 /about 页面显示的内容</p>
                            </div>
                        </div>
                        <textarea
                            value={settings.about_us_content || ''}
                            onChange={e => updateSetting('about_us_content', e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[200px]"
                            rows={10}
                            placeholder="输入关于我们的内容..."
                        />
                    </div>

                    {/* Repository Information */}
                    <div className="border-t border-slate-100 pt-6"></div>
                    <div className="p-5 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm">
                                <svg className="w-8 h-8 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">VanceFeedback</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    开源的智能反馈和工单管理系统，基于 React + Express 构建，集成 AI 功能
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href="https://github.com/vancehuds/VanceFeedback"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors shadow-sm"
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
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors shadow-sm"
                                    >
                                        <AlertCircle size={16} />
                                        问题反馈
                                    </a>
                                    <a
                                        href="https://github.com/vancehuds/VanceFeedback#readme"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors shadow-sm"
                                    >
                                        <FileText size={16} />
                                        使用文档
                                    </a>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <p className="text-xs text-slate-500">
                                        💡 遇到问题？访问 GitHub 仓库提交 Issue 或查看文档获取帮助
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
