import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { scanDocs } from '../../../server/utils/docs';

const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const docs = await scanDocs();
  return docs.map((doc) => `/docs/${doc.slug}`);
};

export default onBeforePrerenderStart;
