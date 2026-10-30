import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    mediaType: z.enum(['standard', 'audio', 'video']).default('standard'),
    mediaEmbedUrl: z.string().optional(),
    mediaPlatform: z.enum(['soundcloud', 'youtube']).optional(),
  }),
});

export const collections = {
  news: newsCollection,
};
