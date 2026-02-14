import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { scanCategories, scanDocs } from '../../../server/utils/docs';

const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const categories = await scanCategories();
  const docs = await scanDocs(categories);
  return docs.map((doc) => `/docs/${doc.slug}`);
};

export default onBeforePrerenderStart;
