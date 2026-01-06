import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { Book, Search, FolderOpen, Eye, ArrowRight, ChevronRight, Home, MessageSquarePlus, Bot, Send, Sparkles, X, AlertCircle } from 'lucide-react';
import Loading from '../components/Loading';

export default function KnowledgeBase() {
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
            const publicRes = await api.get('/settings/public');
            if (!publicRes.data.ai_qa_enabled) {
                setAiQaEnabled(false);
                return;
            }
            setAiQaEnabled(true);

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
                    // User not logged in
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
            setAiStatus(prev => ({ ...prev, remaining: res.data.remaining }));
            setAiQuestion('');
        } catch (err) {
            setAiError(err.response?.data?.error || 'AI 问答失败');
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
            const params = { page, limit: 12 };
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Decorative Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="decorative-blob w-96 h-96 bg-emerald-200 -top-48 -left-48" />
                <div className="decorative-blob w-80 h-80 bg-teal-200 top-1/3 -right-40" style={{ animationDelay: '2s' }} />
            </div>

            {/* Header */}
            <header className="glass-dark text-white shadow-2xl sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Book className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">知识库</h1>
                                <p className="text-xs text-blue-200">帮助中心 · FAQ</p>
                            </div>
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/" className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 py-2 px-4 flex items-center gap-2">
                            <Home size={16} />
                            返回首页
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 relative z-10">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-2xl shadow-2xl mb-10 animate-fade-in">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500" />
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }} />
                    </div>
                    <div className="relative p-8 md:p-12">
                        <div className="text-white max-w-2xl mx-auto text-center">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                📚 知识库
                            </h2>
                            <p className="text-emerald-100 text-lg mb-6">
                                浏览常见问题解答，快速找到您需要的帮助
                            </p>
                            {/* Search Bar */}
                            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="搜索文章..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-24 py-4 rounded-xl bg-white/95 backdrop-blur-sm border-0 shadow-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-white/50"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all"
                                    >
                                        搜索
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-emerald-500" />
                            分类浏览
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => handleCategoryClick('')}
                                className={`px-4 py-2 rounded-xl font-medium transition-all ${!activeCategory
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                                    }`}
                            >
                                全部
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryClick(cat.slug)}
                                    className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${activeCategory === cat.slug
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                                        }`}
                                >
                                    <span>{cat.icon}</span>
                                    {cat.name}
                                    <span className="text-xs opacity-70">({cat.article_count})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Articles Grid */}
                {loading ? (
                    <Loading variant="section" text="正在加载文章..." />
                ) : articles.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                        <Book className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 mb-4">暂无相关文章</p>
                        <Link
                            to="/dashboard/submit"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                            <MessageSquarePlus size={18} />
                            提交反馈
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {articles.map((article, index) => (
                            <Link
                                key={article.id}
                                to={`/knowledge-base/${article.slug}`}
                                className="stagger-item bg-white rounded-xl shadow-card border border-slate-100 p-5 card-hover group"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <span className="text-sm px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                                        <span>{article.category_icon || '📄'}</span>
                                        {article.category_name || '未分类'}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                        <Eye size={14} />
                                        {article.views}
                                    </span>
                                </div>
                                <h4 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
                                    {article.title}
                                </h4>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                                    {article.excerpt}...
                                </p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">
                                        {new Date(article.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1 text-emerald-500 font-medium group-hover:gap-2 transition-all">
                                        阅读全文 <ChevronRight size={16} />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="flex justify-center mt-12 gap-2">
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

                {/* AI Q&A Sidebar */}
                {aiQaEnabled && (
                    <>
                        {/* Floating Button */}
                        {!showAiChat && (
                            <button
                                onClick={() => setShowAiChat(true)}
                                className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 z-50 group"
                            >
                                <Bot size={24} />
                                <span className="font-medium">AI 智能问答</span>
                                <Sparkles size={18} className="group-hover:animate-pulse" />
                            </button>
                        )}

                        {/* Chat Panel */}
                        {showAiChat && (
                            <div className="fixed bottom-8 right-8 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fade-in">
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
                                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                                    {aiStatus.banned && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                                            <AlertCircle size={16} />
                                            您已被禁止使用 AI 功能
                                        </div>
                                    )}

                                    {aiAnswer && (
                                        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                                            <div className="flex items-start gap-2 mb-2">
                                                <Bot size={16} className="text-purple-500 mt-0.5" />
                                                <span className="text-xs font-medium text-purple-600">AI 回答</span>
                                            </div>
                                            <p className="text-slate-700 text-sm leading-relaxed">{aiAnswer}</p>
                                        </div>
                                    )}

                                    {aiError && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                                            <AlertCircle size={16} />
                                            {aiError}
                                        </div>
                                    )}

                                    {aiLoading && (
                                        <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-3">
                                            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                                            <span className="text-sm text-slate-600">AI 正在思考中...</span>
                                        </div>
                                    )}

                                    {!aiStatus.banned && (
                                        <form onSubmit={handleAiAsk} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={aiQuestion}
                                                onChange={(e) => setAiQuestion(e.target.value)}
                                                placeholder="输入您的问题..."
                                                disabled={aiLoading || aiStatus.remaining <= 0}
                                                className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none disabled:bg-slate-50"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!aiQuestion.trim() || aiLoading || aiStatus.remaining <= 0}
                                                className="px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl disabled:opacity-50 flex items-center"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </form>
                                    )}

                                    {aiStatus.remaining <= 0 && !aiStatus.banned && (
                                        <p className="text-center text-xs text-slate-500">今日问答次数已用完</p>
                                    )}

                                    <p className="text-xs text-slate-400 text-center">AI 仅根据知识库内容回答，答案仅供参考</p>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* CTA Section */}
                <div className="mt-12 text-center bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-3">没有找到答案？</h3>
                    <p className="text-slate-600 mb-6">如果以上文章没有解决您的问题，欢迎直接提交反馈</p>
                    <Link
                        to="/dashboard/submit"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                    >
                        <MessageSquarePlus size={18} />
                        提交反馈
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-16 py-8 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
                    <p className="text-xs text-slate-400">
                        Powered by <a href="https://github.com/vancehuds/VanceFeedback" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 transition-colors font-medium">VanceFeedback</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
