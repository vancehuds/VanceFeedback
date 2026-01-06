import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { Book, ArrowLeft, Eye, Calendar, User, ChevronRight, MessageSquarePlus, Home } from 'lucide-react';
import Loading from '../components/Loading';

export default function KnowledgeBaseArticle() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkKbStatus();
    }, [slug]);

    const checkKbStatus = async () => {
        try {
            const res = await api.get('/settings/public');
            if (res.data.knowledge_base_enabled === false) {
                navigate('/');
                return;
            }
            fetchArticle();
        } catch (err) {
            console.error('Failed to check settings:', err);
            // Even if check fails, try to fetch article. If backend blocks it, it will fail there.
            fetchArticle();
        }
    };

    const fetchArticle = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/knowledge-base/articles/${slug}`);
            setArticle(res.data.article);
            setRelated(res.data.related || []);
        } catch (err) {
            console.error('Failed to load article:', err);
            setError(err.response?.status === 404 ? '文章不存在' : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
                <Loading variant="page" text="正在加载文章..." />
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Book className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">{error || '文章不存在'}</h2>
                    <p className="text-slate-500 mb-6">抱歉，无法找到该文章</p>
                    <Link
                        to="/knowledge-base"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                    >
                        <ArrowLeft size={18} />
                        返回知识库
                    </Link>
                </div>
            </div>
        );
    }

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
                        <Link to="/knowledge-base" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
                            首页
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 relative z-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                    <Link to="/knowledge-base" className="hover:text-emerald-600 transition-colors">知识库</Link>
                    <ChevronRight size={14} />
                    {article.category_name && (
                        <>
                            <Link
                                to={`/knowledge-base?category=${article.category_slug}`}
                                className="hover:text-emerald-600 transition-colors flex items-center gap-1"
                            >
                                <span>{article.category_icon}</span>
                                {article.category_name}
                            </Link>
                            <ChevronRight size={14} />
                        </>
                    )}
                    <span className="text-slate-700 font-medium truncate max-w-xs">{article.title}</span>
                </nav>

                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Main Content */}
                    <article className="lg:col-span-3">
                        <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                            {/* Article Header */}
                            <div className="p-6 md:p-8 border-b border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    {article.category_name && (
                                        <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100 text-sm flex items-center gap-1.5">
                                            <span>{article.category_icon}</span>
                                            {article.category_name}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                                    {article.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        {new Date(article.created_at).toLocaleDateString()}
                                    </span>
                                    {article.author_name && (
                                        <span className="flex items-center gap-1.5">
                                            <User size={14} />
                                            {article.author_name}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <Eye size={14} />
                                        {article.views} 次阅读
                                    </span>
                                </div>
                            </div>

                            {/* Article Content */}
                            <div className="p-6 md:p-8">
                                <div className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline">
                                    {/* Render content with basic formatting */}
                                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700">
                                        {article.content}
                                    </div>
                                </div>
                            </div>

                            {/* Article Footer */}
                            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <Link
                                        to="/knowledge-base"
                                        className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
                                    >
                                        <ArrowLeft size={18} />
                                        返回知识库
                                    </Link>
                                    <Link
                                        to="/dashboard/submit"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                                    >
                                        <MessageSquarePlus size={16} />
                                        仍有疑问？提交反馈
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </article>

                    {/* Sidebar */}
                    <aside className="lg:col-span-1">
                        {/* Related Articles */}
                        {related.length > 0 && (
                            <div className="bg-white rounded-xl shadow-card border border-slate-100 p-5 sticky top-24">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    📖 相关文章
                                </h3>
                                <div className="space-y-3">
                                    {related.map((item) => (
                                        <Link
                                            key={item.id}
                                            to={`/knowledge-base/${item.slug}`}
                                            className="block p-3 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 transition-all group"
                                        >
                                            <h4 className="text-sm font-medium text-slate-700 group-hover:text-emerald-600 line-clamp-2">
                                                {item.title}
                                            </h4>
                                            <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                                <Eye size={12} />
                                                {item.views}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
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
