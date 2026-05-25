export const config = {
  maxDuration: 60
};

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = import('../server/app.js').then(({ createApp }) => createApp());
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('Vercel function boot failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      error: 'FUNCTION_BOOT_FAILED',
      message: error.message || 'Unknown boot error'
    }));
  }
}
