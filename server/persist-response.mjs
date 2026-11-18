export const persistBeforeResponse = saveDatabase => (req, res, next) => {
  const end = res.end.bind(res);
  let ending = false;
  res.end = (chunk, encoding, callback) => {
    if (ending) return res;
    ending = true;
    void saveDatabase().then(() => end(chunk, encoding, callback)).catch(error => {
      console.error('Neon save failed:', error);
      if (res.headersSent) return res.destroy(error);
      res.statusCode = 503;
      res.removeHeader('Set-Cookie');
      res.removeHeader('Content-Length');
      res.setHeader('Content-Type', 'application/json');
      end(JSON.stringify({ error: 'Could not save to Neon. Try again shortly.' }));
    });
    return res;
  };
  next();
};
