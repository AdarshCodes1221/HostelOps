/**
 * NoSQL Query Injection Sanitizer Middleware
 * Recursively inspects req.body, req.query, and req.params, stripping out
 * keys that begin with '$' or contain '.' which could be used for MongoDB operator injection.
 */

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Prohibit keys starting with $ or containing . (MongoDB operator/path injection)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = cleanObject(value);
  }
  return clean;
}

module.exports = function mongoSanitize(req, res, next) {
  if (req.body) {
    req.body = cleanObject(req.body);
  }
  if (req.query) {
    req.query = cleanObject(req.query);
  }
  if (req.params) {
    req.params = cleanObject(req.params);
  }
  next();
};
