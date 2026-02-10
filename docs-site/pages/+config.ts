import vikeReact from 'vike-react/config';
import type { Config } from 'vike/types';

export default {
  title: 'functional-examples',
  description:
    'A toolkit for managing, scanning, and validating code examples',
  prerender: true,
  passToClient: ['navigation'],
  extends: [vikeReact],
} satisfies Config;
