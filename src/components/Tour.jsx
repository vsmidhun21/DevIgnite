import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'step-1',
    target: '[data-tour="add-project"]',
    title: 'Welcome to DevIgnite 🚀',
    message: 'Create your first project to start managing your workflow.',
    position: 'right'
  },
  {
    id: 'step-2',
    target: '[data-tour="project-item"]',
    title: 'Select Project',
    message: 'Select the project in the sidebar to view details and manage it.',
    position: 'right',
    condition: () => document.querySelector('[data-tour="project-item"]')
  },
  {
    id: 'step-3',
    target: '[data-tour="start-work"]',
    title: 'Start Work',
    message: 'Launch all configured processes for this project with a single click.',
    position: 'right',
    condition: () => document.querySelector('[data-tour="start-work"]')
  },
  {
    id: 'step-4',
    target: '[data-tour="custom-commands"]',
    title: 'Custom Toolbox',
    message: 'Add custom buttons and commands to automate your frequent tasks.',
    position: 'top',
    condition: () => document.querySelector('[data-tour="custom-commands"]')
  },
  {
    id: 'step-5',
    target: '[data-tour="help-menu"]',
    title: 'Need Help?',
    message: 'Access help, updates, and support anytime from the menu.',
    position: 'bottom'
  }
];

export default function Tour({ isActive, onComplete }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef(null);

  const steps = TOUR_STEPS.filter(step => !step.condition || step.condition());
  const currentStep = steps[currentStepIndex];

  const updatePosition = useCallback(() => {
    if (!currentStep) return;
    const targetEl = document.querySelector(currentStep.target);
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isActive) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      // Check every 500ms in case the target element appears late
      const interval = setInterval(updatePosition, 500);
      
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
        clearInterval(interval);
      };
    }
  }, [isActive, updatePosition]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleSkip();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    localStorage.setItem('hasSeenTour', 'true');
    onComplete();
  };

  if (!isActive || !visible || !currentStep) return null;

  const getTooltipStyle = () => {
    const gap = 12;
    if (currentStep.position === 'right') {
      return {
        top: coords.top + coords.height / 2,
        left: coords.left + coords.width + gap,
        transform: 'translateY(-50%)'
      };
    }
    if (currentStep.position === 'bottom') {
      return {
        top: coords.top + coords.height + gap,
        left: coords.left + coords.width / 2,
        transform: 'translateX(-50%)'
      };
    }
    if (currentStep.position === 'top') {
      return {
        top: coords.top - gap,
        left: coords.left + coords.width / 2,
        transform: 'translate(-50%, -100%)'
      };
    }
    return { top: coords.top, left: coords.left };
  };

  return ReactDOM.createPortal(
    <div className="tour-container">
      <div 
        className="tour-highlight" 
        style={{
          top: coords.top - 4,
          left: coords.left - 4,
          width: coords.width + 8,
          height: coords.height + 8
        }}
      />
      <div className={`tour-tooltip tour-pos-${currentStep.position}`} style={getTooltipStyle()}>
        <div className="tour-content">
          <div className="tour-header">
            <h3>{currentStep.title}</h3>
            <button className="tour-close" onClick={handleSkip} title="Skip Tour">
              <X size={14} />
            </button>
          </div>
          <p>{currentStep.message}</p>
          <div className="tour-footer">
            <span className="tour-progress">
              {currentStepIndex + 1} / {steps.length}
            </span>
            <div className="tour-btns">
              {currentStepIndex > 0 && (
                <button className="tour-btn secondary" onClick={handleBack}>
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <button className="tour-btn primary" onClick={handleNext}>
                {currentStepIndex === steps.length - 1 ? (
                  <>Finish <Check size={14} /></>
                ) : (
                  <>Next <ChevronRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
