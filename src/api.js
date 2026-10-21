export async function api(path, { method = 'GET', data, signal } = {}) {
  const response = await fetch(path, {
    method, signal,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Не удалось выполнить запрос.');
  return body;
}
