import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getSetting } from './email.js';

// Configuration - loaded from database
let aiProvider = null; // 'gemini' | 'bigmodel'
let genAI = null;      // Google Gemini instance
let bigModelKey = null; // BigModel API Key
let geminiModel = 'gemini-3-flash-preview'; // Gemini model name
let bigModelModel = 'glm-4'; // BigModel model name

/**
 * Initialize the AI service with settings from database
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export async function initAI() {
    // Check if AI is enabled
    const aiEnabled = await getSetting('ai_enabled');
    if (aiEnabled !== true && aiEnabled !== 'true') {
        console.log('AI service is disabled in settings.');
        aiProvider = null;
        genAI = null;
        bigModelKey = null;
        return false;
    }

    const preferredProvider = await getSetting('ai_provider') || 'gemini';
    const geminiKey = await getSetting('gemini_api_key');
    const bigModelApiKey = await getSetting('bigmodel_api_key');

    // Load model names from settings
    geminiModel = await getSetting('gemini_model') || 'gemini-3-flash-preview';
    bigModelModel = await getSetting('bigmodel_model') || 'glm-4';

    // Reset state
    aiProvider = null;
    genAI = null;
    bigModelKey = null;

    // Determine provider
    if (preferredProvider === 'bigmodel' && bigModelApiKey) {
        aiProvider = 'bigmodel';
        bigModelKey = bigModelApiKey;
    } else if (preferredProvider === 'gemini' && geminiKey) {
        aiProvider = 'gemini';
        try {
            genAI = new GoogleGenerativeAI(geminiKey);
        } catch (err) {
            console.error('Error initializing Gemini client:', err);
            aiProvider = null;
        }
    } else if (geminiKey) {
        // Fallback to Gemini if available
        aiProvider = 'gemini';
        try {
            genAI = new GoogleGenerativeAI(geminiKey);
        } catch (err) {
            console.error('Error initializing Gemini client:', err);
            aiProvider = null;
        }
    } else if (bigModelApiKey) {
        // Fallback to BigModel if Gemini not set but BigModel is
        aiProvider = 'bigmodel';
        bigModelKey = bigModelApiKey;
    }

    if (aiProvider) {
        console.log(`AI service initialized successfully using provider: ${aiProvider} (model: ${aiProvider === 'gemini' ? geminiModel : bigModelModel})`);
        return true;
    } else {
        console.warn('AI service not configured. Please configure API keys in admin settings.');
        return false;
    }
}

/**
 * Reinitialize AI service (call after settings change)
 * @returns {Promise<boolean>}
 */
export async function reinitAI() {
    return await initAI();
}

/**
 * Check if AI service is available
 * @returns {boolean}
 */
export function isAIAvailable() {
    const available = aiProvider !== null;
    if (!available) {
        console.warn('[AI] isAIAvailable check failed: aiProvider is null');
    }
    return available;
}


/**
 * Generate a JWT token for BigModel API
 * @param {string} apiKey - The ID.Secret format API Key
 * @returns {string} The collected JWT token
 */
function generateBigModelToken(apiKey) {
    try {
        const [id, secret] = apiKey.split('.');
        const now = Date.now();

        const payload = {
            api_key: id,
            exp: now + 3600 * 1000, // 1 hour expiration
            timestamp: now,
        };

        const token = jwt.sign(payload, secret, {
            algorithm: 'HS256',
            header: {
                alg: 'HS256',
                sign_type: 'SIGN'
            }
        });

        return token;
    } catch (error) {
        console.error('Error generating BigModel token:', error);
        throw error;
    }
}

/**
 * Call BigModel API for chat completions
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} The generated text
 */
