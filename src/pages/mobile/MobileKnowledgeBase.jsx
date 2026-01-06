import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { Book, Search, FolderOpen, Eye, ChevronRight, ChevronLeft, Home, MessageSquarePlus } from 'lucide-react';
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

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchArticles();
    }, [activeCategory, searchParams]);

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
        <div className="mobile-page bg-slate-50 min-h-screen">
            {/* Header */}
            <header className="mobile-header sticky top-0 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/m')} className="p-1 -ml-1">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Book size={20} />
                        <div>
                            <h1 className="text-base font-bold">知识库</h1>
                            <p className="text-xs text-emerald-100">FAQ · 帮助中心</p>
                        </div>
                    </div>
                </div>
                <Link to="/m" className="p-2 bg-white/20 rounded-lg">
                    <Home size={18} />
                </Link>
            </header>

            {/* Search Bar */}
            <div className="px-4 py-4 bg-gradient-to-b from-emerald-600 to-emerald-500">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索文章..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-16 py-3 rounded-xl bg-white border-0 shadow-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-white/50"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium"
                    >
                        搜索
                    </button>
                </form>
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
