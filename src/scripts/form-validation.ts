type ValidatableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isValidatable(el: EventTarget | null): el is ValidatableControl {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

function initFormValidation() {
  const supportsUserInvalid =
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:user-invalid)');

  if (supportsUserInvalid) {
    const syncAria = (target: EventTarget | null) => {
      if (!isValidatable(target) || target.type === 'hidden') return;
      const invalid = target.matches(':user-invalid');
      if (invalid) {
        target.setAttribute('aria-invalid', 'true');
      } else {
        target.removeAttribute('aria-invalid');
      }
    };

    document.addEventListener('blur', (e) => syncAria(e.target), true);
    document.addEventListener('input', (e) => {
      if (isValidatable(e.target) && e.target.hasAttribute('aria-invalid')) {
        syncAria(e.target);
      }
    });
    return;
  }

  // Fallback for older browsers without :user-invalid
  const dirtyState = new WeakMap<ValidatableControl, { hasInteracted: boolean; hasBlurred: boolean }>();

  const updateFallbackState = (control: ValidatableControl) => {
    const valid = control.checkValidity();
    control.classList.toggle('user-invalid-fallback', !valid);
    control.classList.toggle('user-valid-fallback', valid);
    if (!valid) {
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-invalid');
    }
  };

  document.addEventListener(
    'blur',
    (e) => {
      if (!isValidatable(e.target) || e.target.type === 'hidden') return;
      const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(e.target, state);
      if (state.hasInteracted) updateFallbackState(e.target);
    },
    true
  );

  const onEdit = (e: Event) => {
    if (!isValidatable(e.target) || e.target.type === 'hidden') return;
    const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
    state.hasInteracted = true;
    dirtyState.set(e.target, state);
    if (state.hasBlurred) updateFallbackState(e.target);
  };

  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);
  document.addEventListener(
    'reset',
    (e) => {
      if (!(e.target instanceof HTMLFormElement)) return;
      Array.from(e.target.elements).forEach((el) => {
        if (!isValidatable(el)) return;
        dirtyState.delete(el);
        el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        el.removeAttribute('aria-invalid');
      });
    },
    true
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFormValidation);
} else {
  initFormValidation();
}
