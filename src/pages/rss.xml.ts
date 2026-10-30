import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const news = await getCollection('news');
  const sortedNews = news.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Ro Halfhide - Latest News',
    description: 'Official news, song releases, videos, and artistic updates from Ro Halfhide.',
    site: context.site || 'https://rohalfhide.com',
    items: sortedNews.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/news/${post.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
