import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import api, { setPublicKey } from './api';
import { formatDate } from './utils/date';
import ErrorBoundary from './components/ErrorBoundary';
import Loading from './components/Loading';
import { shouldRedirectToMobile } from './utils/isMobile';

// Eagerly loaded pages (critical path)
import Home from './pages/Home';

// Lazy-loaded pages (code splitting)
const SetupWizard = React.lazy(() => import('./pages/SetupWizard'));
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AboutUs = React.lazy(() => import('./pages/AboutUs'));
const UserCenter = React.lazy(() => import('./pages/UserCenter'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const HumanVerification = React.lazy(() => import('./pages/HumanVerification'));
const KnowledgeBase = React.lazy(() => import('./pages/KnowledgeBase'));
const KnowledgeBaseArticle = React.lazy(() => import('./pages/KnowledgeBaseArticle'));

// Mobile pages (lazy)
const MobileLayout = React.lazy(() => import('./components/MobileLayout'));
const MobileHome = React.lazy(() => import('./pages/mobile/MobileHome'));
const MobileFeedback = React.lazy(() => import('./pages/mobile/MobileFeedback'));
const MobileProfile = React.lazy(() => import('./pages/mobile/MobileProfile'));
const MobileEditProfile = React.lazy(() => import('./pages/mobile/MobileEditProfile'));
const MobileChangePassword = React.lazy(() => import('./pages/mobile/MobileChangePassword'));
const MobileNotificationSettings = React.lazy(() => import('./pages/mobile/MobileNotificationSettings'));
const MobileLogin = React.lazy(() => import('./pages/mobile/MobileLogin'));
const MobileKnowledgeBase = React.lazy(() => import('./pages/mobile/MobileKnowledgeBase'));
const MobileKnowledgeBaseArticle = React.lazy(() => import('./pages/mobile/MobileKnowledgeBaseArticle'));

// Mobile Admin pages (lazy)
const MobileAdminLayout = React.lazy(() => import('./components/MobileAdminLayout'));
const MobileAdminTickets = React.lazy(() => import('./pages/mobile/admin/MobileAdminTickets'));
const MobileAdminReview = React.lazy(() => import('./pages/mobile/admin/MobileAdminReview'));
const MobileAdminData = React.lazy(() => import('./pages/mobile/admin/MobileAdminData'));
const MobileAdminUsers = React.lazy(() => import('./pages/mobile/admin/MobileAdminUsers'));
const MobileAdminMore = React.lazy(() => import('./pages/mobile/admin/MobileAdminMore'));
const MobileAdminSettings = React.lazy(() => import('./pages/mobile/admin/MobileAdminSettings'));
const MobileAdminAnnouncements = React.lazy(() => import('./pages/mobile/admin/MobileAdminAnnouncements'));
const MobileAdminAudit = React.lazy(() => import('./pages/mobile/admin/MobileAdminAudit'));
const MobileAdminQuestionTypes = React.lazy(() => import('./pages/mobile/admin/MobileAdminQuestionTypes'));
const MobileAdminKnowledgeBase = React.lazy(() => import('./pages/mobile/admin/MobileAdminKnowledgeBase'));

// Desktop Admin pages (lazy)
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'));
const AdminTickets = React.lazy(() => import('./pages/admin/AdminTickets'));
const AdminTicketReview = React.lazy(() => import('./pages/admin/AdminTicketReview'));
const AdminAnalysis = React.lazy(() => import('./pages/admin/AdminAnalysis'));
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminNotifications = React.lazy(() => import('./pages/admin/AdminNotifications'));
const AdminAudit = React.lazy(() => import('./pages/admin/AdminAudit'));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'));
const AdminQuestionTypes = React.lazy(() => import('./pages/admin/AdminQuestionTypes'));
const AdminEmailTemplates = React.lazy(() => import('./pages/admin/AdminEmailTemplates'));
const AdminAnnouncements = React.lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminKnowledgeBase = React.lazy(() => import('./pages/admin/AdminKnowledgeBase'));

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
            const res = await api.get('/status');

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

    if (status === 'setup') return <Suspense fallback={<Loading variant="fullscreen" />}><SetupWizard /></Suspense>;

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
                <Suspense fallback={<Loading variant="fullscreen" />}>
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
                                        <Route path="knowledge-base" element={<MobileKnowledgeBase />} />
                                        <Route path="knowledge-base/:slug" element={<MobileKnowledgeBaseArticle />} />
                                        <Route path="feedback" element={<MobileFeedback />} />
                                        <Route path="profile" element={<MobileProfile />} />
                                        <Route path="edit-profile" element={<MobileEditProfile />} />
                                        <Route path="change-password" element={<MobileChangePassword />} />
                                        <Route path="notifications" element={<MobileNotificationSettings />} />
                                        <Route path="login" element={<MobileLogin />} />
                                    </Route>
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
                </Suspense>
            </BrowserRouter>
        </ErrorBoundary>
    );
}
