import { createApp } from '../server/app.js';

const app = createApp();

export const config = {
  maxDuration: 60
};

export default app;
