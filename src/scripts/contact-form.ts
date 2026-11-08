function initContactForm() {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const submitBtn = document.getElementById('contact-submit') as HTMLButtonElement | null;
  const statusEl = document.getElementById('contact-status');
  const subjectSelect = document.getElementById('contact-subject') as HTMLSelectElement | null;
  const bookingHint = document.getElementById('booking-hint');
  const messageInput = document.getElementById('contact-message') as HTMLTextAreaElement | null;
  const nameInput = document.getElementById('contact-name') as HTMLInputElement | null;

  const updateBookingHint = () => {
    if (!subjectSelect || !bookingHint) return;
    bookingHint.classList.toggle('hidden', subjectSelect.value !== 'Booking & Live Shows');
  };

  if (subjectSelect && bookingHint) {
    subjectSelect.addEventListener('change', updateBookingHint);
    updateBookingHint();
  }

  const applyPrefill = (subject?: string, message?: string) => {
    if (subject && subjectSelect) {
      const hasOption = Array.from(subjectSelect.options).some((o) => o.value === subject);
      if (hasOption) {
        subjectSelect.value = subject;
        updateBookingHint();
      }
    }
    if (message && messageInput) {
      messageInput.value = message;
    }
  };

  const params = new URLSearchParams(window.location.search);
  const urlSubject = params.get('subject') || undefined;
  const urlIdea = params.get('idea') || undefined;
  if (urlSubject || urlIdea) {
    applyPrefill(
      urlSubject,
      urlIdea ? `Hi Ro,\n\nI'd love to discuss or collaborate around the song idea "${urlIdea}".\n\n` : undefined
    );
  }

  window.addEventListener('ro-contact:prefill', (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    applyPrefill(detail.subject, detail.message);
    setTimeout(() => nameInput?.focus({ preventScroll: true }), 250);
  });

  if (!form || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const originalLabel = submitBtn.textContent || 'Send Message';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    if (statusEl) {
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
    }

    try {
      const formData = new FormData(form);
      const encoded = new URLSearchParams();
      const payload: Record<string, string> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          encoded.append(key, value);
          payload[key] = value;
        }
      });

      const [apiResult, netlifyResult] = await Promise.allSettled([
        fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch('/__forms.html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encoded.toString(),
        }),
      ]);

      const apiOk =
        apiResult.status === 'fulfilled' &&
        (apiResult.value.status === 200 || apiResult.value.status === 202);
      const netlifyOk = netlifyResult.status === 'fulfilled' && netlifyResult.value.ok;

      if (apiOk || netlifyOk) {
        window.location.assign('/success');
        return;
      }

      throw new Error('Both submission endpoints failed.');
    } catch {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      if (statusEl) {
        statusEl.textContent =
          'Could not send message right now. Please try again or email halfhide@gmail.com directly.';
        statusEl.classList.remove('hidden');
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContactForm);
} else {
  initContactForm();
}
