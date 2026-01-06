import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { Book, Search, FolderOpen, Eye, ChevronRight, Sparkles, MessageSquarePlus, Send, Bot, AlertCircle, X } from 'lucide-react';
import Loading from '../../components/Loading';

export default function MobileKnowledgeBase() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    // AI Q&A State
    const [aiQaEnabled, setAiQaEnabled] = useState(false);
    const [showAiChat, setShowAiChat] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiAnswer, setAiAnswer] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiStatus, setAiStatus] = useState({ remaining: 0, dailyLimit: 10, banned: false });

    useEffect(() => {
        fetchCategories();
        checkAiQaStatus();
    }, []);

    useEffect(() => {
        fetchArticles();
    }, [activeCategory, searchParams]);

    // Check AI Q&A feature status
    const checkAiQaStatus = async () => {
        try {
            // First check public settings
            const publicRes = await api.get('/settings/public');
            if (publicRes.data.knowledge_base_enabled === false) {
                navigate('/m');
                return;
            }

            if (!publicRes.data.ai_qa_enabled) {
                setAiQaEnabled(false);
                return;
            }
            setAiQaEnabled(true);

            // Then check user's rate limit status (requires auth)
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const statusRes = await api.get('/ai-qa/status');
                    setAiStatus({
                        remaining: statusRes.data.remaining || 0,
                        dailyLimit: statusRes.data.dailyLimit || 10,
                        banned: statusRes.data.banned || false
                    });
                } catch (err) {
                    // User not logged in or error - still show as enabled
                }
            }
        } catch (err) {
            console.error('Failed to check AI Q&A status:', err);
        }
    };

    // Submit AI question
    const handleAiAsk = async (e) => {
        e.preventDefault();
        if (!aiQuestion.trim() || aiLoading) return;

        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (!token) {
            setAiError('请先登录后使用 AI 问答功能');
            return;
        }

        setAiLoading(true);
        setAiError('');
        setAiAnswer('');

        try {
            const res = await api.post('/ai-qa/ask', { question: aiQuestion });
            setAiAnswer(res.data.answer);
            setAiStatus(prev => ({
                ...prev,
                remaining: res.data.remaining
            }));
            setAiQuestion('');
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'AI 问答失败，请稍后再试';
            setAiError(errorMsg);
        } finally {
            setAiLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/knowledge-base/categories');
            setCategories(res.data);
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

    const fetchArticles = async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 10 };
            if (activeCategory) params.category = activeCategory;
            if (searchQuery) params.search = searchQuery;

            const res = await api.get('/knowledge-base/articles', { params });
            setArticles(res.data.articles);
            setPagination(res.data.pagination);
        } catch (err) {
            console.error('Failed to load articles:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const newParams = new URLSearchParams();
        if (searchQuery) newParams.set('search', searchQuery);
        if (activeCategory) newParams.set('category', activeCategory);
        setSearchParams(newParams);
        fetchArticles(1);
    };

    const handleCategoryClick = (categorySlug) => {
        const newCategory = activeCategory === categorySlug ? '' : categorySlug;
        setActiveCategory(newCategory);
        const newParams = new URLSearchParams();
        if (newCategory) newParams.set('category', newCategory);
        if (searchQuery) newParams.set('search', searchQuery);
        setSearchParams(newParams);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchArticles(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="mobile-page">
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 pb-6 pt-4 px-4 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <Book size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">📚 知识库</h1>
                            <p className="text-sm text-white/80">FAQ · 帮助中心</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜索常见问题..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-20 py-3.5 rounded-2xl bg-white/95 backdrop-blur-sm border-0 shadow-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-white/50 focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-shadow"
                        >
                            搜索
                        </button>
                    </form>
                </div>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
                <div className="px-4 py-3 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={() => handleCategoryClick('')}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!activeCategory
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                                }`}
                        >
                            全部
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.slug)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${activeCategory === cat.slug
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                    }`}
                            >
                                <span>{cat.icon}</span>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Articles List */}
            <div className="px-4 py-4">
                {loading ? (
                    <Loading variant="section" text="加载中..." />
                ) : articles.length === 0 ? (
                    <div className="text-center py-12">
                        <Book className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 mb-4">暂无相关文章</p>
                        <Link
                            to="/m/feedback"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium"
                        >
                            <MessageSquarePlus size={16} />
                            提交反馈
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {articles.map((article) => (
                            <Link
                                key={article.id}
                                to={`/m/knowledge-base/${article.slug}`}
                                className="block bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                <span>{article.category_icon || '📄'}</span>
                                                {article.category_name || '未分类'}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-slate-800 mb-1 line-clamp-2">
                                            {article.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 line-clamp-2">
                                            {article.excerpt}...
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Eye size={12} />
                                                {article.views}
                                            </span>
                                            <span>{new Date(article.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-300 flex-shrink-0 mt-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="flex justify-center mt-6 gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-4 py-2 text-sm text-slate-600">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </div>

            {/* AI Q&A Section */}
            {aiQaEnabled && (
                <div className="px-4 pb-4">
                    {/* Collapsed Button */}
                    {!showAiChat && (
                        <button
                            onClick={() => setShowAiChat(true)}
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg hover:shadow-xl transition-shadow"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Bot size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">🤖 AI 智能问答</div>
                                    <div className="text-xs text-white/80">基于知识库内容快速获取答案</div>
                                </div>
                            </div>
                            <Sparkles size={20} />
                        </button>
                    )}

                    {/* Expanded Chat Panel */}
                    {showAiChat && (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bot size={20} />
                                    <span className="font-semibold">AI 智能问答</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">
                                        剩余 {aiStatus.remaining}/{aiStatus.dailyLimit} 次
                                    </span>
                                    <button onClick={() => setShowAiChat(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Chat Content */}
                            <div className="p-4 space-y-4">
                                {/* Banned Warning */}
                                {aiStatus.banned && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                                        <AlertCircle size={16} />
                                        您已被禁止使用 AI 功能
                                    </div>
                                )}

                                {/* Answer Display */}
                                {aiAnswer && (
                                    <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                                        <div className="flex items-start gap-2 mb-2">
                                            <Bot size={16} className="text-purple-500 mt-0.5" />
                                            <span className="text-xs font-medium text-purple-600">AI 回答</span>
                                        </div>
                                        <p className="text-slate-700 text-sm leading-relaxed">{aiAnswer}</p>
                                    </div>
                                )}

                                {/* Error Display */}
                                {aiError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                                        <AlertCircle size={16} />
                                        {aiError}
                                    </div>
                                )}

                                {/* Loading */}
                                {aiLoading && (
                                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-3">
                                        <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                                        <span className="text-sm text-slate-600">AI 正在思考中...</span>
                                    </div>
                                )}

                                {/* Input Form */}
                                {!aiStatus.banned && (
                                    <form onSubmit={handleAiAsk} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={aiQuestion}
                                            onChange={(e) => setAiQuestion(e.target.value)}
                                            placeholder="输入您的问题..."
                                            disabled={aiLoading || aiStatus.remaining <= 0}
                                            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!aiQuestion.trim() || aiLoading || aiStatus.remaining <= 0}
                                            className="px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </form>
                                )}

                                {/* Rate Limit Warning */}
                                {aiStatus.remaining <= 0 && !aiStatus.banned && (
                                    <p className="text-center text-xs text-slate-500">
                                        今日问答次数已用完，明天再来吧~
                                    </p>
                                )}

                                {/* Tips */}
                                <p className="text-xs text-slate-400 text-center">
                                    AI 仅根据知识库内容回答，答案仅供参考
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CTA */}
            <div className="px-4 pb-8">
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-4 text-center border border-slate-200">
                    <p className="text-sm text-slate-600 mb-3">没有找到答案？</p>
                    <Link
                        to="/m/feedback"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium"
                    >
                        <MessageSquarePlus size={16} />
                        提交反馈
                    </Link>
                </div>
            </div>
        </div>
    );
}
