const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const fetchArticles = ({ page = 1, limit = 20, topic, search } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (topic) params.set('topic', topic);
  if (search) params.set('search', search);
  return fetch(`${BASE}/news/articles?${params}`).then(r => r.json());
};

export const fetchSources = () =>
  fetch(`${BASE}/news/sources`).then(r => r.json());

export const sendChatMessage = (message, sessionId) =>
  fetch(`${BASE}/news/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId })
  }).then(r => r.json());

export const saveArticle = (articleId, action = 'save') =>
  fetch(`${BASE}/news/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: articleId, action })
  }).then(r => r.json());

export const fetchSavedArticles = ({ topic } = {}) => {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  return fetch(`${BASE}/news/saved?${params}`).then(r => r.json());
};

export const fetchSavedIds = () =>
  fetch(`${BASE}/news/saved-ids`).then(r => r.json());
