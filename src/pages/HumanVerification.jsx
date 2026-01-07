import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import 'altcha';
import api from '../api';

const HumanVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);
    const [challengeUrl, setChallengeUrl] = useState('/api/captcha/challenge');
    const widgetRef = React.useRef(null);

    useEffect(() => {
        // Ensure altcha widget is loaded
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';
        script.async = true;
        document.body.appendChild(script);

        const handleVerifyEvent = (ev) => {
            console.log('Altcha verification event received:', ev);
            handleVerify(ev);
        };

        const widget = widgetRef.current;
        if (widget) {
            widget.addEventListener('verify', handleVerifyEvent);
        }

        return () => {
            document.body.removeChild(script);
            if (widget) {
                widget.removeEventListener('verify', handleVerifyEvent);
            }
        };
    }, []);

    const handleVerify = async (ev) => {
        const payload = ev.detail.payload;
        console.log('Verifying payload:', payload);
        if (!payload) return;

        setVerifying(true);
        setError(null);

        try {
            console.log('Sending verification request...');
            await api.post('/captcha/verify-limit', { payload });
            console.log('Verification successful, redirecting...');

            const params = new URLSearchParams(location.search);
            const storedReturnTo = sessionStorage.getItem('rateLimitReturnTo');
            const returnTo = params.get('returnTo') || storedReturnTo;

            if (returnTo && returnTo !== '/verify-human') {
                sessionStorage.removeItem('rateLimitReturnTo');
                navigate(returnTo, { replace: true });
            } else if (window.history.length > 2) {
                console.log('Navigating back -1');
                navigate(-1);
            } else {
                console.log('Navigating to root');
                navigate('/');
            }
        } catch (err) {
            console.error('Verification failed:', err);
            setError('验证失败，请重试');
            // Refresh challenge
            setChallengeUrl(`/api/captcha/challenge?t=${Date.now()}`);
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        安全验证
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        我们的系统检测到您的请求频率过高。为了确保系统安全，请完成下方的人机验证。
                    </p>
                </div>

                <div className="flex justify-center mt-8 w-full" style={{
                    '--altcha-color-base': '#ffffff',
                    '--altcha-color-border': '#e2e8f0',
                    '--altcha-color-text': '#1e293b',
                    '--altcha-border-radius': '0.75rem',
                    '--altcha-color-primary': '#6366f1',
                    '--altcha-max-width': '100%',
                }}>
                    <altcha-widget
                        ref={widgetRef}
                        challengeurl={challengeUrl}
                        hidelogo="true"
                        hidefooter="true"
                        strings='{"label":"点击验证","verifying":"验证中...","verified":"验证通过","error":"验证失败"}'
                        className="w-full"
                    ></altcha-widget>
                </div>

                {verifying && (
                    <div className="text-center mt-4 text-blue-600">
                        正在解除限制...
                    </div>
                )}

                {error && (
                    <div className="text-center mt-4 text-red-600">
                        {error}
                    </div>
                )}

                <div className="text-center mt-6 text-xs text-gray-400">
                    验证通过后将自动返回上一页
                </div>
            </div>
        </div>
    );
};

export default HumanVerification;
