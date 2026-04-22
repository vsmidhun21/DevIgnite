import {
  useState,
  useEffect,
  useRef,
  memo,
  useCallback,
  startTransition,
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react';
import { ChevronsDown, Trash2, Search, ChevronUp, ChevronDown, X } from 'lucide-react';

const api = window.devignite;
const LEVEL_CLASS = { info:'', warn:'warn', error:'error', success:'success' };

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMessage(message, searchRegex) {
  if (!searchRegex || !message) return message;

  searchRegex.lastIndex = 0;
  const matches = [...message.matchAll(searchRegex)];
  if (matches.length === 0) return message;

  const parts = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (start > lastIndex) {
      parts.push(message.slice(lastIndex, start));
    }

    parts.push(<mark key={`${start}-${index}`}>{message.slice(start, end)}</mark>);
    lastIndex = end;
  });

  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex));
  }

  return parts;
}

const LogLine = memo(function LogLine({ line, searchRegex, isActiveMatch, lineRef }) {
  return (
    <div ref={lineRef} className={`log-line ${LEVEL_CLASS[line.level]||''} ${isActiveMatch ? 'active-match' : ''}`}>
      <span className="log-ts">
        {line.ts ? new Date(line.ts).toTimeString().slice(0,8) : ''}
      </span>
      <span className="log-msg">{highlightMessage(line.message, searchRegex)}</span>
    </div>
  );
});

