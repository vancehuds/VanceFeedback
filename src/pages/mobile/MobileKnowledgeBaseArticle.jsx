import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { Book, ArrowLeft, Eye, Calendar, User, ChevronRight, MessageSquarePlus, Home } from 'lucide-react';
import Loading from '../../components/Loading';

export default function MobileKnowledgeBaseArticle() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchArticle();
    }, [slug]);

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
            <div className="mobile-page bg-slate-50 min-h-screen flex items-center justify-center">
                <Loading variant="section" text="加载中..." />
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="mobile-page bg-slate-50 min-h-screen">
                <header className="mobile-header bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                    <button onClick={() => navigate('/m/knowledge-base')} className="p-1 -ml-1">
                        <ArrowLeft size={24} />
                    </button>
                    <span className="font-bold">知识库</span>
                    <div className="w-6" />
                </header>
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <Book className="w-16 h-16 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">{error || '文章不存在'}</h2>
                    <p className="text-slate-500 mb-6 text-center">抱歉，无法找到该文章</p>
                    <Link
                        to="/m/knowledge-base"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium"
                    >
                        <ArrowLeft size={18} />
                        返回知识库
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-page bg-slate-50 min-h-screen">
            {/* Header */}
            <header className="mobile-header sticky top-0 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <button onClick={() => navigate('/m/knowledge-base')} className="p-1 -ml-1">
                    <ArrowLeft size={24} />
                </button>
                <span className="font-bold truncate max-w-[200px]">{article.title}</span>
                <Link to="/m" className="p-1">
                    <Home size={20} />
                </Link>
            </header>

            {/* Article Content */}
            <div className="bg-white">
                {/* Article Header */}
                <div className="px-4 py-5 border-b border-slate-100">
                    {article.category_name && (
                        <Link
                            to={`/m/knowledge-base?category=${article.category_slug}`}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 mb-3"
                        >
                            <span>{article.category_icon}</span>
                            {article.category_name}
                        </Link>
                    )}
                    <h1 className="text-xl font-bold text-slate-800 mb-3 leading-tight">
                        {article.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(article.created_at).toLocaleDateString()}
                        </span>
                        {article.author_name && (
                            <span className="flex items-center gap-1">
                                <User size={12} />
                                {article.author_name}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {article.views} 次阅读
                        </span>
                    </div>
                </div>

                {/* Article Body */}
                <div className="px-4 py-5">
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                        {article.content}
                    </div>
                </div>
            </div>

            {/* Related Articles */}
            {related.length > 0 && (
                <div className="px-4 py-5">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        📖 相关文章
                    </h3>
                    <div className="space-y-2">
                        {related.map((item) => (
                            <Link
                                key={item.id}
                                to={`/m/knowledge-base/${item.slug}`}
                                className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 active:scale-[0.98] transition-transform"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-slate-700 line-clamp-1">
                                        {item.title}
                                    </h4>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Eye size={10} />
                                        {item.views}
                                    </span>
                                </div>
                                <ChevronRight size={16} className="text-slate-300" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA */}
            <div className="px-4 pb-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                    <p className="text-sm text-slate-600 mb-3 text-center">仍有疑问？</p>
                    <Link
                        to="/m/feedback"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium"
                    >
                        <MessageSquarePlus size={18} />
                        提交反馈
                    </Link>
                </div>
            </div>

            {/* Back Button */}
            <div className="px-4 pb-8">
                <button
                    onClick={() => navigate('/m/knowledge-base')}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-medium"
                >
                    <ArrowLeft size={18} />
                    返回知识库
                </button>
            </div>
        </div>
    );
}
