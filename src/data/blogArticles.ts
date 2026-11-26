import type { ImageMetadata } from 'astro';
import expertArticlesGuideCover from '../assets/photos/expert-articles/hero.jpg';
import expertArticlesGuide from './expert-articles-guide.json';
export { expertArticlesGuideCover };
import costArticleCover from '../assets/photos/team-discussion.jpg';
import strategyGuideCover from '../assets/photos/content-strategy/hero.jpg';
import strategyGuide from './strategy-guide.json';
export { strategyGuideCover };
import marketingGuideCover from '../assets/photos/content-marketing/benefits.jpg';
import marketingGuide from './content-marketing-guide.json';
export { marketingGuideCover };
import corporateBlogCover from '../assets/photos/content-marketing/channels.jpg';
import corporateBlogGuide from './corporate-blog-guide.json';
export { corporateBlogCover };
import leadsArticleCover from '../assets/photos/seo-promotion/window-discussion.jpg';
export { leadsArticleCover };
export { costArticleCover };

export interface BlogArticleCard {
  slug: string;
  title: string;
  description: string;
  dateTime: string;
  readingTime: string;
  featured?: boolean;
  cover?: ImageMetadata;
  status: 'published' | 'preview' | 'draft';
}

// Only published materials appear on the site.
export const blogArticles: BlogArticleCard[] = [
  { cover: expertArticlesGuideCover, slug: 'ekspertnye-stati-dlya-biznesa', title: expertArticlesGuide.title, description: expertArticlesGuide.description, dateTime: '2026-11-25', readingTime: expertArticlesGuide.readingTime, featured: true, status: 'published' },
  { cover: strategyGuideCover, slug: 'kontent-strategiya-primer-shablon', title: strategyGuide.title, description: strategyGuide.description, dateTime: '2026-11-23', readingTime: strategyGuide.readingTime, featured: true, status: 'published' },
  { cover: marketingGuideCover, slug: 'kontent-marketing-dlya-biznesa', title: marketingGuide.title, description: marketingGuide.description, dateTime: '2026-11-20', readingTime: marketingGuide.readingTime, featured: true, status: 'published' },
  { cover: corporateBlogCover, slug: 'korporativnyj-blog-kompanii', title: corporateBlogGuide.title, description: corporateBlogGuide.description, dateTime: '2026-11-19', readingTime: corporateBlogGuide.readingTime, featured: true, status: 'published' },
  { cover: leadsArticleCover, slug: 'blog-chitayut-a-zayavok-net', title: "Блог читают, а заявок нет: почему это происходит и как это исправить", description: "Разбираем 8 причин, почему статьи в корпоративном блоге собирают трафик, но не приводят клиентов в B2B. Пошаговый план аудита, реальные кейсы и настройка воронки.", dateTime: '2026-11-18', readingTime: '14 минут', featured: true, status: 'published' },
  {cover: costArticleCover,"slug":"skolko-stoit-kontent-marketing-autsors","title":"Сколько стоит контент-маркетинг на аутсорсе: из чего складывается бюджет","description":"Разбираем реальную стоимость контент-маркетинга на аутсорсе: из чего складывается бюджет, какие скрытые часы тратит команда, сравнение со штатом и фрилансом.","dateTime":"2026-11-18","readingTime":"15 минут","featured":true,"status":"published"},
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
