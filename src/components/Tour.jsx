import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Check } from 'lucide-react';

const api = window.devignite;

// ── Step definitions ──────────────────────────────────────────────────────────
// Each step declares:
//   target   : CSS selector to highlight
//   title    : tooltip heading
//   message  : tooltip body
//   position : 'right' | 'bottom' | 'top' | 'left'
//   waitEvent: the event name that advances to the next step (set in App.jsx)
//   condition: fn → bool — if false, skip this step automatically
const TOUR_STEPS = [
  {
    id: 'add-project',
    target: '[data-tour="add-project"]',
    title: 'Welcome to DevIgnite 🚀',
    message: 'Start by adding your first project. Click the + button to open the project wizard.',
    position: 'right',
    waitEvent: 'tour:projectCreated',
    condition: ({ projects }) => projects.length === 0,
  },
  {
    id: 'select-project',
    target: '[data-tour="project-item"]',
    title: 'Select a Project',
    message: 'Click any project in the sidebar to open its detail view.',
    position: 'right',
    waitEvent: 'tour:projectSelected',
    condition: ({ projects }) => projects.length > 0,
  },
  {
    id: 'start-work',
    target: '[data-tour="start-work"]',
    title: 'Launch Your Project',
    message: 'Hit Start Work to spin up all configured processes for this project in one click.',
    position: 'bottom',
    waitEvent: 'tour:startWorkClicked',
    condition: ({ selectedId }) => selectedId != null,
  },
  {
    id: 'custom-commands',
    target: '[data-tour="custom-commands"]',
    title: 'Custom Toolbox',
    message: 'Add custom buttons here to automate frequent tasks like build, test, or deploy.',
    position: 'top',
    waitEvent: 'tour:customCommandClicked',
    condition: ({ selectedId }) => selectedId != null,
  },
  {
    id: 'help-menu',
    target: '[data-tour="help-menu"]',
    title: 'Need Help? 🎉',
    message: "You're all set! Access help, updates, and support anytime from the Help menu.",
    position: 'bottom',
    waitEvent: null, // final step — completed by Finish button
    condition: () => true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTooltipStyle(pos, coords) {
  const gap = 14;
  switch (pos) {
    case 'right':
      return {
        top: coords.top + coords.height / 2,
        left: coords.left + coords.width + gap,
        transform: 'translateY(-50%)',
      };
    case 'bottom':
      return {
        top: coords.top + coords.height + gap,
        left: coords.left + coords.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'top':
      return {
        top: coords.top - gap,
        left: coords.left + coords.width / 2,
        transform: 'translate(-50%, -100%)',
      };
    case 'left':
      return {
        top: coords.top + coords.height / 2,
        left: coords.left - gap,
        transform: 'translate(-100%, -50%)',
      };
    default:
      return { top: coords.top, left: coords.left };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Tour({ isActive, projects, selectedId, onComplete }) {
  const [stepIndex, setStepIndex]   = useState(0);
  const [coords,    setCoords]      = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [visible,   setVisible]     = useState(false);
  const [loaded,    setLoaded]      = useState(false); // DB state has been fetched
  const [done,      setDone]        = useState(false); // tour fully completed/skipped
  const pollRef  = useRef(null);
  const stepRef  = useRef(stepIndex);
  stepRef.current = stepIndex;

  // ── Compute which steps are applicable given current app state ─────────────
  const ctx = { projects, selectedId };

  // Build the filtered, ordered list of active steps
  const activeSteps = TOUR_STEPS.filter(s => !s.condition || s.condition(ctx));
  const currentStep = activeSteps[stepIndex] ?? null;

  // ── Persist state to SQLite ────────────────────────────────────────────────
  const persist = useCallback(async (patch) => {
    await api.tour.saveState(patch);
  }, []);

  // ── Load state from SQLite on mount ───────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    api.tour.getState().then(state => {
      if (state.tourCompleted || state.skipped) {
        setDone(true);
        onComplete?.();
        return;
      }
      // Restore step, clamped to valid range
      const restored = Math.min(state.currentStep ?? 0, TOUR_STEPS.length - 1);
      setStepIndex(restored);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ── Position the highlight box around target element ──────────────────────
  const updatePosition = useCallback(() => {
    if (!currentStep) { setVisible(false); return; }
    const el = document.querySelector(currentStep.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [currentStep]);

  // Poll + event listeners for position updates
  useEffect(() => {
    if (!isActive || !loaded || done) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    pollRef.current = setInterval(updatePosition, 400);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      clearInterval(pollRef.current);
    };
  }, [isActive, loaded, done, updatePosition]);

  // ── Auto-skip step if condition not met (e.g. user already has projects) ──
  useEffect(() => {
    if (!isActive || !loaded || done || !currentStep) return;
    if (currentStep.condition && !currentStep.condition(ctx)) {
      advanceStep();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, loaded, done, stepIndex, projects, selectedId]);

  // ── Event-driven progression ───────────────────────────────────────────────
  // App fires custom DOM events; Tour listens and advances
  useEffect(() => {
    if (!isActive || !loaded || done || !currentStep?.waitEvent) return;

    const handler = () => advanceStep();
    window.addEventListener(currentStep.waitEvent, handler);
    return () => window.removeEventListener(currentStep.waitEvent, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, loaded, done, currentStep?.waitEvent, stepIndex]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const advanceStep = useCallback(() => {
    const next = stepRef.current + 1;
    if (next >= activeSteps.length) {
      completeTour();
    } else {
      setStepIndex(next);
      persist({ tourCompleted: false, currentStep: next, skipped: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSteps.length]);

  const completeTour = useCallback(async () => {
    setVisible(false);
    setDone(true);
    await persist({ tourCompleted: true, currentStep: 0, skipped: false });
    onComplete?.();
  }, [persist, onComplete]);

  const skipTour = useCallback(async () => {
    setVisible(false);
    setDone(true);
    await persist({ tourCompleted: false, currentStep: stepRef.current, skipped: true });
    onComplete?.();
  }, [persist, onComplete]);

  // ── Render guard ──────────────────────────────────────────────────────────
  if (!isActive || !loaded || done || !visible || !currentStep) return null;

  const isLast = stepIndex === activeSteps.length - 1;

  return ReactDOM.createPortal(
    <div className="tour-container" aria-label="Onboarding tour">
      {/* Backdrop cutout — dim everything, spotlight the target */}
      <svg
        className="tour-backdrop"
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={coords.left - 6}
              y={coords.top - 6}
              width={coords.width + 12}
              height={coords.height + 12}
              rx="6"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#tour-mask)" />
      </svg>

      {/* Highlight ring */}
      <div
        className="tour-highlight"
        style={{
          top:    coords.top  - 6,
          left:   coords.left - 6,
          width:  coords.width  + 12,
          height: coords.height + 12,
        }}
      />

      {/* Tooltip */}
      <div
        className={`tour-tooltip tour-pos-${currentStep.position}`}
        style={getTooltipStyle(currentStep.position, coords)}
        role="dialog"
        aria-modal="false"
        aria-label={currentStep.title}
      >
        <div className="tour-content">
          <div className="tour-header">
            <h3>{currentStep.title}</h3>
            <button
              className="tour-close"
              onClick={skipTour}
              title="Skip tour"
              aria-label="Skip tour"
            >
              <X size={13} />
            </button>
          </div>

          <p>{currentStep.message}</p>

          <div className="tour-footer">
            {/* Step dots */}
            <div className="tour-dots">
              {activeSteps.map((_, i) => (
                <span
                  key={i}
                  className={`tour-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`}
                />
              ))}
            </div>

            <div className="tour-btns">
              <button className="tour-btn ghost" onClick={skipTour}>
                Skip
              </button>
              {/* Only show manual Next/Finish when no waitEvent (final step) */}
              {isLast && (
                <button className="tour-btn primary" onClick={completeTour}>
                  Finish <Check size={13} />
                </button>
              )}
              {/* For non-final steps: show a "Next" that bypasses the event gate */}
              {!isLast && (
                <button className="tour-btn secondary" onClick={advanceStep}>
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
