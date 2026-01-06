import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { Book, ChevronLeft, Eye, Calendar, User, ChevronRight, MessageSquarePlus } from 'lucide-react';
import Loading from '../../components/Loading';

export default function MobileKnowledgeBaseArticle() {
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
                navigate('/m');
                return;
            }
            fetchArticle();
        } catch (err) {
            console.error('Failed to check settings:', err);
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
            <div className="mobile-page bg-slate-50 min-h-screen flex items-center justify-center">
                <Loading variant="section" text="加载中..." />
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="mobile-page">
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mb-4">
                        <Book className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 mb-2">{error || '文章不存在'}</h2>
                    <p className="text-slate-500 mb-6 text-center">抱歉，无法找到该文章</p>
                    <Link
                        to="/m/knowledge-base"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg"
                    >
                        <ChevronLeft size={18} />
                        返回知识库
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-page">
            {/* Sticky Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/m/knowledge-base')}
                        className="w-9 h-9 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl flex items-center justify-center text-emerald-600 active:scale-95 transition-transform"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-emerald-600 font-medium">📚 知识库</p>
                        <h1 className="text-sm font-bold text-slate-800 truncate">{article.title}</h1>
                    </div>
                </div>
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

        </div>
    );
}
