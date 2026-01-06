import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Book, MessageSquarePlus, User } from 'lucide-react';
import api from '../../api';

const ALL_NAV_ITEMS = [
    { path: '/m', label: '首页', icon: Home, exact: true },
    { path: '/m/knowledge-base', label: '知识库', icon: Book },
    { path: '/m/feedback', label: '反馈', icon: MessageSquarePlus },
    { path: '/m/profile', label: '我的', icon: User },
];

export default function MobileLayout() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    const [kbEnabled, setKbEnabled] = useState(true);

    useEffect(() => {
        const checkSettings = async () => {
            try {
                const res = await api.get('/settings/public');
                setKbEnabled(res.data.knowledge_base_enabled !== false);
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        checkSettings();
    }, []);

    // Filter nav items
    const navItems = ALL_NAV_ITEMS.filter(item => {
        if (item.path === '/m/knowledge-base' && !kbEnabled) return false;
        return true;
    });

    // If not logged in, redirect to login for protected routes
    React.useEffect(() => {
        if (!user) {
            // Allow home page without login
            const path = window.location.pathname;
            if (path !== '/m' && path !== '/m/' && path !== '/m/login') {
                navigate('/m/login', { state: { from: path } });
            }
        }
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-20">
            {/* Page Content */}
            <main className="mobile-content">
                <Outlet />
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="mobile-bottom-nav">
                <div className="mobile-nav-container">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.exact}
                                className={({ isActive }) =>
                                    `mobile-nav-item ${isActive ? 'active' : ''}`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <div className={`mobile-nav-icon ${isActive ? 'active' : ''}`}>
                                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                        </div>
                                        <span className={`mobile-nav-label ${isActive ? 'active' : ''}`}>
                                            {item.label}
                                        </span>
                                        {isActive && <div className="mobile-nav-indicator" />}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
