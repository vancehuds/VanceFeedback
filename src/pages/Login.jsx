import React, { useState, useEffect, useRef } from 'react';
import 'altcha';
import { useNavigate, Link } from 'react-router-dom';
import api, { encryptPayload, setPublicKey } from '../api';
import { Lock, User, BookOpen, ArrowRight, Sparkles, Mail, Send, Hash, UserCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { isMobile } from '../utils/isMobile';
import Skeleton from '../components/Skeleton';
import Loading from '../components/Loading';

export default function Login() {
    const [isRegister, setIsRegister] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [settings, setSettings] = useState({});
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        emailCode: '',
        studentId: '',
        realName: '',
        nickname: ''
    });
    const [forgotData, setForgotData] = useState({
        email: '',
        code: '',
        newPassword: '',
        step: 'email' // 'email', 'code', 'success'
    });
    const [loading, setLoading] = useState(false);
    const [encryptionReady, setEncryptionReady] = useState(false);
    const [error, setError] = useState('');
    const [codeSending, setCodeSending] = useState(false);
    const [codeCountdown, setCodeCountdown] = useState(0);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileReady, setTurnstileReady] = useState(false);
    const [altchaPayload, setAltchaPayload] = useState('');

    const turnstileRef = useRef(null);
    const turnstileWidgetId = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Auto-redirect mobile users to mobile login page
        if (isMobile()) {
            navigate('/m/login', { replace: true });
        }

        fetchSettings();

        // Cleanup on unmount
        return () => {
            const script = document.getElementById('turnstile-script');
            if (script) {
                script.remove();
            }
            if (window.turnstile && turnstileWidgetId.current !== null) {
                try {
                    window.turnstile.remove(turnstileWidgetId.current);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        };
    }, []);

    useEffect(() => {
        if (settings.recaptcha_enabled && settings.recaptcha_site_key) {
            loadTurnstileScript();
        }
    }, [settings]);

    // Altcha event listener
    useEffect(() => {
        if (settings.recaptcha_enabled && settings.recaptcha_provider === 'altcha') {
            const handleStateChange = (ev) => {
                if (ev.detail.state === 'verified') {
                    setAltchaPayload(ev.detail.payload);
                    console.log('Altcha verified:', ev.detail.payload);
                    // Clear error if it was about captcha
                    if (error === '请完成人机验证') setError('');
                }
            };

            // We need to attach to document or find the element. 
            // Since the element might not be rendered yet, delegating or checking periodically is safer,
            // but for simplicity in React, we can try to find it after render.
            // However, custom events bubble, so we can listen on the specific widget if we can find it.
            // A better way in React is to use a ref on the custom element, but React < 19 doesn't handle custom element events well.
            // Standard approach: addEventListener in useEffect.

            const widget = document.querySelector('altcha-widget');
            if (widget) {
                widget.addEventListener('statechange', handleStateChange);
                return () => widget.removeEventListener('statechange', handleStateChange);
            }

            // Fallback: MutationObserver or just wait? 
            // The widget is rendered conditionally. Let's add a small timeout to attach the listener 
            // or rely on bubbling if we attach to a container. 
            // For now, let's try attaching to window or document for simplicity if allowed?
            // "statechange" bubbles: true (in altcha implementation).
            const container = document.getElementById('altcha-container');
            if (container) {
                container.addEventListener('statechange', handleStateChange);
                return () => container.removeEventListener('statechange', handleStateChange);
            }
        }
    }, [settings.recaptcha_provider, settings.recaptcha_enabled, error, isRegister]); // Re-bind if view changes

    useEffect(() => {
        if (codeCountdown > 0) {
            const timer = setTimeout(() => setCodeCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [codeCountdown]);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings/public');
            setSettings(res.data);
            if (res.data.publicKey) {
                setPublicKey(res.data.publicKey);
                setEncryptionReady(true);
                console.log('System ready: Encryption key loaded');
            } else {
                console.error('System warning: No public key received from server');
                setError('系统初始化失败：无法获取加密密钥');
            }
            if (res.data.university_name) {
                setSettings(prev => ({ ...prev, university_name: res.data.university_name }));
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
            setError('系统连接失败，请刷新重试');
        }
    };

    const loadTurnstileScript = () => {
        // ... (existing turnstile logic)
        // Check if script already exists
        if (document.getElementById('turnstile-script')) {
            // Script exists, check if turnstile is ready
            if (window.turnstile) {
                initTurnstile();
            }
            return;
        }

        const script = document.createElement('script');
        script.id = 'turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;

        script.onload = () => {
            console.log('Turnstile script loaded successfully');
            initTurnstile();
        };

        script.onerror = () => {
            console.error('Failed to load Turnstile script');
            setError('人机验证加载失败，请检查网络连接');
        };

        document.head.appendChild(script);
    };

    const initTurnstile = () => {
        if (!window.turnstile) {
            console.error('Turnstile not available');
            return;
        }

        console.log('Turnstile ready');
        setTurnstileReady(true);

        // Render Turnstile widget
        if (turnstileRef.current) {
            try {
                // Check if already rendered
                if (turnstileWidgetId.current !== null) {
                    window.turnstile.reset(turnstileWidgetId.current);
                } else {
                    turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
                        sitekey: settings.recaptcha_site_key,
                        callback: (token) => {
                            console.log('Turnstile token received');
                            setTurnstileToken(token);
                        },
                        'expired-callback': () => {
                            console.log('Turnstile token expired');
                            setTurnstileToken('');
                        },
                        'error-callback': () => {
                            console.error('Turnstile error');
                            setError('人机验证出错，请刷新页面重试');
                        }
                    });
                    console.log('Turnstile widget rendered');
                }
            } catch (err) {
                console.error('Failed to render Turnstile:', err);
                setError('人机验证初始化失败');
            }
        }
    };

    const getTurnstileToken = async () => {
        if (!settings.recaptcha_enabled) return '';

        if (!turnstileReady) {
            console.warn('Turnstile not ready yet');
            setError('人机验证未准备好，请稍后重试');
            return '';
        }

        // Return the token from state
        if (!turnstileToken) {
            setError('请完成人机验证');
            return '';
        }
        return turnstileToken;
    };

    const handleSendCode = async () => {
        if (!formData.email) {
            setError('请输入邮箱地址');
            return;
        }

        setCodeSending(true);
        setError('');

        try {
            let token = '';
            let altcha = '';

            if (settings.recaptcha_enabled) {
                if (settings.recaptcha_provider === 'altcha') {
                    if (!altchaPayload) {
                        setError('请完成人机验证');
                        setCodeSending(false);
                        return;
                    }
                    altcha = altchaPayload;
                } else {
                    token = await getTurnstileToken();
                    if (!token) {
                        setCodeSending(false);
                        return;
                    }
                }
            }

            await api.post('/verification/send-code', {
                email: formData.email,
                type: 'register',
                recaptchaToken: token,
                altcha: altcha
            });
            setCodeCountdown(60);
            setError('验证码已发送到您的邮箱');
        } catch (err) {
            setError(err.response?.data?.error || '发送失败');
        } finally {
            setCodeSending(false);
        }
    };

    const resetCaptcha = () => {
        if (settings.recaptcha_provider === 'altcha') {
            // Altcha doesn't have an imperative reset API easily accessible without ref
            // But re-mounting or reloading handles it. 
            // We can force a reload of the widget or just clear payload.
            setAltchaPayload('');
        } else {
            if (window.turnstile && turnstileWidgetId.current !== null) {
                try {
                    window.turnstile.reset(turnstileWidgetId.current);
                    setTurnstileToken('');
                    console.log('Turnstile reset successfully');
                } catch (e) {
                    console.error('Failed to reset Turnstile:', e);
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // If registering and email verification is enabled, we already verified captcha when sending code
            // So we don't need to verify again here
            let token = '';
            let altcha = '';
            const skipCaptcha = isRegister && settings.email_verification_enabled;

            if (!skipCaptcha) {
                if (settings.recaptcha_provider === 'altcha') {
                    if (!altchaPayload && settings.recaptcha_enabled) {
                        setError('请完成人机验证');
                        setLoading(false);
                        return;
                    }
                    altcha = altchaPayload;
                } else {
                    token = await getTurnstileToken();
                    if (!token && settings.recaptcha_enabled) {
                        // Error already set in getTurnstileToken
                        setLoading(false);
                        return;
                    }
                }
            }

            const payload = {
                ...formData
            };

            const encrypted = await encryptPayload(payload);
            if (!encrypted) throw new Error("Encryption init failed");

            const endpoint = isRegister ? '/auth/register' : '/auth/login';
            const res = await api.post(endpoint, {
                encryptedPayload: encrypted,
                recaptchaToken: token,
                altcha: altcha
            });

            if (isRegister) {
                setIsRegister(false);
                setError('注册成功，请登录');
                setFormData({ username: '', password: '', email: '', emailCode: '', studentId: '', realName: '', nickname: '' });
                resetCaptcha();
            } else {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            // Optionally reset captcha on error too, if desired, but user only asked for "after success, login page captcha not refreshing"
            if (settings.recaptcha_enabled && !isRegister) {
                resetCaptcha();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotSendCode = async () => {
        // ... (existing logic)
        if (!forgotData.email) {
            setError('请输入邮箱地址');
            return;
        }

        setCodeSending(true);
        setError('');

        try {
            const res = await api.post('/profile/forgot-password', { email: forgotData.email });
            if (res.data.customMessage) {
                setError(res.data.error);
            } else {
                setForgotData(prev => ({ ...prev, step: 'code' }));
                setCodeCountdown(60);
            }
        } catch (err) {
            if (err.response?.data?.customMessage) {
                setError(err.response.data.error);
            } else {
                setError(err.response?.data?.error || '发送失败');
            }
        } finally {
            setCodeSending(false);
        }
    };

    const handleResetPassword = async () => {
        if (!forgotData.code || !forgotData.newPassword) {
            setError('请填写完整信息');
            return;
        }
        if (forgotData.newPassword.length < 6) {
            setError('密码至少6位');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post('/profile/reset-password', {
                email: forgotData.email,
                code: forgotData.code,
                newPassword: forgotData.newPassword
            });
            setForgotData(prev => ({ ...prev, step: 'success' }));
        } catch (err) {
            setError(err.response?.data?.error || '重置失败');
        } finally {
            setLoading(false);
        }
    };

    const renderForgotPassword = () => {
        // ... (existing render logic)
        // 检查邮箱验证是否开启
        if (!settings.email_verification_enabled) {
            return (
                <div className="space-y-5">
                    <button
                        type="button"
                        onClick={() => { setIsForgotPassword(false); setError(''); }}
                        className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
                    >
                        <ArrowLeft size={16} /> 返回登录
                    </button>

                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">找回密码</h3>
                        <p className="text-slate-600 mb-6 whitespace-pre-wrap">
                            {settings.forgot_password_text || '请联系管理员重置密码'}
                        </p>
                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setError(''); }}
                            className="btn-primary px-8 py-3 rounded-xl"
                        >
                            返回登录
                        </button>
                    </div>
                </div>
            );
        }

        // 邮箱验证开启时，显示正常的找回密码流程
        return (
            <div className="space-y-5">
                <button
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setError(''); setForgotData({ email: '', code: '', newPassword: '', step: 'email' }); }}
                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
                >
                    <ArrowLeft size={16} /> 返回登录
                </button>

                {forgotData.step === 'email' && (
                    <>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700">邮箱地址</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800"
                                    placeholder="请输入注册时使用的邮箱"
                                    value={forgotData.email}
                                    onChange={e => setForgotData(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleForgotSendCode}
                            disabled={codeSending}
                            className="w-full btn-primary py-4 rounded-xl text-lg flex items-center justify-center gap-2"
                        >
                            {codeSending ? <Loading variant="inline" /> : <Send size={20} />}
                            发送验证码
                        </button>
                    </>
                )}

                {forgotData.step === 'code' && (
                    <>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700">验证码</label>
                            <input
                                type="text"
                                className="w-full py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl tracking-widest"
                                placeholder="000000"
                                maxLength={6}
                                value={forgotData.code}
                                onChange={e => setForgotData(prev => ({ ...prev, code: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700">新密码</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800"
                                    placeholder="请输入新密码（至少6位）"
                                    value={forgotData.newPassword}
                                    onChange={e => setForgotData(prev => ({ ...prev, newPassword: e.target.value }))}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={loading}
                            className="w-full btn-primary py-4 rounded-xl text-lg flex items-center justify-center gap-2"
                        >
                            {loading ? <Loading variant="inline" /> : <KeyRound size={20} />}
                            重置密码
                        </button>
                    </>
                )}

                {forgotData.step === 'success' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">密码重置成功</h3>
                        <p className="text-slate-500 mb-6">您现在可以使用新密码登录</p>
                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setForgotData({ email: '', code: '', newPassword: '', step: 'email' }); }}
                            className="btn-primary px-8 py-3 rounded-xl"
                        >
                            返回登录
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 gradient-animate" />

            {/* Overlay for better contrast */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

            {/* Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="decorative-blob w-96 h-96 bg-white/20 -top-48 -left-48" />
                <div className="decorative-blob w-80 h-80 bg-white/15 top-1/3 -right-40" style={{ animationDelay: '2s' }} />
                <div className="decorative-blob w-64 h-64 bg-white/10 bottom-20 left-1/4" style={{ animationDelay: '4s' }} />
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md animate-slide-up">
                {/* Card with Glass Effect */}
                <div className="glass rounded-3xl shadow-2xl p-8 border border-white/30">
                    {/* Logo Section */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4">
                            <BookOpen className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            {isForgotPassword ? '找回密码' : isRegister ? '创建账号' : '欢迎回来'}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1 flex items-center justify-center gap-1">
                            {settings.university_name ? `${settings.university_name}反馈系统` : <Skeleton width={120} height={16} />}
                        </p>
                    </div>

                    {/* Error/Success Message */}
                    {error && (
                        <div className={`p-4 rounded-xl text-sm mb-6 flex items-center gap-2 animate-fade-in ${error.includes('成功') || error.includes('已发送')
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-red-50 text-red-600 border border-red-100'
                            }`}>
                            {error.includes('成功') || error.includes('已发送') ? (
                                <Sparkles className="w-4 h-4 flex-shrink-0" />
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                            {error}
                        </div>
                    )}

                    {isForgotPassword ? (
                        renderForgotPassword()
                    ) : (
                        <>
                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        {settings.email_verification_enabled ? '用户名 / 邮箱' : '用户名'}
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                                        <input
                                            type="text"
                                            required
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800 placeholder-slate-400"
                                            placeholder={settings.email_verification_enabled ? "请输入用户名或邮箱" : "请输入用户名"}
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        密码
                                    </label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                                        <input
                                            type="password"
                                            required
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800 placeholder-slate-400"
                                            placeholder="请输入密码"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Registration extra fields */}
                                {isRegister && (
                                    <>
                                        {settings.email_verification_enabled && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-slate-700">邮箱</label>
                                                    <div className="flex gap-2">
                                                        <div className="relative group flex-1">
                                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                            <input
                                                                type="email"
                                                                required
                                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800"
                                                                placeholder="请输入邮箱"
                                                                value={formData.email}
                                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleSendCode}
                                                            disabled={codeSending || codeCountdown > 0}
                                                            className="btn-secondary px-4 py-3 flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                                                        >
                                                            {codeSending ? (
                                                                <Loading variant="inline" />
                                                            ) : codeCountdown > 0 ? (
                                                                `${codeCountdown}s`
                                                            ) : (
                                                                <>
                                                                    <Send size={16} />
                                                                    发送
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-slate-700">邮箱验证码</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        className="w-full py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl tracking-widest"
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        value={formData.emailCode}
                                                        onChange={e => setFormData({ ...formData, emailCode: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {settings.student_info_enabled && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-slate-700">学号</label>
                                                    <div className="relative group">
                                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            required
                                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800"
                                                            placeholder="请输入学号"
                                                            value={formData.studentId}
                                                            onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-slate-700">姓名</label>
                                                    <div className="relative group">
                                                        <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            required
                                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl input-focus text-slate-800"
                                                            placeholder="请输入真实姓名"
                                                            value={formData.realName}
                                                            onChange={e => setFormData({ ...formData, realName: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Turnstile/Altcha container */}
                                {settings.recaptcha_enabled && (
                                    <div className="flex justify-center w-full" id="altcha-container" style={{
                                        '--altcha-color-base': '#ffffff',
                                        '--altcha-color-border': '#e2e8f0',
                                        '--altcha-color-text': '#1e293b',
                                        '--altcha-border-radius': '0.75rem',
                                        '--altcha-color-primary': '#6366f1',
                                        '--altcha-max-width': '100%',
                                    }}>
                                        {settings.recaptcha_provider === 'altcha' ? (
                                            <altcha-widget
                                                challengeurl={`${api.defaults.baseURL}/captcha/challenge`}
                                                hidelogo
                                                hidefooter
                                                strings='{"label": "人机验证", "verifying": "正在验证...", "verified": "验证通过", "error": "验证出错"}'
                                                className="w-full"
                                            ></altcha-widget>
                                        ) : (
                                            <div ref={turnstileRef}></div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !encryptionReady}
                                    className="w-full btn-primary py-4 rounded-xl text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loading variant="inline" text="处理中..." />
                                    ) : !encryptionReady ? (
                                        <Loading variant="inline" text="系统初始化中..." />
                                    ) : (
                                        <>
                                            {isRegister ? '立即注册' : '登录'}
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-white text-slate-400">或</span>
                                </div>
                            </div>

                            {/* Switch Mode & Forgot Password */}
                            <div className="text-center space-y-3">
                                <button
                                    onClick={() => { setIsRegister(!isRegister); setError(''); }}
                                    className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors hover:underline underline-offset-4"
                                >
                                    {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
                                </button>
                                {!isRegister && (
                                    <div>
                                        <button
                                            onClick={() => { setIsForgotPassword(true); setError(''); }}
                                            className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
                                        >
                                            忘记密码？
                                        </button>
                                    </div>
                                )}
                                <div>
                                    <Link
                                        to="/"
                                        className="text-slate-400 hover:text-slate-600 text-sm transition-colors inline-flex items-center gap-1"
                                    >
                                        ← 返回首页
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Bottom Glow Effect */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-r from-indigo-500/20 via-purple-500/30 to-pink-500/20 blur-2xl rounded-full" />
            </div>
        </div>
    );
}
