import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Play,
  Square,
  Code2,
  Terminal,
  RefreshCw,
  Folder,
  Globe,
  Command
} from 'lucide-react';

const api = window.devignite;

function scoreTextMatch(query, ...parts) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const haystack = parts.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return -1;
  if (haystack.includes(q)) return 100 - haystack.indexOf(q);

  let cursor = 0;
  let score = 0;
  for (const char of q) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return -1;
    score += Math.max(1, 8 - (index - cursor));
    cursor = index + 1;
  }

  return score;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  projects,
  groups,
  onSelectProject,
  onSelectGroup,
  startWork,
  stopWork,
  onRestartProject,
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo(() => {
    const baseItems = [];

    projects.forEach((project) => {
      const running = project.status === 'running' || project.status === 'starting';

      baseItems.push({
        id: `project-${project.id}`,
        icon: <Code2 size={14} />,
        label: project.name,
        desc: project.path,
        typeLabel: 'Project',
        searchText: [project.name, project.path, project.type, project.tag, 'project'],
        action: () => {
          onSelectProject(project.id);
          onClose();
        }
      });

      baseItems.push({
        id: `command-start-${project.id}`,
        icon: <Play size={14} />,
        label: `Start ${project.name}`,
        desc: project.type || 'Command',
        typeLabel: 'Command',
        searchText: [project.name, project.type, project.tag, 'start run launch command'],
        disabled: running,
        action: () => {
          startWork(project.id);
          onClose();
        }
      });

      baseItems.push({
        id: `command-stop-${project.id}`,
        icon: <Square size={14} />,
        label: `Stop ${project.name}`,
        desc: project.type || 'Command',
        typeLabel: 'Command',
        searchText: [project.name, project.type, project.tag, 'stop halt command'],
        disabled: !running,
        action: () => {
          stopWork(project.id);
          onClose();
        }
      });

      baseItems.push({
        id: `command-restart-${project.id}`,
        icon: <RefreshCw size={14} />,
        label: `Restart ${project.name}`,
        desc: project.type || 'Command',
        typeLabel: 'Command',
        searchText: [project.name, project.type, project.tag, 'restart reload command'],
        disabled: !running,
        action: () => {
          onRestartProject(project.id);
          onClose();
        }
      });

      baseItems.push({
        id: `command-ide-${project.id}`,
        icon: <Command size={14} />,
        label: `Open IDE for ${project.name}`,
        desc: project.ide || 'IDE',
        typeLabel: 'Command',
        searchText: [project.name, project.ide, project.type, project.tag, 'ide editor code command'],
        action: () => {
          api.work.openIDE(project.id);
          onClose();
        }
      });

      baseItems.push({
        id: `command-terminal-${project.id}`,
        icon: <Terminal size={14} />,
        label: `Open Terminal for ${project.name}`,
        desc: project.path,
        typeLabel: 'Command',
        searchText: [project.name, project.path, project.type, project.tag, 'terminal shell console command'],
        action: () => {
          api.work.openTerminal(project.id);
          onClose();
        }
      });

      if (project.url) {
        baseItems.push({
          id: `command-browser-${project.id}`,
          icon: <Globe size={14} />,
          label: `Open Browser for ${project.name}`,
          desc: project.url,
          typeLabel: 'Command',
          searchText: [project.name, project.url, 'browser url open command'],
          action: () => {
            api.work.openBrowser(project.id);
            onClose();
          }
        });
      }
    });

    groups.forEach((group) => {
      baseItems.push({
        id: `group-${group.id}`,
        icon: <Folder size={14} />,
        label: group.name,
        desc: `${group.projectIds.length} projects`,
        typeLabel: 'Workspace',
        searchText: [group.name, group.color, 'workspace group'],
        action: () => {
          onSelectGroup(group.id);
          onClose();
        }
      });
    });

    return baseItems
      .map((item) => ({
        ...item,
        score: scoreTextMatch(debouncedQuery, item.label, item.desc, item.typeLabel, ...(item.searchText || []))
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 40);
  }, [debouncedQuery, groups, onClose, onRestartProject, onSelectGroup, onSelectProject, projects, startWork, stopWork]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex] && !items[selectedIndex].disabled) {
        items[selectedIndex].action();
      }
    }
  };

  useEffect(() => {
    if (listRef.current && items.length > 0) {
      const activeEl = listRef.current.children[selectedIndex];
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, items.length]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose} style={{ zIndex: 1000, alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div className="modal-content" onMouseDown={e => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw', background: 'var(--bg1)', border: '1px solid var(--b0)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRadius: '8px', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--b0)' }}>
          <Search size={16} style={{ color: 'var(--t2)', marginRight: '12px' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, workspaces, or commands..."
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--t0)', fontSize: '14px', outline: 'none' }}
          />
        </div>

        {items.length > 0 && (
          <div ref={listRef} className="global-search-list">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`global-search-item ${i === selectedIndex ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => !item.disabled && item.action()}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="global-search-item-icon">{item.icon}</div>
                <div className="global-search-item-copy">
                  <span className="global-search-item-label">{item.label}</span>
                  {item.desc && <span className="global-search-item-desc">{item.desc}</span>}
                </div>
                <span className="global-search-item-type">{item.disabled ? 'Unavailable' : item.typeLabel}</span>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t2)', fontSize: '13px' }}>
            {debouncedQuery ? `No results found for "${debouncedQuery}"` : 'Type to search projects, workspaces, and commands.'}
          </div>
        )}
      </div>
    </div>
  );
}