async function callBigModel(prompt) {
    if (!bigModelKey) throw new Error('BigModel API Key not configured');

    const token = generateBigModelToken(bigModelKey);
    const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    try {
        const response = await axios.post(
            url,
            {
                model: bigModelModel,
                messages: [
                    { role: 'user', content: prompt }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            console.error('Unexpected BigModel response:', response.data);
            throw new Error('Invalid response from BigModel API');
        }
    } catch (error) {
        console.error('BigModel API call failed:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Generate a reply suggestion for a feedback ticket
 * @param {Object} ticket - The ticket object containing feedback details
 * @param {string} ticket.type - Type of feedback
 * @param {string} ticket.content - The feedback content
 * @param {string} ticket.location - Location mentioned in feedback (optional)
 * @param {Array} replies - Existing replies to this ticket (optional)
 * @returns {Promise<string>} AI-generated reply suggestion
 */
export async function generateReplySuggestion(ticket, replies = []) {
    if (!isAIAvailable()) {
        throw new Error('AI service not available. Please configure API keys.');
    }

    // Build prompt (shared between providers)
    let replyContext = '';
    if (replies && replies.length > 0) {
        replyContext = '\n\n已有回复记录：\n' + replies.map((r, i) =>
            `${i + 1}. ${r.admin_name}（${new Date(r.created_at).toLocaleString('zh-CN')}）：${r.content}`
        ).join('\n');
    }

    const prompt = `你是一个大学图书馆的客服助手。请为以下用户反馈生成一个礼貌、专业且有帮助的回复建议。

**反馈类型**：${ticket.type || '未分类'}
**反馈内容**：${ticket.content}
${ticket.location ? `**位置**：${ticket.location}` : ''}${replyContext}

**要求**：
1. 语气要礼貌、友好、专业
2. 对用户的问题表示理解和重视
3. 如果是问题或投诉，要给出具体的解决方案或后续跟进计划
4. 如果是建议，要感谢用户并说明是否会采纳
5. 回复长度控制在100-200字
6. 不要使用过于官方的套话，要真诚自然
7. 如果已有回复记录，请基于之前的对话继续回复，保持连贯性

请直接生成回复内容，不要包含任何前缀或解释：`;

    try {
        if (aiProvider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: geminiModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } else if (aiProvider === 'bigmodel') {
            const text = await callBigModel(prompt);
            return text.trim();
        }
    } catch (err) {
        console.error('AI reply generation failed:', err);
        throw new Error('AI回复生成失败: ' + err.message);
    }
}

/**
 * Analyze sentiment of feedback content
 * @param {string} content - The feedback content to analyze
 * @returns {Promise<Object>} Sentiment analysis result
 */
export async function analyzeSentiment(content) {
    if (!isAIAvailable()) {
        throw new Error('AI service not available. Please configure API keys.');
    }

    const prompt = `分析以下用户反馈的情感倾向，返回JSON格式：

反馈内容：${content}

返回格式：
{
  "sentiment": "positive|neutral|negative|urgent",
  "score": 0-10的数字（10表示非常积极或非常紧急）,
  "summary": "简短的情感描述（不超过20字）"
}

只返回JSON，不要其他内容：`;

    try {
        let text = '';
        if (aiProvider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: geminiModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
        } else if (aiProvider === 'bigmodel') {
            text = await callBigModel(prompt);
        }

        // Extract JSON from response (common logic)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Invalid AI response format');
    } catch (err) {
        console.error('Sentiment analysis failed:', err);
        throw new Error('情感分析失败: ' + err.message);
    }
}

/**
 * Summarize a ticket's content and conversation history
 * @param {Object} ticket - The ticket object
 * @param {Array} replies - Array of replies associated with the ticket
 * @returns {Promise<Object>} Summary result with fields: summary, keyPoints, actionItems
 */
export async function summarizeTicket(ticket, replies = []) {
    if (!isAIAvailable()) {
        throw new Error('AI service not available. Please configure API keys.');
    }

    // Build conversation context
    let conversationContext = `用户反馈（${ticket.type || '未分类'}）：${ticket.content}`;
    if (ticket.location) {
        conversationContext += `\n位置：${ticket.location}`;
    }

    if (replies && replies.length > 0) {
        conversationContext += '\n\n对话记录：';
        replies.forEach((r, i) => {
            conversationContext += `\n${i + 1}. ${r.admin_name}（${new Date(r.created_at).toLocaleString('zh-CN')}）：${r.content}`;
        });
    }

    const prompt = `请为以下工单对话生成一份简洁的总结，帮助管理员快速了解情况。

${conversationContext}

请返回JSON格式：
{
  "summary": "简短总结（50-100字）",
  "keyPoints": ["关键点1", "关键点2", "关键点3"],
  "status": "问题类型简述",
  "actionItems": ["如有需要，列出后续待办事项"]
}

只返回JSON，不要其他内容：`;

    try {
        let text = '';
        if (aiProvider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: geminiModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
        } else if (aiProvider === 'bigmodel') {
            text = await callBigModel(prompt);
        }

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Invalid AI response format');
    } catch (err) {
        console.error('Ticket summarization failed:', err);
        throw new Error('工单总结失败: ' + err.message);
    }
}

/**
 * Analyze trends from a batch of tickets
 * @param {Array} tickets - Array of ticket objects
 * @returns {Promise<Object>} Trend analysis result
 */
export async function analyzeTrends(tickets) {
    if (!isAIAvailable()) {
        throw new Error('AI service not available. Please configure API keys.');
    }

    if (!tickets || tickets.length === 0) {
        return { trends: [], insights: [], recommendations: [] };
    }

    // Prepare a condensed version of tickets for analysis
    const ticketSummaries = tickets.slice(0, 50).map(t => ({
        type: t.type,
        content: t.content.substring(0, 200), // Limit content length
        status: t.status,
        rating: t.rating,
        created_at: t.created_at
    }));

    const prompt = `分析以下${ticketSummaries.length}条用户反馈工单，找出趋势和洞察：

${JSON.stringify(ticketSummaries, null, 2)}

请返回JSON格式：
{
  "trends": [
    {"topic": "趋势主题", "count": "预估涉及量", "description": "描述"}
  ],
  "insights": ["洞察1", "洞察2", "洞察3"],
  "recommendations": ["建议1", "建议2"],
  "overallSentiment": "positive|neutral|negative",
  "topIssues": ["问题1", "问题2", "问题3"]
}

只返回JSON，不要其他内容：`;

    try {
        let text = '';
        if (aiProvider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: geminiModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
        } else if (aiProvider === 'bigmodel') {
            text = await callBigModel(prompt);
        }

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Invalid AI response format');
    } catch (err) {
        console.error('Trend analysis failed:', err);
        throw new Error('趋势分析失败: ' + err.message);
    }
}

/**
 * Answer a question based on knowledge base content
 * Uses strict prompt to only answer from KB content, avoiding commitments
 * @param {string} question - User's question
 * @param {Array} articles - Related knowledge base articles (title, content)
 * @returns {Promise<string>} AI-generated answer
 */
export async function answerKnowledgeBaseQuestion(question, articles = []) {
    if (!isAIAvailable()) {
        throw new Error('AI service not available. Please configure API keys.');
    }

    if (!articles || articles.length === 0) {
        return '抱歉，知识库中暂无相关内容，您可以提交反馈获取人工帮助。';
    }

    // Build knowledge base context
    const kbContext = articles.map((a, i) =>
        `【文章${i + 1}】${a.title}\n${a.content}`
    ).join('\n\n---\n\n');

    const prompt = `你是一个知识库问答助手。请**严格**根据以下知识库内容回答用户问题。

**重要规则：**
1. 只能基于提供的知识库内容进行回答，不能编造或推测
2. 如果知识库中没有相关信息，直接回复"抱歉，知识库中暂无相关内容"
3. 不要做出任何承诺或保证
4. 回答要精简扼要，控制在100字以内
5. 使用友好的语气，但保持专业
6. 不要透露你是AI或提到"知识库"等系统内部术语

**知识库内容：**
${kbContext}

**用户问题：**
${question}

**请直接回答：**`;

    try {
        let text = '';
        if (aiProvider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: geminiModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
        } else if (aiProvider === 'bigmodel') {
            text = await callBigModel(prompt);
            text = text.trim();
        }

        // Clean up response - remove any markdown code blocks if present
        text = text.replace(/```[\s\S]*?```/g, '').trim();

        // Truncate if too long
        if (text.length > 300) {
            text = text.substring(0, 297) + '...';
        }

        return text || '抱歉，暂时无法回答您的问题，请稍后再试。';
    } catch (err) {
        console.error('Knowledge base Q&A failed:', err);
        throw new Error('AI问答失败: ' + err.message);
    }
}
