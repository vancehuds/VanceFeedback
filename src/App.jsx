import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import api, { setPublicKey } from './api';
import { formatDate } from './utils/date';
import ErrorBoundary from './components/ErrorBoundary';
import Loading from './components/Loading';
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import AboutUs from './pages/AboutUs';
import UserCenter from './pages/UserCenter';
import NotFound from './pages/NotFound';
import MobileLayout from './components/MobileLayout';
import MobileHome from './pages/mobile/MobileHome';
import MobileFeedback from './pages/mobile/MobileFeedback';
import MobileProfile from './pages/mobile/MobileProfile';
import MobileEditProfile from './pages/mobile/MobileEditProfile';
import MobileChangePassword from './pages/mobile/MobileChangePassword';
import MobileNotificationSettings from './pages/mobile/MobileNotificationSettings';
import MobileLogin from './pages/mobile/MobileLogin';
import MobileAdminLayout from './components/MobileAdminLayout';
import MobileAdminTickets from './pages/mobile/admin/MobileAdminTickets';
import MobileAdminReview from './pages/mobile/admin/MobileAdminReview';
import MobileAdminData from './pages/mobile/admin/MobileAdminData';
import MobileAdminUsers from './pages/mobile/admin/MobileAdminUsers';
import MobileAdminMore from './pages/mobile/admin/MobileAdminMore';
import MobileAdminSettings from './pages/mobile/admin/MobileAdminSettings';
import MobileAdminAnnouncements from './pages/mobile/admin/MobileAdminAnnouncements';
import MobileAdminAudit from './pages/mobile/admin/MobileAdminAudit';
import MobileAdminQuestionTypes from './pages/mobile/admin/MobileAdminQuestionTypes';
import MobileAdminKnowledgeBase from './pages/mobile/admin/MobileAdminKnowledgeBase';
import MobileKnowledgeBase from './pages/mobile/MobileKnowledgeBase';
import MobileKnowledgeBaseArticle from './pages/mobile/MobileKnowledgeBaseArticle';
import { shouldRedirectToMobile } from './utils/isMobile';

// Desktop Admin Panel Imports
import AdminLayout from './components/admin/AdminLayout';
import AdminTickets from './pages/admin/AdminTickets';
import AdminTicketReview from './pages/admin/AdminTicketReview';
import AdminAnalysis from './pages/admin/AdminAnalysis';
import AdminUsers from './pages/admin/AdminUsers';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminAudit from './pages/admin/AdminAudit';
import AdminSettings from './pages/admin/AdminSettings';
import AdminQuestionTypes from './pages/admin/AdminQuestionTypes';
import AdminEmailTemplates from './pages/admin/AdminEmailTemplates';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminKnowledgeBase from './pages/admin/AdminKnowledgeBase';
import HumanVerification from './pages/HumanVerification';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeBaseArticle from './pages/KnowledgeBaseArticle';

