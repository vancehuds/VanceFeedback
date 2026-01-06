import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { MessageSquare, CheckCircle, Clock, AlertCircle, Bell, ArrowRight, Sparkles, X, MapPin, Phone, Github } from 'lucide-react';
import Loading from '../../components/Loading';
import Skeleton from '../../components/Skeleton';
import { formatDate, formatDateOnly } from '../../utils/date';

export default function MobileHome() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeLabels, setTypeLabels] = useState({});
    const [announcements, setAnnouncements] = useState([]);
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [universityName, setUniversityName] = useState('');
    const [siteLogo, setSiteLogo] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showGithubLink, setShowGithubLink] = useState(true); // Default to true
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        // Load public settings
        api.get('/settings/public').then(res => {
            if (res.data.welcome_message) setWelcomeMessage(res.data.welcome_message);
            if (res.data.university_name) setUniversityName(res.data.university_name);
            if (res.data.site_logo_url) setSiteLogo(res.data.site_logo_url);
            else if (res.data.site_logo) setSiteLogo(res.data.site_logo);
            // Get GitHub link visibility setting
            if (res.data.show_github_link !== undefined) {
                setShowGithubLink(res.data.show_github_link);
            }
        }).catch(console.error);

        // Load announcements
        api.get('/announcements/public').then(res => {
            setAnnouncements(res.data);
        }).catch(console.error);

        // Load question types
        api.get('/question-types').then(res => {
            const labels = {};
            res.data.forEach(t => {
                labels[t.type_key] = { text: t.label, emoji: t.emoji };
            });
            setTypeLabels(labels);
        });

        // Load public tickets
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await api.get('/tickets', { params: { publicOnly: 'true', limit: 10 } });
            if (res.data.pagination) {
                setTickets(res.data.tickets);
            } else {
                setTickets(res.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'resolved':
                return { label: '已解决', icon: CheckCircle, className: 'badge-resolved' };
            case 'processing':
                return { label: '处理中', icon: Clock, className: 'badge-processing' };
            default:
                return { label: '待处理', icon: AlertCircle, className: 'badge-pending' };
        }
    };

    const handleTicketClick = (ticket) => {
        setSelectedTicket(ticket);
    };

    const closeModal = () => {
        setSelectedTicket(null);
    };

    return (
        <div className="mobile-page">
            {/* Header */}
            <header className="mobile-header">
                <div className="flex items-center gap-3">
                    <div className="mobile-logo">
                        {siteLogo ? (
                            <img src={siteLogo} alt="Logo" className="w-10 h-10 object-contain" />
                        ) : (
                            <img src="/icon-192x192.png" alt="Logo" className="w-10 h-10 object-contain" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">
                            {universityName || <Skeleton width={100} height={20} />}
                        </h1>
                        <p className="text-xs text-slate-500">反馈系统</p>
                    </div>
                </div>
                {user ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {user.username?.charAt(0)?.toUpperCase()}
                        </div>
                    </div>
                ) : (
                    <Link to="/m/login" className="text-sm font-medium text-indigo-600">
                        登录
                    </Link>
                )}
            </header>

            {/* Hero Section */}
            <div className="mobile-hero">
                <div className="mobile-hero-content">
                    <h2 className="text-xl font-bold text-white mb-2">
                        聆听读者的声音 💬
                    </h2>
                    <p className="text-sm text-white/80 mb-4 line-clamp-2">
                        {welcomeMessage || '欢迎使用反馈系统，您的意见是我们进步的动力'}
                    </p>
                    <Link
                        to={user ? "/m/feedback" : "/m/login"}
                        className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-medium py-2.5 px-5 rounded-full border border-white/30 hover:bg-white/30 transition-all"
                    >
                        <Sparkles size={16} />
                        立即反馈
                        <ArrowRight size={16} />
                    </Link>
                </div>
                <div className="mobile-hero-decoration" />
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
                <div className="px-4 mb-4">
                    {announcements.slice(0, 2).map((ann) => (
                        <div key={ann.id} className="mobile-announcement">
                            <div className="flex items-start gap-2">
                                <Bell size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-800 text-sm truncate">{ann.title}</h3>
                                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{ann.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Feedback Section */}
            <div className="px-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare size={18} className="text-indigo-500" />
                        最新公开反馈
                    </h3>
                </div>

                {loading ? (
                    <Loading variant="section" text="加载中..." />
                ) : tickets.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <MessageSquare size={40} className="mx-auto mb-2 opacity-50" />
                        <p>暂无公开反馈</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tickets.map((ticket) => {
                            const statusConfig = getStatusConfig(ticket.status);
                            const StatusIcon = statusConfig.icon;
                            const typeInfo = typeLabels[ticket.type] || { text: ticket.type, emoji: '📝' };
                            const replies = ticket.replies || [];

                            return (
                                <div
                                    key={ticket.id}
                                    className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
                                    onClick={() => handleTicketClick(ticket)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-50 text-indigo-600">
                                            {typeInfo.emoji} {typeInfo.text}
                                        </span>
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                            <StatusIcon size={10} />
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 line-clamp-2 mb-2">
                                        {ticket.content}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>{formatDateOnly(ticket.created_at)}</span>
                                        {replies.length > 0 && (
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle size={10} />
                                                {replies.length} 条回复
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="mobile-modal-overlay" onClick={closeModal}>
                    <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="mobile-modal-header">
                            <h2 className="text-lg font-bold text-slate-800">反馈详情</h2>
                            <button onClick={closeModal} className="mobile-modal-close">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="mobile-modal-content">
                            {/* Status & Type */}
                            <div className="flex items-center gap-2 mb-4">
                                {(() => {
                                    const typeInfo = typeLabels[selectedTicket.type] || { text: selectedTicket.type, emoji: '📝' };
                                    const statusConfig = getStatusConfig(selectedTicket.status);
                                    const StatusIcon = statusConfig.icon;
                                    return (
                                        <>
                                            <span className="text-sm font-medium px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600">
                                                {typeInfo.emoji} {typeInfo.text}
                                            </span>
                                            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                                <StatusIcon size={12} />
                                                {statusConfig.label}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Content */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-4">
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {selectedTicket.content}
                                </p>
                            </div>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                                <span>📅 {formatDate(selectedTicket.created_at)}</span>
                                {selectedTicket.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} /> {selectedTicket.location}
                                    </span>
                                )}
                            </div>

                            {/* Replies */}
                            {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        💬 管理员回复 ({selectedTicket.replies.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {selectedTicket.replies.map(reply => (
                                            <div
                                                key={reply.id}
                                                className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border-l-4 border-indigo-400"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                        {reply.admin_name?.charAt(0) || 'A'}
                                                    </div>
                                                    <span className="text-sm font-medium text-indigo-700">{reply.admin_name}</span>
                                                    <span className="text-xs text-slate-400">{formatDate(reply.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 pl-8 whitespace-pre-wrap">{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No replies */}
                            {(!selectedTicket.replies || selectedTicket.replies.length === 0) && (
                                <div className="border-t border-slate-100 pt-4 text-center py-6">
                                    <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-400">暂无回复</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="mt-12 pb-6 px-4">
                <div className="text-center text-xs text-slate-400 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <Link to="/about" className="hover:text-indigo-500 transition-colors">关于我们</Link>
                        {showGithubLink && (
                            <>
                                <span>·</span>
                                <a
                                    href="https://github.com/vancehuds/VanceFeedback"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
                                >
                                    <Github size={12} />
                                    <span>GitHub</span>
                                </a>
                            </>
                        )}
                    </div>
                    <p>
                        Powered by <a href="https://github.com/vancehuds/VanceFeedback" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 transition-colors font-medium">VanceFeedback</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
