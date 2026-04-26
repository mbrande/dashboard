import React, { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchArticles, fetchSavedArticles, fetchSavedIds, saveArticle, fetchSources } from '../api/news';
import NewsChat from './NewsChat';

const TOPICS = [
  { key: null, label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'music', label: 'Music' },
  { key: 'computers', label: 'Computers' },
  { key: 'tech', label: 'Tech' },
];

const PAGE_SIZE = 20;
const unwrap = (d) => (Array.isArray(d) ? d[0] : d);

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

const savedIdsKey = ['news', 'saved-ids'];
const feedKey = (topic, search, source) => ['news', 'feed', topic ?? 'all', search || '', source || 'all'];
const savedKey = (topic) => ['news', 'saved', topic ?? 'all'];
const sourcesKey = ['news', 'sources'];

export default function NewsPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [source, setSource] = useState(null);

  // Available sources for the dropdown.
  const { data: sourcesRaw } = useQuery({
    queryKey: sourcesKey,
    queryFn: fetchSources,
    select: (d) => unwrap(d)?.sources || [],
    staleTime: 5 * 60_000,
  });
  const sourceOptions = useMemo(() => {
    const all = sourcesRaw || [];
    const filtered = topic ? all.filter(s => s.topic === topic) : all;
    return filtered
      .filter(s => s.enabled)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sourcesRaw, topic]);

  // Saved-id set powers the bookmark filled state across both views.
  const { data: savedIdsRaw } = useQuery({
    queryKey: savedIdsKey,
    queryFn: fetchSavedIds,
    select: (d) => unwrap(d)?.ids || [],
    staleTime: 60_000,
  });
  const savedIds = useMemo(() => new Set(savedIdsRaw || []), [savedIdsRaw]);

  // Main feed: paginated via useInfiniteQuery. Polled every 60s — TanStack
  // Query refetches the first page only on interval, which matches what the
  // old manual setInterval did.
  const feed = useInfiniteQuery({
    queryKey: feedKey(topic, search, source),
    queryFn: ({ pageParam = 1 }) =>
      fetchArticles({ page: pageParam, limit: PAGE_SIZE, topic, search: search || undefined, source: source || undefined }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const p = unwrap(lastPage);
      const loaded = allPages.reduce((n, pg) => n + (unwrap(pg)?.articles?.length || 0), 0);
      const total = p?.total || 0;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    refetchInterval: showSaved ? false : 60_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
    enabled: !showSaved,
  });

  // Saved view: simple non-paginated query. Only enabled when showing saved.
  const savedView = useQuery({
    queryKey: savedKey(topic),
    queryFn: () => fetchSavedArticles({ topic }),
    select: (d) => unwrap(d)?.articles || [],
    enabled: showSaved,
    staleTime: 30_000,
  });

  // Articles to display: flatten infinite pages OR show the saved list.
  const articles = useMemo(() => {
    if (showSaved) return savedView.data || [];
    const pages = feed.data?.pages || [];
    return pages.flatMap(p => unwrap(p)?.articles || []);
  }, [showSaved, savedView.data, feed.data]);

  const total = useMemo(() => {
    if (showSaved) return articles.length;
    const pages = feed.data?.pages || [];
    return unwrap(pages[pages.length - 1])?.total ?? articles.length;
  }, [showSaved, articles, feed.data]);

  const loading = showSaved ? savedView.isPending : feed.isPending;

  // Optimistic save/unsave. Updates saved-ids cache + saved-view if mounted,
  // rolls back on failure.
  const saveMutation = useMutation({
    mutationFn: ({ articleId, action }) => saveArticle(articleId, action),
    onMutate: async ({ articleId, action }) => {
      await qc.cancelQueries({ queryKey: savedIdsKey });
      const prevIds = qc.getQueryData(savedIdsKey);
      qc.setQueryData(savedIdsKey, (old) => {
        const ids = new Set(unwrap(old)?.ids || []);
        if (action === 'save') ids.add(articleId);
        else ids.delete(articleId);
        const arr = [...ids];
        return Array.isArray(old) ? [{ ids: arr }] : { ids: arr };
      });
      // If the saved view is currently displayed and we're unsaving, drop the
      // article from it so the row disappears.
      if (showSaved && action === 'unsave') {
        qc.setQueryData(savedKey(topic), (old) => {
          const obj = unwrap(old);
          if (!obj?.articles) return old;
          const next = { ...obj, articles: obj.articles.filter(a => a.id !== articleId) };
          return Array.isArray(old) ? [next] : next;
        });
      }
      return { prevIds };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevIds !== undefined) qc.setQueryData(savedIdsKey, ctx.prevIds);
      // saved view will refetch on invalidate below
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: savedIdsKey });
      qc.invalidateQueries({ queryKey: ['news', 'saved'] });
    },
  });

  const toggleSave = (articleId) => {
    const action = savedIds.has(articleId) ? 'unsave' : 'save';
    saveMutation.mutate({ articleId, action });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const showLoadMore =
    !showSaved && articles.length > 0 && articles.length < total && feed.hasNextPage;

  return (
    <div className="news-page page-enter">
      <div className="page-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="news-topic-tabs">
            {TOPICS.map(t => (
              <button
                key={t.label}
                className={`nav-tab ${!showSaved && topic === t.key ? 'active' : ''}`}
                onClick={() => { setShowSaved(false); setTopic(t.key); setSource(null); }}
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
          {!showSaved && sourceOptions.length > 1 && (
            <select
              className="filter-input"
              value={source || ''}
              onChange={e => setSource(e.target.value || null)}
              title="Filter by source"
            >
              <option value="">All sources</option>
              {sourceOptions.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
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
            className="btn btn-outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['news'] });
            }}
            disabled={feed.isFetching || savedView.isFetching}
            title="Refresh news"
          >
            {feed.isFetching || savedView.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
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

          {showLoadMore && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <button
                className="btn btn-outline"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {feed.isFetchingNextPage ? 'Loading...' : 'Load More'}
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
