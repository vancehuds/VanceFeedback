import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import { ChevronLeft, Plus, Book, Edit3, Trash2, X, AlertCircle, Loader2, Eye, EyeOff, FolderOpen, FileText, Search } from 'lucide-react';
import Loading from '../../../components/Loading';
import { formatDate } from '../../../utils/date';

export default function MobileAdminKnowledgeBase() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('articles');
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('article'); // 'article' or 'category'
    const [isEditing, setIsEditing] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');

    // Form states
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: '📁', sort_order: 0 });
    const [articleForm, setArticleForm] = useState({ title: '', category_id: '', content: '', is_published: 0 });

    useEffect(() => {
        fetchCategories();
        fetchArticles();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/knowledge-base/admin/categories');
            setCategories(res.data);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchArticles = async () => {
        setLoading(true);
        try {
            const params = { limit: 50 };
            if (searchQuery) params.search = searchQuery;
            const res = await api.get('/knowledge-base/admin/articles', { params });
            setArticles(res.data.articles);
        } catch (err) {
            console.error('Failed to fetch articles:', err);
        } finally {
            setLoading(false);
        }
    };

    // Category handlers
    const openCreateCategory = () => {
        setModalType('category');
        setIsEditing(false);
        setCategoryForm({ name: '', description: '', icon: '📁', sort_order: 0 });
        setError('');
        setShowModal(true);
    };

    const openEditCategory = (cat) => {
        setModalType('category');
        setIsEditing(true);
        setSelectedId(cat.id);
        setCategoryForm({
            name: cat.name,
            description: cat.description || '',
            icon: cat.icon || '📁',
            sort_order: cat.sort_order || 0
        });
        setError('');
        setShowModal(true);
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');
        try {
            if (isEditing) {
                await api.put(`/knowledge-base/admin/categories/${selectedId}`, categoryForm);
            } else {
                await api.post('/knowledge-base/admin/categories', categoryForm);
            }
            setShowModal(false);
            fetchCategories();
        } catch (err) {
            setError(err.response?.data?.error || '操作失败');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('确定删除此分类？')) return;
        try {
            await api.delete(`/knowledge-base/admin/categories/${id}`);
            fetchCategories();
        } catch (err) {
            alert(err.response?.data?.error || '删除失败');
        }
    };

    // Article handlers
    const openCreateArticle = () => {
        setModalType('article');
        setIsEditing(false);
        setArticleForm({ title: '', category_id: '', content: '', is_published: 0 });
        setError('');
        setShowModal(true);
    };

    const openEditArticle = (article) => {
        setModalType('article');
        setIsEditing(true);
        setSelectedId(article.id);
        setArticleForm({
            title: article.title,
            category_id: article.category_id || '',
            content: article.content,
            is_published: article.is_published
        });
        setError('');
        setShowModal(true);
    };

    const handleSaveArticle = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');
        try {
            const data = { ...articleForm, category_id: articleForm.category_id || null };
            if (isEditing) {
                await api.put(`/knowledge-base/admin/articles/${selectedId}`, data);
            } else {
                await api.post('/knowledge-base/admin/articles', data);
            }
            setShowModal(false);
            fetchArticles();
        } catch (err) {
            setError(err.response?.data?.error || '操作失败');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteArticle = async (id) => {
        if (!confirm('确定删除此文章？')) return;
        try {
            await api.delete(`/knowledge-base/admin/articles/${id}`);
            fetchArticles();
        } catch (err) {
            alert('删除失败');
        }
    };

    const handleToggleArticle = async (article) => {
        try {
            await api.put(`/knowledge-base/admin/articles/${article.id}/toggle`);
            fetchArticles();
        } catch (err) {
            alert('操作失败');
        }
    };

    return (
        <div className="mobile-page">
            <header className="mobile-admin-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/m/admin/more')} className="p-1 -ml-2">
                        <ChevronLeft size={24} className="text-slate-600" />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">知识库管理</h1>
                </div>
                <button
                    onClick={activeTab === 'articles' ? openCreateArticle : openCreateCategory}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"
                >
                    <Plus size={20} />
                </button>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('articles')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 ${activeTab === 'articles'
                            ? 'text-emerald-600 border-b-2 border-emerald-500'
                            : 'text-slate-500'
                        }`}
                >
                    <FileText size={16} />
                    文章
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 ${activeTab === 'categories'
                            ? 'text-emerald-600 border-b-2 border-emerald-500'
                            : 'text-slate-500'
                        }`}
                >
                    <FolderOpen size={16} />
                    分类
                </button>
            </div>

            {/* Search (for articles) */}
            {activeTab === 'articles' && (
                <div className="px-4 pt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜索文章..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchArticles()}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm"
                        />
                    </div>
                </div>
            )}

            <div className="px-4 py-4 space-y-3">
                {/* Articles Tab */}
                {activeTab === 'articles' && (
                    loading ? <Loading variant="section" /> : articles.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <FileText size={40} className="mx-auto mb-2 opacity-50" />
                            <p>暂无文章</p>
                        </div>
                    ) : (
                        articles.map(article => (
                            <div key={article.id} className="mobile-admin-card relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {article.category_name && (
                                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">
                                                {article.category_name}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${article.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {article.is_published ? '已发布' : '草稿'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleToggleArticle(article)}
                                            className={`p-1.5 rounded-lg ${article.is_published
                                                    ? 'text-amber-500 bg-amber-50'
                                                    : 'text-green-500 bg-green-50'
                                                }`}
                                        >
                                            {article.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <button onClick={() => openEditArticle(article)} className="p-1.5 text-slate-400 bg-slate-50 rounded-lg">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteArticle(article.id)} className="p-1.5 text-red-400 bg-red-50 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-slate-800 mb-1 line-clamp-1">{article.title}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Eye size={12} />
                                        {article.views}
                                    </span>
                                    <span>{formatDate(article.updated_at)}</span>
                                </div>
                            </div>
                        ))
                    )
                )}

                {/* Categories Tab */}
                {activeTab === 'categories' && (
                    categories.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <FolderOpen size={40} className="mx-auto mb-2 opacity-50" />
                            <p>暂无分类</p>
                        </div>
                    ) : (
                        categories.map(cat => (
                            <div key={cat.id} className="mobile-admin-card relative">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{cat.icon}</span>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{cat.name}</h3>
                                            <p className="text-xs text-slate-500">{cat.article_count || 0} 篇文章</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openEditCategory(cat)} className="p-1.5 text-slate-400 bg-slate-50 rounded-lg">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-red-400 bg-red-50 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {cat.description && (
                                    <p className="text-sm text-slate-500 mt-2 line-clamp-1">{cat.description}</p>
                                )}
                            </div>
                        ))
                    )
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="mobile-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="mobile-modal" onClick={e => e.stopPropagation()}>
                        <div className="mobile-modal-header">
                            <h2 className="text-lg font-bold text-slate-800">
                                {modalType === 'article'
                                    ? (isEditing ? '编辑文章' : '新建文章')
                                    : (isEditing ? '编辑分类' : '新建分类')
                                }
                            </h2>
                            <button onClick={() => setShowModal(false)} className="mobile-modal-close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mobile-modal-content">
                            {/* Category Form */}
                            {modalType === 'category' && (
                                <form onSubmit={handleSaveCategory} className="space-y-4">
                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            {error}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">分类名称</label>
                                        <input
                                            type="text"
                                            value={categoryForm.name}
                                            onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                            className="mobile-input"
                                            placeholder="分类名称"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">图标 (Emoji)</label>
                                        <input
                                            type="text"
                                            value={categoryForm.icon}
                                            onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                            className="mobile-input"
                                            maxLength={4}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                                        <textarea
                                            value={categoryForm.description}
                                            onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                            className="mobile-input min-h-[80px]"
                                            placeholder="分类描述..."
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {formLoading ? <Loader2 size={18} className="animate-spin" /> : (isEditing ? <Edit3 size={18} /> : <Plus size={18} />)}
                                        {isEditing ? '保存修改' : '创建分类'}
                                    </button>
                                </form>
                            )}

                            {/* Article Form */}
                            {modalType === 'article' && (
                                <form onSubmit={handleSaveArticle} className="space-y-4">
                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            {error}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">文章标题</label>
                                        <input
                                            type="text"
                                            value={articleForm.title}
                                            onChange={e => setArticleForm({ ...articleForm, title: e.target.value })}
                                            className="mobile-input"
                                            placeholder="文章标题"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
                                        <select
                                            value={articleForm.category_id}
                                            onChange={e => setArticleForm({ ...articleForm, category_id: e.target.value })}
                                            className="mobile-input"
                                        >
                                            <option value="">未分类</option>
                                            {categories.filter(c => c.is_active).map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">文章内容</label>
                                        <textarea
                                            value={articleForm.content}
                                            onChange={e => setArticleForm({ ...articleForm, content: e.target.value })}
                                            className="mobile-input min-h-[150px]"
                                            placeholder="文章内容..."
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="is_published_mobile"
                                            checked={articleForm.is_published === 1}
                                            onChange={e => setArticleForm({ ...articleForm, is_published: e.target.checked ? 1 : 0 })}
                                            className="w-4 h-4 text-emerald-500 rounded"
                                        />
                                        <label htmlFor="is_published_mobile" className="text-sm text-slate-700">立即发布</label>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {formLoading ? <Loader2 size={18} className="animate-spin" /> : (isEditing ? <Edit3 size={18} /> : <Plus size={18} />)}
                                        {isEditing ? '保存修改' : '创建文章'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
