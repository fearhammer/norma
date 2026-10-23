export interface BlogArticleCard {
  slug: string;
  title: string;
  description: string;
  dateTime: string;
  readingTime: string;
  featured?: boolean;
  status: 'published' | 'preview' | 'draft';
}

// Preview records demonstrate the layout until real materials are added.
// Drafts never enter recommendations. Published pages use only published records.
export const blogArticles: BlogArticleCard[] = [
  {
    slug: 'kak-prodvigat-stati',
    title: 'Как продвигать статьи: подробное руководство по привлечению трафика и клиентов',
    description: 'Как вывести статью в топ поиска, выбрать тему для сложного B2B-продукта и привести из материала целевых посетителей?',
    dateTime: '2026-08-28',
    readingTime: '8 минут',
    featured: true,
    status: 'published',
  },
  {
    slug: 'ekspertiza-v-sistemnyy-kontent',
    title: 'Как превратить экспертизу компании в системный B2B-контент',
    description: 'Показываем путь от интервью с экспертами до регулярного выпуска материалов, которые объясняют ценность компании и помогают продажам.',
    dateTime: '2026-10-10',
    readingTime: '10 минут',
    featured: true,
    status: 'preview',
  },
  {
    slug: 'kontent-dlya-slozhnogo-produkta',
    title: 'Как рассказывать о сложном продукте понятно и точно',
    description: 'Разбираем, как соединить знания команды, вопросы клиентов и ясную структуру материала.',
    dateTime: '2026-09-20',
    readingTime: '9 минут',
    featured: true,
    status: 'preview',
  },
  {
    slug: 'statya-iz-ekspertizy',
    title: 'Как превратить экспертизу компании в полезный материал',
    description: 'Показываем путь от интервью с экспертами до статьи, которая отвечает на вопросы читателей и помогает продажам.',
    dateTime: '2026-09-12',
    readingTime: '7 минут',
    status: 'preview',
  },
  {
    slug: 'struktura-stati',
    title: 'Как подготовить структуру статьи до начала работы над текстом',
    description: 'Разбираемся, как собрать фактуру, выбрать главное и выстроить материал вокруг задачи аудитории.',
    dateTime: '2026-09-05',
    readingTime: '6 минут',
    status: 'preview',
  },
  {
    slug: 'sleduyushchiy-shag-chitatelya',
    title: 'Что читать после статьи: проектируем следующий шаг читателя',
    description: 'Связываем публикации, кейсы и страницы услуг так, чтобы человек мог продолжить изучение темы.',
    dateTime: '2026-08-25',
    readingTime: '5 минут',
    status: 'preview',
  },
  {
    slug: 'intervyu-s-ekspertom',
    title: 'Как провести интервью с экспертом для статьи',
    description: 'Готовим вопросы, уточняем сложные детали и превращаем разговор в проверенную фактуру.',
    dateTime: '2026-08-18',
    readingTime: '6 минут',
    status: 'preview',
  },
  {
    slug: 'obnovlenie-statey',
    title: 'Когда и как обновлять опубликованные статьи',
    description: 'Смотрим на запросы и поведение читателей, чтобы материал оставался точным и полезным.',
    dateTime: '2026-08-11',
    readingTime: '5 минут',
    status: 'preview',
  },
  {
    slug: 'temy-dlya-b2b-bloga',
    title: 'Как находить темы для B2B-блога',
    description: 'Ищем пересечение вопросов аудитории, опыта компании и задач маркетинга.',
    dateTime: '2026-08-04',
    readingTime: '7 минут',
    status: 'preview',
  },
];

const newestFirst = (a: BlogArticleCard, b: BlogArticleCard) =>
  b.dateTime.localeCompare(a.dateTime) || a.slug.localeCompare(b.slug);

export function getRelatedArticles(currentSlug: string, includePreviews = false) {
  const published = blogArticles
    .filter(article => article.slug !== currentSlug && article.status === 'published')
    .sort(newestFirst);
  const previews = includePreviews
    ? blogArticles.filter(article => article.slug !== currentSlug && article.status === 'preview').sort(newestFirst)
    : [];
  const candidates = [...published, ...previews];
  const selected = new Set<string>();
  const take = (pool: BlogArticleCard[]) => {
    const article = pool.find(item => !selected.has(item.slug));
    if (article) selected.add(article.slug);
    return article;
  };

  const takeFeature = () => take(published.filter(article => article.featured))
    ?? take(published)
    ?? take(previews.filter(article => article.featured))
    ?? take(previews);
  const firstFeature = takeFeature();
  const secondFeature = takeFeature();
  const remaining = candidates.filter(article => !selected.has(article.slug));

  return {
    firstFeature,
    firstRow: remaining.slice(0, 3),
    secondFeature,
    secondRow: remaining.slice(3, 6),
  };
}

export const blogArticleHref = (slug: string) => `${import.meta.env.BASE_URL}blog/${slug}/`;
export const blogArticleDate = (dateTime: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${dateTime}T00:00:00Z`));