function AppGuard({ children }) {
    const [status, setStatus] = useState('loading'); // loading, configured, setup
    const [error, setError] = useState(null);
    const [errorDetails, setErrorDetails] = useState(null);
    const navigate = useNavigate();

    const checkStatus = async () => {
        setStatus('loading');
        setError(null);
        setErrorDetails(null);
        try {
            console.log('[App] Checking API status...');
            console.log('[App] API Base URL:', import.meta.env.VITE_API_BASE_URL || '/api');

            const res = await api.get('/status');

            console.log('[App] API Status Response:', res.data);

            if (res.data.publicKey) {
                setPublicKey(res.data.publicKey);
            }

            // Set document title
            if (res.data.university_name) {
                document.title = `${res.data.university_name} - 反馈系统`;
            } else {
                document.title = '反馈系统';
            }

            if (res.data.configured) {
                setStatus('configured');
            } else {
                setStatus('setup');
                navigate('/setup');
            }
        } catch (err) {
            console.error("[App] Failed to check status:", err);

            // 构建详细的错误信息
            let errorMsg = "系统连接失败";
            let details = {
                message: err.message,
                apiUrl: import.meta.env.VITE_API_BASE_URL || '/api',
                timestamp: formatDate(new Date())
            };

            if (err.response) {
                // 服务器响应了错误
                errorMsg += `：服务器返回 ${err.response.status}`;
                details.status = err.response.status;
                details.statusText = err.response.statusText;
                details.responseData = err.response.data;
            } else if (err.request) {
                // 请求已发送但没有收到响应
                errorMsg += "：无法连接到后端服务";
                details.type = 'NO_RESPONSE';
                details.hint = '请检查：\n1. 后端服务是否启动\n2. API 地址是否正确\n3. 网络连接是否正常';
            } else {
                // 请求配置出错
                errorMsg += `：${err.message}`;
                details.type = 'REQUEST_SETUP_ERROR';
            }

            setError(errorMsg);
            setErrorDetails(details);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
                <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6">
                        <h1 className="text-2xl font-bold text-white">系统连接失败</h1>
                        <p className="text-red-100 mt-1">无法连接到后端服务</p>
                    </div>

                    {/* Error Content */}
                    <div className="p-6 space-y-4">
                        {/* Error Message */}
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                            <p className="text-red-900 font-medium">{error}</p>
                        </div>

                        {/* Error Details */}
                        {errorDetails && (
                            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                <h3 className="font-semibold text-slate-900 mb-2">详细信息：</h3>
                                <div className="text-sm text-slate-700 space-y-1 font-mono">
                                    <div><span className="font-semibold">API 地址:</span> {errorDetails.apiUrl}</div>
                                    <div><span className="font-semibold">错误类型:</span> {errorDetails.type || errorDetails.message}</div>
                                    {errorDetails.status && (
                                        <div><span className="font-semibold">状态码:</span> {errorDetails.status}</div>
                                    )}
                                    <div><span className="font-semibold">时间:</span> {errorDetails.timestamp}</div>
                                </div>
                                {errorDetails.hint && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-900 whitespace-pre-line">
                                        {errorDetails.hint}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Troubleshooting */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-900 mb-2">💡 解决方法：</h3>
                            <ul className="space-y-1 text-sm text-blue-800">
                                <li>• 确认后端服务正在运行</li>
                                <li>• 检查 API 地址配置是否正确</li>
                                <li>• 检查网络连接</li>
                                <li>• 查看浏览器控制台获取更多信息（F12）</li>
                            </ul>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={checkStatus}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg"
                            >
                                重试连接
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-white text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-all border-2 border-slate-200"
                            >
                                刷新页面
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'loading') {
        return <Loading variant="fullscreen" text="正在连接后端服务..." />;
    }

    if (status === 'setup') return <SetupWizard />;

    return children;
}

// Auto-redirect to mobile routes for mobile users
function MobileRedirect({ children }) {
    const navigate = useNavigate();

    React.useEffect(() => {
        if (shouldRedirectToMobile()) {
            navigate('/m', { replace: true });
        }
    }, [navigate]);

    return children;
}

export default function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <Analytics />
                <SpeedInsights />
                <Routes>
                    <Route path="/setup" element={<SetupWizard />} />
                    <Route path="/*" element={
                        <AppGuard>
                            <Routes>
                                <Route path="/" element={<MobileRedirect><Home /></MobileRedirect>} />
                                <Route path="/about" element={<AboutUs />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/dashboard/*" element={<Dashboard />} />
                                <Route path="/user-center" element={<UserCenter />} />
                                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                                <Route path="/knowledge-base/:slug" element={<KnowledgeBaseArticle />} />
                                {/* Mobile Routes */}
                                <Route path="/m" element={<MobileLayout />}>
                                    <Route index element={<MobileHome />} />
                                    <Route path="feedback" element={<MobileFeedback />} />
                                    <Route path="profile" element={<MobileProfile />} />
                                    <Route path="edit-profile" element={<MobileEditProfile />} />
                                    <Route path="change-password" element={<MobileChangePassword />} />
                                    <Route path="notifications" element={<MobileNotificationSettings />} />
                                    <Route path="login" element={<MobileLogin />} />
                                </Route>
                                {/* Mobile KB Routes (outside MobileLayout for custom headers) */}
                                <Route path="/m/knowledge-base" element={<MobileKnowledgeBase />} />
                                <Route path="/m/knowledge-base/:slug" element={<MobileKnowledgeBaseArticle />} />
                                {/* Desktop Admin Routes */}
                                <Route path="/admin" element={<AdminLayout />}>
                                    <Route index element={<AdminTickets />} />
                                    <Route path="tickets" element={<AdminTickets />} />
                                    <Route path="review" element={<AdminTicketReview />} />
                                    <Route path="analysis" element={<AdminAnalysis />} />
                                    <Route path="users" element={<AdminUsers />} />
                                    <Route path="notifications" element={<AdminNotifications />} />
                                    <Route path="audit" element={<AdminAudit />} />
                                    <Route path="settings" element={<AdminSettings />} />
                                    <Route path="question-types" element={<AdminQuestionTypes />} />
                                    <Route path="email-templates" element={<AdminEmailTemplates />} />
                                    <Route path="announcements" element={<AdminAnnouncements />} />
                                    <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
                                </Route>
                                {/* Mobile Admin Routes */}
                                <Route path="/m/admin" element={<MobileAdminLayout />}>
                                    <Route index element={<MobileAdminTickets />} />
                                    <Route path="review" element={<MobileAdminReview />} />
                                    <Route path="data" element={<MobileAdminData />} />
                                    <Route path="users" element={<MobileAdminUsers />} />
                                    <Route path="more" element={<MobileAdminMore />} />
                                    <Route path="settings" element={<MobileAdminSettings />} />
                                    <Route path="announcements" element={<MobileAdminAnnouncements />} />
                                    <Route path="audit" element={<MobileAdminAudit />} />
                                    <Route path="question-types" element={<MobileAdminQuestionTypes />} />
                                    <Route path="knowledge-base" element={<MobileAdminKnowledgeBase />} />
                                </Route>
                                <Route path="*" element={<NotFound />} />
                                <Route path="/verify-human" element={<HumanVerification />} />
                            </Routes>
                        </AppGuard>
                    } />
                </Routes>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

