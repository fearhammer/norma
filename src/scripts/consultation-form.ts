const subject = 'Заявка с сайта Norma';

document.querySelectorAll<HTMLFormElement>('.consultation-form').forEach(form => {
  const status = form.querySelector<HTMLElement>('.form-status')!;
  const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const buttonText = button.innerHTML;
  const endpoint = form.dataset.endpoint;
  let busy = false;
  let token = '';
  let receivedAt = 0;
  let challengeRequest: Promise<void> | null = null;

  function showStatus(message: string, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
    status.hidden = false;
  }

  async function request(options: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint!, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось отправить заявку. Попробуйте позже.');
      return result;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function prepare() {
    if (token && Date.now() - receivedAt < 25 * 60 * 1000) return;
    if (!challengeRequest) {
      challengeRequest = request().then(result => {
        if (typeof result.token !== 'string' || !result.token) throw new Error('Не удалось подготовить форму.');
        token = result.token;
        receivedAt = Date.now();
      }).finally(() => { challengeRequest = null; });
    }
    await challengeRequest;
  }

  // Load protection only when the visitor starts interacting with this form.
  if (endpoint) form.addEventListener('focusin', () => { void prepare().catch(() => {}); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) || '').trim();
    const page = window.location.origin + window.location.pathname;
    if (!endpoint) {
      const body = [form.dataset.greeting || 'Здравствуйте!', '', `Имя: ${value('name')}`, `Email: ${value('email')}`,
        `Telegram: ${value('telegram') || 'не указан'}`, `Сайт компании: ${value('website') || 'не указан'}`,
        `Услуга: ${form.dataset.subject || ''}`, `Страница: ${page}`].join('\r\n');
      window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showStatus('Письмо подготовлено. Отправьте его из почтовой программы. Если она не открылась, напишите нам в Telegram.');
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = 'Отправляем…';
    form.setAttribute('aria-busy', 'true');
    showStatus('Отправляем заявку…');
    try {
      await prepare();
      const remaining = 3100 - (Date.now() - receivedAt);
      if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining));
      const result = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: value('name'), email: value('email'), telegram: value('telegram'), website: value('website'),
        company_fax: value('company_fax'), service: form.dataset.subject || '', page, token,
      }) });
      if (result.ok !== true) throw new Error('Не удалось подтвердить отправку. Попробуйте позже.');
      form.reset();
      showStatus('Спасибо! Заявка отправлена. Мы свяжемся с вами.');
    } catch (error) {
      const networkFailure = error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
      showStatus(networkFailure ? 'Не удалось подтвердить отправку. Проверьте соединение и попробуйте ещё раз или напишите в Telegram.' : error instanceof Error ? error.message : 'Не удалось отправить заявку. Напишите нам в Telegram.', true);
    } finally {
      token = '';
      busy = false;
      button.disabled = false;
      button.innerHTML = buttonText;
      form.removeAttribute('aria-busy');
    }
  });
});