const LogViewer = forwardRef(function LogViewer({ projectId, onClearLogs }, ref) {
  const [which,      setWhich]      = useState('current');
  const [savedLogs,  setSavedLogs]  = useState([]);
  const [localLogs,  setLocalLogs]  = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [meta,       setMeta]       = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const panelRef = useRef(null);
  const scrollTid = useRef(null);
  const searchInputRef = useRef(null);
  const lineRefs = useRef(new Map());

  useEffect(() => {
    if (!projectId) return;

    const loadLogs = async () => {
      const logs = await api.logs.read(projectId, which);
      if (which === 'current') setLocalLogs(logs);
      else setSavedLogs(logs);

      const m = await api.logs.meta(projectId);
      setMeta(m);
    };

    loadLogs();

    if (which === 'current') {
      let rAF = null;
      let buffer = [];
      const flush = () => {
        if (buffer.length === 0) return;
        setLocalLogs(prev => {
          const next = [...prev, ...buffer].slice(-1000);
          buffer = [];
          return next;
        });
        rAF = null;
      };

      const unsub = api.on.logStream(data => {
        if (data.projectId === projectId) {
          buffer.push(data);
          if (!rAF) rAF = requestAnimationFrame(flush);
        }
      });

      return () => {
        unsub?.();
        if (rAF) cancelAnimationFrame(rAF);
      };
    }
  }, [projectId, which]);

  useEffect(() => {
    if (autoScroll && panelRef.current) {
      if (scrollTid.current) cancelAnimationFrame(scrollTid.current);
      scrollTid.current = requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.scrollTop = panelRef.current.scrollHeight;
        }
      });
    }
    return () => { if (scrollTid.current) cancelAnimationFrame(scrollTid.current); };
  }, [localLogs, savedLogs, autoScroll]);

  const onScroll = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
  }, [autoScroll]);

  const clear = async () => {
    if (onClearLogs) await onClearLogs();
    else await api.logs.clear(projectId);
    setSavedLogs([]);
    setLocalLogs([]);
  };

  const lines = which === 'current' ? localLogs : savedLogs;
  const trimmedSearch = searchValue.trim();
  const searchRegex = useMemo(() => {
    if (!trimmedSearch) return null;
    return new RegExp(escapeRegex(trimmedSearch), 'gi');
  }, [trimmedSearch]);

  const matchLineIndexes = useMemo(() => {
    if (!searchRegex) return [];
    return lines.reduce((matches, line, index) => {
      searchRegex.lastIndex = 0;
      if (searchRegex.test(line.message || '')) matches.push(index);
      return matches;
    }, []);
  }, [lines, searchRegex]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [projectId, trimmedSearch, which]);

  useEffect(() => {
    if (activeMatchIndex >= matchLineIndexes.length && matchLineIndexes.length > 0) {
      setActiveMatchIndex(matchLineIndexes.length - 1);
    }
  }, [activeMatchIndex, matchLineIndexes]);

  const scrollToMatch = useCallback((matchIndex) => {
    const lineIndex = matchLineIndexes[matchIndex];
    if (lineIndex == null) return;
    const lineNode = lineRefs.current.get(lineIndex);
    lineNode?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [matchLineIndexes]);

  useEffect(() => {
    if (!searchRegex || matchLineIndexes.length === 0) return;
    scrollToMatch(activeMatchIndex);
  }, [activeMatchIndex, matchLineIndexes, scrollToMatch, searchRegex]);

  const setSearch = useCallback((value) => {
    startTransition(() => {
      setSearchValue(value);
    });
  }, []);

  const focusPanel = useCallback(() => {
    panelRef.current?.focus();
  }, []);

  const focusSearch = useCallback(() => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const goToMatch = useCallback((direction) => {
    if (matchLineIndexes.length === 0) return;
    setActiveMatchIndex(prev => {
      if (direction === 'prev') {
        return (prev - 1 + matchLineIndexes.length) % matchLineIndexes.length;
      }
      return (prev + 1) % matchLineIndexes.length;
    });
  }, [matchLineIndexes.length]);

  useImperativeHandle(ref, () => ({
    focusPanel,
    focusSearch,
    containsActiveElement() {
      const activeElement = document.activeElement;
      return !!activeElement && (
        panelRef.current?.contains(activeElement) ||
        searchInputRef.current === activeElement
      );
    }
  }), [focusPanel, focusSearch]);

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsSearchOpen(false);
      setSearch('');
      focusPanel();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      goToMatch(event.shiftKey ? 'prev' : 'next');
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearch('');
    focusPanel();
  };

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <div className="log-tabs">
          <button className={`log-tab ${which==='current'?'active':''}`} onClick={() => setWhich('current')}>
            Current
            {localLogs.length > 0 && <span className="log-count">{localLogs.length}</span>}
          </button>
          <button className={`log-tab ${which==='previous'?'active':''}`}
            onClick={() => setWhich('previous')} disabled={!meta?.previous}>
            Previous
          </button>
        </div>
        <div className="log-actions">
          <button className={`icon-btn ${isSearchOpen ? 'active' : ''}`} title="Search logs" onClick={focusSearch}>
            <Search size={12} strokeWidth={2}/>
          </button>
          <button className={`icon-btn ${autoScroll?'active':''}`} title="Auto-scroll"
            onClick={() => setAutoScroll(v => !v)}>
            <ChevronsDown size={12} strokeWidth={2}/>
          </button>
          <button className="icon-btn danger" title="Clear" onClick={clear}>
            <Trash2 size={11} strokeWidth={2}/>
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div className="log-search-bar">
          <div className="log-search-input-wrap">
            <Search size={12} strokeWidth={2} className="log-search-icon" />
            <input
              ref={searchInputRef}
              className="log-search-input"
              value={searchValue}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search logs..."
            />
          </div>
          <div className="log-search-meta">
            <span className="log-search-count">
              {matchLineIndexes.length === 0 ? '0 results' : `${activeMatchIndex + 1} / ${matchLineIndexes.length}`}
            </span>
            <button className="icon-btn" title="Previous match" onClick={() => goToMatch('prev')} disabled={matchLineIndexes.length === 0}>
              <ChevronUp size={12} strokeWidth={2} />
            </button>
            <button className="icon-btn" title="Next match" onClick={() => goToMatch('next')} disabled={matchLineIndexes.length === 0}>
              <ChevronDown size={12} strokeWidth={2} />
            </button>
            <button className="icon-btn" title="Close search" onClick={closeSearch}>
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      <div className="log-panel" ref={panelRef} onScroll={onScroll} tabIndex={0}>
        {lines.length === 0 ? (
          <div className="log-empty">
            {which==='current' ? 'No output. Start Work to begin.' : 'No previous session.'}
          </div>
        ) : (
          lines.map((line, i) => (
            <LogLine
              key={i}
              line={line}
              searchRegex={searchRegex}
              isActiveMatch={matchLineIndexes[activeMatchIndex] === i}
              lineRef={(node) => {
                if (node) lineRefs.current.set(i, node);
                else lineRefs.current.delete(i);
              }}
            />
          ))
        )}
      </div>

      {meta?.current && meta.current.size > 0 && (
        <div className="log-footer">{(meta.current.size/1024).toFixed(1)} KB</div>
      )}
    </div>
  );
});

export default memo(LogViewer);
