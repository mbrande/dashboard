import React, { useState, useEffect, useCallback } from 'react';
import { fetchArticles, fetchSavedArticles, fetchSavedIds, saveArticle } from '../api/news';
import NewsChat from './NewsChat';

const TOPICS = [
  { key: null, label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'music', label: 'Music' },
  { key: 'computers', label: 'Computers' },
  { key: 'tech', label: 'Tech' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function ArticleCard({ article, saved, onToggleSave }) {
  let tags = article.ai_tags || [];
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }

  return (
    <div className="card news-article">
      <div className="news-article-header">
        <span className="news-source-badge">{article.source_name}</span>
        <span className="news-topic-badge">{article.topic}</span>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
          {timeAgo(article.published_at)}
        </span>
        <button
          className={`news-save-btn ${saved ? 'saved' : ''}`}
          onClick={() => onToggleSave(article.id)}
          title={saved ? 'Unsave' : 'Save'}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      <h3 className="news-article-title">
        <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
      </h3>
      {article.ai_summary && (
        <p className="news-article-summary">{article.ai_summary}</p>
      )}
      {!article.ai_summary && article.content_snippet && (
        <p className="news-article-summary dim">{article.content_snippet.substring(0, 200)}...</p>
      )}
      <div className="news-article-footer">
        {tags.length > 0 && (
          <div className="news-article-tags">
            {tags.slice(0, 5).map((tag, i) => (
              <span key={i} className="news-tag">{tag}</span>
            ))}
          </div>
        )}
        {article.relevance_score != null && article.relevance_score !== 5 && (
          <span className="news-relevance">Relevance: {article.relevance_score}/10</span>
        )}
        {article.author && <span className="dim" style={{ fontSize: '0.7rem' }}>by {article.author}</span>}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [showSaved, setShowSaved] = useState(false);

  // Load saved IDs on mount
  useEffect(() => {
    fetchSavedIds().then(data => {
      const result = Array.isArray(data) ? data[0] : data;
      setSavedIds(new Set(result?.ids || []));
    }).catch(() => {});
  }, []);

  const loadArticles = useCallback(async (p, t, s, append) => {
    setLoading(true);
    try {
      let data;
      if (showSaved) {
        data = await fetchSavedArticles({ topic: t });
      } else {
        data = await fetchArticles({ page: p, limit: 20, topic: t, search: s || undefined });
      }
      const result = Array.isArray(data) ? data[0] : data;
      const arts = result?.articles || [];
      if (append) {
        setArticles(prev => [...prev, ...arts]);
      } else {
        setArticles(arts);
      }
      setTotal(result?.total || arts.length);
    } catch {
      // silent fail
    }
    setLoading(false);
  }, [showSaved]);

  useEffect(() => {
    setPage(1);
    loadArticles(1, topic, search, false);
  }, [topic, search, showSaved, loadArticles]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadArticles(1, topic, search, false);
    }, 60000);
    return () => clearInterval(interval);
  }, [topic, search, showSaved, loadArticles]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadArticles(nextPage, topic, search, true);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const toggleSave = async (articleId) => {
    const isSaved = savedIds.has(articleId);
    const action = isSaved ? 'unsave' : 'save';

    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(articleId);
      else next.add(articleId);
      return next;
    });

    // If we're viewing saved and unsaving, remove from list
    if (showSaved && isSaved) {
      setArticles(prev => prev.filter(a => a.id !== articleId));
    }

    try {
      await saveArticle(articleId, action);
    } catch {
      // Revert on failure
      setSavedIds(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(articleId);
        else next.delete(articleId);
        return next;
      });
    }
  };

  return (
    <div className="news-page page-enter">
      <div className="page-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="news-topic-tabs">
            {TOPICS.map(t => (
              <button
                key={t.label}
                className={`nav-tab ${!showSaved && topic === t.key ? 'active' : ''}`}
                onClick={() => { setShowSaved(false); setTopic(t.key); }}
              >
                {t.label}
              </button>
            ))}
            <button
              className={`nav-tab ${showSaved ? 'active' : ''}`}
              onClick={() => setShowSaved(true)}
            >
              <BookmarkIcon filled={showSaved} />
              {' '}Saved
              {savedIds.size > 0 && <span className="news-saved-count">{savedIds.size}</span>}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!showSaved && (
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Search articles..."
                className="filter-input"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </form>
          )}
          <button
            className={`btn ${chatOpen ? '' : 'btn-outline'}`}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" style={{ marginRight: 4, verticalAlign: -2 }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            Ask AI
          </button>
        </div>
      </div>

      <div className={`news-layout ${chatOpen ? 'with-chat' : ''}`}>
        <div className="news-feed">
          {showSaved && articles.length === 0 && !loading && (
            <div className="empty-state">No saved articles yet. Click the bookmark icon on any article to save it.</div>
          )}

          {articles.map((a, i) => (
            <ArticleCard
              key={`${a.id}-${i}`}
              article={a}
              saved={savedIds.has(a.id)}
              onToggleSave={toggleSave}
            />
          ))}

          {loading && articles.length === 0 && (
            <div className="page-loading"><div className="spinner" /><span>Loading news...</span></div>
          )}

          {!loading && !showSaved && articles.length === 0 && (
            <div className="empty-state">No articles found</div>
          )}

          {!showSaved && articles.length > 0 && articles.length < total && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <button className="btn btn-outline" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>

        {chatOpen && (
          <NewsChat onClose={() => setChatOpen(false)} />
        )}
      </div>
    </div>
  );
}
