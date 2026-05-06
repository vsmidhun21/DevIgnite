import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, Check } from 'lucide-react';

const api = window.devignite;

// ── Step definitions ──────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: 'add-project',
    target: '[data-tour="add-project"]',
    title: 'Welcome to DevIgnite',
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
    condition: ({ projects, selectedId }) => projects.length > 0 && !selectedId,
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
    title: 'Need Help?',
    message: "You're all set! Access help, updates, and support anytime from the Help menu.",
    position: 'bottom',
    waitEvent: null, 
    condition: () => true,
  },
];

function getTooltipStyle(pos, coords) {
  const gap = 14;
  switch (pos) {
    case 'right':
      return { top: coords.top + coords.height / 2, left: coords.left + coords.width + gap, transform: 'translateY(-50%)' };
    case 'bottom':
      return { top: coords.top + coords.height + gap, left: coords.left + coords.width / 2, transform: 'translateX(-50%)' };
    case 'top':
      return { top: coords.top - gap, left: coords.left + coords.width / 2, transform: 'translate(-50%, -100%)' };
    case 'left':
      return { top: coords.top + coords.height / 2, left: coords.left - gap, transform: 'translate(-100%, -50%)' };
    default:
      return { top: coords.top, left: coords.left };
  }
}

export default function Tour({ isActive, projects, selectedId, onComplete }) {
  const [stepIndex, setStepIndex]   = useState(0);
  const [coords,    setCoords]      = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [visible,   setVisible]     = useState(false);
  const [loaded,    setLoaded]      = useState(false);
  const [done,      setDone]        = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [helpOverride, setHelpOverride] = useState(false);
  
  const pollRef  = useRef(null);
  const stepRef  = useRef(stepIndex);
  stepRef.current = stepIndex;

  const ctx = useMemo(() => ({ projects, selectedId }), [projects, selectedId]);

  const persist = useCallback(async (patch) => {
    await api.tour.saveState(patch);
  }, []);

  const advanceStep = useCallback(() => {
    const next = stepRef.current + 1;
    if (next >= TOUR_STEPS.length) {
      completeTour();
    } else {
      setStepIndex(next);
      persist({ tourCompleted: false, currentStep: next, skipped: false });
    }
  }, [persist]);

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

  useEffect(() => {
    if (!isActive) {
      setDone(false);
      setLoaded(false);
      return;
    }
    api.tour.getState().then(state => {
      if (state.tourCompleted || state.skipped) {
        setDone(true);
        onComplete?.();
        return;
      }
      setStepIndex(Math.min(state.currentStep ?? 0, TOUR_STEPS.length - 1));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [isActive, onComplete]);

  useEffect(() => {
    const onOpen = () => { setVisible(false); setIsModalOpen(true); };
    const onClose = () => {
      setIsModalOpen(false);
      if (stepRef.current === 0) {
        setHelpOverride(true);
        const helpIdx = TOUR_STEPS.findIndex(s => s.id === 'help-menu');
        setStepIndex(helpIdx);
        persist({ tourCompleted: false, currentStep: helpIdx, skipped: true });
      }
    };
    window.addEventListener('tour:modalOpened', onOpen);
    window.addEventListener('tour:modalClosed', onClose);
    return () => {
      window.removeEventListener('tour:modalOpened', onOpen);
      window.removeEventListener('tour:modalClosed', onClose);
    };
  }, [persist]);

  const rawStep = TOUR_STEPS[stepIndex] ?? null;
  const currentStep = useMemo(() => {
    if (!rawStep) return null;
    if (rawStep.id === 'add-project' && isModalOpen) {
      return {
        ...rawStep,
        target: '[data-tour="add-project-modal"]',
        title: 'Project Wizard',
        message: 'Fill project details to continue',
        position: 'right',
      };
    }
    if (rawStep.id === 'help-menu' && helpOverride) {
      return {
        ...rawStep,
        message: 'You can restart the guide anytime from Help',
      };
    }
    return rawStep;
  }, [rawStep, isModalOpen, helpOverride]);

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

  useEffect(() => {
    if (!isActive || !loaded || done || !currentStep) return;
    if (currentStep.condition && !currentStep.condition(ctx)) {
      advanceStep();
    }
  }, [isActive, loaded, done, stepIndex, currentStep, ctx, advanceStep]);

  useEffect(() => {
    if (!isActive || !loaded || done || !currentStep?.waitEvent) return;
    const handler = () => advanceStep();
    window.addEventListener(currentStep.waitEvent, handler);
    return () => window.removeEventListener(currentStep.waitEvent, handler);
  }, [isActive, loaded, done, currentStep?.waitEvent, advanceStep]);

  if (!isActive || !loaded || done || !visible || !currentStep) return null;

  return ReactDOM.createPortal(
    <div className="tour-container">
      <svg className="tour-backdrop" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={coords.left - 6} y={coords.top - 6} width={coords.width + 12} height={coords.height + 12} rx="6" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#tour-mask)" />
      </svg>
      <div className="tour-highlight" style={{ top: coords.top - 6, left: coords.left - 6, width: coords.width + 12, height: coords.height + 12 }} />
      <div className={`tour-tooltip tour-pos-${currentStep.position}`} style={getTooltipStyle(currentStep.position, coords)}>
        <div className="tour-content">
          <div className="tour-header">
            <h3>{currentStep.title}</h3>
            <button className="tour-close" onClick={skipTour}><X size={13} /></button>
          </div>
          <p>{currentStep.message}</p>
          <div className="tour-footer">
            <div className="tour-dots">
              {TOUR_STEPS.map((_, i) => (
                <span key={i} className={`tour-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`} />
              ))}
            </div>
            <div className="tour-btns">
              <button className="tour-btn ghost" onClick={skipTour}>Skip</button>
              {stepIndex === TOUR_STEPS.length - 1 ? (
                <button className="tour-btn primary" onClick={completeTour}>Finish <Check size={13} /></button>
              ) : (
                <button className="tour-btn secondary" onClick={advanceStep}>Next →</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
