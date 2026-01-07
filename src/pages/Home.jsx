import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { MessageSquare, CheckCircle, ArrowRight, Sparkles, Clock, AlertCircle, X, ChevronRight, Bell, Github, Book } from 'lucide-react';
import Loading from '../components/Loading';
import Skeleton from '../components/Skeleton';
import { formatDate, formatDateOnly } from '../utils/date';

// Reply Modal Component
function ReplyModal({ ticket, onClose, typeLabels, getStatusConfig }) {
    const statusConfig = getStatusConfig(ticket.status);
    const StatusIcon = statusConfig.icon;
    const replies = ticket.replies || [];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div
                className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-white/20 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="relative p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">反馈详情</h3>
                            <p className="text-white/70 text-sm">#{ticket.id} · {formatDate(ticket.created_at)}</p>
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                    {/* Original Feedback */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100">
                                {typeLabels[ticket.type] || ticket.type}
                            </span>
                            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                <StatusIcon size={14} />
                                {statusConfig.label}
                            </span>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                            <p className="text-slate-700 leading-relaxed">{ticket.content}</p>
                            {ticket.location && (
                                <p className="text-sm text-slate-500 mt-3 flex items-center gap-1">
                                    📍 {ticket.location}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Replies Section */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                            💬 回复记录 ({replies.length})
                        </h4>

                        {replies.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p>暂无回复</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {replies.map((reply, idx) => (
                                    <div
                                        key={reply.id}
                                        className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 animate-slide-up"
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                {reply.admin_name?.charAt(0) || 'A'}
                                            </div>
                                            <div>
                                                <span className="font-semibold text-emerald-700">{reply.admin_name}</span>
                                                <span className="text-xs text-slate-400 ml-2">
                                                    {formatDate(reply.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-slate-600 pl-11 leading-relaxed">{reply.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-4 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 font-medium rounded-xl transition-all"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Home() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [typeLabels, setTypeLabels] = useState({});
    const [announcements, setAnnouncements] = useState([]);
    const [welcomeMessage, setWelcomeMessage] = useState(''); // Initialize empty for Skeleton
    const [siteLogo, setSiteLogo] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [universityName, setUniversityName] = useState(''); // Initialize empty for Skeleton
    const [showGithubLink, setShowGithubLink] = useState(true); // Default to true
    const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(true);
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        // Load public settings (welcome message, logo, etc.)
        api.get('/settings/public').then(res => {
            if (res.data.welcome_message) {
                setWelcomeMessage(res.data.welcome_message);
            }
            // Prefer URL over base64 if both are set
            if (res.data.site_logo_url) {
                setSiteLogo(res.data.site_logo_url);
            } else if (res.data.site_logo) {
            } else if (res.data.site_logo) {
                setSiteLogo(res.data.site_logo);
            }
            if (res.data.university_name) {
                setUniversityName(res.data.university_name);
            }
            // Get GitHub link visibility setting
            if (res.data.show_github_link !== undefined) {
                setShowGithubLink(res.data.show_github_link);
            }
            if (res.data.knowledge_base_enabled !== undefined) {
                setKnowledgeBaseEnabled(res.data.knowledge_base_enabled !== false);
            }
        }).catch(err => {
            console.error('Failed to load settings:', err);
        });

        // Load active announcements
        api.get('/announcements/public').then(res => {
            setAnnouncements(res.data);
        }).catch(err => {
            console.error('Failed to load announcements:', err);
        });

        // Load question types
        api.get('/question-types').then(res => {
            const labels = {};
            res.data.forEach(t => {
                labels[t.type_key] = `${t.emoji} ${t.label}`;
            });
            setTypeLabels(labels);
        });

        fetchTickets(1);
    }, []);

    const fetchTickets = async (page) => {
        setLoading(true);
        try {
            const res = await api.get('/tickets', { params: { publicOnly: 'true', page, limit: 9 } });
            if (res.data.pagination) {
                setTickets(res.data.tickets);
                setPagination(res.data.pagination);
            } else {
                setTickets(res.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTickets(newPage);
            // Scroll to the top of the feedback section
            document.getElementById('feedback-section')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'resolved':
                return {
                    label: '已解决',
                    icon: CheckCircle,
                    className: 'badge-resolved'
                };
            case 'processing':
                return {
                    label: '处理中',
                    icon: Clock,
                    className: 'badge-processing'
                };
            default:
                return {
                    label: '待处理',
                    icon: AlertCircle,
                    className: 'badge-pending'
                };
        }
    };

    // Get latest 2 replies for display
    const getLatestReplies = (ticket) => {
        const replies = ticket.replies || [];
        return replies.slice(-2); // Get last 2 replies
    };

    const hasMoreReplies = (ticket) => {
        const replies = ticket.replies || [];
        return replies.length > 2;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="decorative-blob w-96 h-96 bg-indigo-200 -top-48 -left-48" />
                <div className="decorative-blob w-80 h-80 bg-purple-200 top-1/3 -right-40" style={{ animationDelay: '2s' }} />
                <div className="decorative-blob w-64 h-64 bg-pink-200 bottom-20 left-1/4" style={{ animationDelay: '4s' }} />
            </div>

            {/* Header with Glassmorphism */}
            <header className="glass-dark text-white shadow-2xl sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3 group cursor-pointer">
                        <div className="relative">
                            {siteLogo ? (
                                <img
                                    src={siteLogo}
                                    alt="Logo"
                                    className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-110"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display = 'block';
                                    }}
                                />
                            ) : null}
                            <img
                                src="/icon-192x192.png"
                                alt="VanceFeedback"
                                className={`h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-110 ${siteLogo ? 'hidden' : ''}`}
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                                {universityName || <Skeleton width={120} height={28} className="bg-white/20" />}
                            </h1>
                            <p className="text-xs text-blue-200">图书馆问题反馈中心</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                <span className="text-sm text-blue-200 hidden sm:inline">欢迎, {user.username}</span>
                                <Link
                                    to="/dashboard"
                                    className="btn-accent flex items-center gap-2 py-2 px-4"
                                >
                                    进入控制台
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 py-2 px-4"
                            >
                                登录 / 注册
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 relative z-10">
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl shadow-2xl mb-10 animate-fade-in">
                    {/* Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />

                    {/* Animated Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }} />
                    </div>

                    {/* Content */}
                    <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-white max-w-xl">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                                聆听读者的声音
                                <span className="inline-block ml-2 animate-bounce-soft">💬</span>
                            </h2>
                            <p className="text-blue-100 text-lg leading-relaxed">
                                {welcomeMessage || (
                                    <>
                                        <Skeleton width="100%" height={20} className="bg-white/20 mb-2" />
                                        <Skeleton width="80%" height={20} className="bg-white/20" />
                                    </>
                                )}
                            </p>
                        </div>
                        <Link
                            to={user ? "/dashboard/submit" : "/login"}
                            className="group relative bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-900 font-bold py-4 px-8 rounded-full shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 flex items-center gap-2"
                        >
                            <span className="relative z-10">立即反馈</span>
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                        </Link>
                    </div>

                    {/* Decorative Circles */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 animate-float" />
                    <div className="absolute -top-5 -left-5 w-20 h-20 rounded-full bg-white/10 animate-float" style={{ animationDelay: '1s' }} />
                </div>

                {/* Knowledge Base Quick Link */}
                {knowledgeBaseEnabled && (
                    <div className="mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <Link
                        to="/knowledge-base"
                        className="group block bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-6 border border-emerald-200 hover:border-emerald-300 shadow-sm hover:shadow-lg transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg">
                                    <Book className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">📚 知识库</h3>
                                    <p className="text-sm text-slate-500">常见问题解答 · FAQ · 帮助中心</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 font-medium">
                                <span className="hidden sm:inline">浏览全部</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                        </Link>
                    </div>
                )}

                {/* Announcements Section */}
                {announcements.length > 0 && (
                    <div className="mb-10 space-y-4">
                        {announcements.map((announcement, index) => (
                            <div
                                key={announcement.id}
                                className="stagger-item bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-xl p-6 border-l-4 border-orange-400 shadow-card animate-slide-up"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-orange-400 rounded-lg text-white">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-slate-800 mb-2">{announcement.title}</h3>
                                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                                        <p className="text-xs text-slate-400 mt-2">
                                            {formatDateOnly(announcement.created_at)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Feedback Section */}
                <div id="feedback-section" className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 animate-slide-up">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl text-white shadow-lg">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        最新公开反馈
                    </h3>
                </div>

                {loading ? (
                    <Loading variant="section" text="正在加载反馈..." />
                ) : tickets.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                        <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">暂无公开反馈</p>
                    </div>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {tickets.map((ticket, index) => {
                            const statusConfig = getStatusConfig(ticket.status);
                            const StatusIcon = statusConfig.icon;
                            const latestReplies = getLatestReplies(ticket);
                            const showMoreButton = hasMoreReplies(ticket);
                            const totalReplies = (ticket.replies || []).length;

                            return (
                                <div
                                    key={ticket.id}
                                    className="stagger-item bg-white rounded-xl shadow-card border border-slate-100 p-5 card-hover group"
                                    style={{ animationDelay: `${index * 0.08}s` }}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-sm font-semibold px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100">
                                            {typeLabels[ticket.type] || ticket.type}
                                        </span>
                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                            <StatusIcon size={12} />
                                            {statusConfig.label}
                                        </span>
                                    </div>

                                    <p className="text-slate-700 font-medium line-clamp-2 mb-4 leading-relaxed group-hover:text-slate-900 transition-colors">
                                        {ticket.content}
                                    </p>

                                    <div className="text-xs text-slate-400 flex flex-col gap-2 pt-3 border-t border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <span>{formatDateOnly(ticket.created_at)}</span>
                                            {totalReplies > 0 && (
                                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                    <CheckCircle size={12} />
                                                    {totalReplies} 条回复
                                                </span>
                                            )}
                                        </div>

                                        {/* Display latest 2 replies */}
                                        {latestReplies.length > 0 && (
                                            <div className="space-y-2">
                                                {latestReplies.map((reply) => (
                                                    <div
                                                        key={reply.id}
                                                        className="bg-gradient-to-r from-emerald-50 to-teal-50 p-3 rounded-lg border-l-3 border-emerald-400 text-slate-600"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-5 h-5 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                                {reply.admin_name?.charAt(0) || 'A'}
                                                            </div>
                                                            <span className="font-semibold text-emerald-700 text-xs">
                                                                {reply.admin_name}
                                                            </span>
                                                            <span className="text-xs text-slate-400">
                                                                {formatDateOnly(reply.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm line-clamp-2 pl-7">{reply.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* View Details Button - Always show */}
                                        <button
                                            onClick={() => setSelectedTicket(ticket)}
                                            className="mt-2 flex items-center justify-center gap-1 py-2 px-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-600 font-medium rounded-lg transition-all text-sm border border-indigo-100"
                                        >
                                            {showMoreButton ? `查看全部 ${totalReplies} 条回复` : '查看详情'}
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="flex justify-center mt-12 gap-2 animate-fade-in">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="px-5 py-2.5 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                        >
                            上一页
                        </button>
                        <span className="px-5 py-2.5 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 font-medium">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="px-5 py-2.5 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-16 py-8 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
                    <p className="mb-2">© {new Date().getFullYear()} {universityName} · 反馈系统</p>
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Link to="/about" className="text-slate-400 hover:text-indigo-500 transition-colors">关于我们</Link>
                        {showGithubLink && (
                            <>
                                <span className="text-slate-300">·</span>
                                <a
                                    href="https://github.com/vancehuds/VanceFeedback"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                    <Github size={16} />
                                    <span>GitHub</span>
                                </a>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-slate-400">
                        Powered by <a href="https://github.com/vancehuds/VanceFeedback" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 transition-colors font-medium">VanceFeedback</a>
                    </p>
                </div>
            </footer>

            {/* Reply Modal */}
            {selectedTicket && (
                <ReplyModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    typeLabels={typeLabels}
                    getStatusConfig={getStatusConfig}
                />
            )}
        </div>
    );
}
