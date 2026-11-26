const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Terjadi kesalahan. Coba lagi.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  bootstrap: () => request('/bootstrap'),
  nextQueue: () => request('/queue/next'),
  resetQueuePublic: () => request('/queue/reset', { method: 'POST' }),
  createOrder: (payload) => request('/transactions', { method: 'POST', body: payload }),

  session: () => request('/admin/session'),
  login: (password) => request('/admin/login', { method: 'POST', body: { password } }),
  logout: () => request('/admin/logout', { method: 'POST' }),

  adminProducts: () => request('/admin/products'),
  createProduct: (payload) => request('/admin/products', { method: 'POST', body: payload }),
  updateProduct: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: payload }),
  deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),

  adminSettings: () => request('/admin/settings'),
  saveSettings: (payload) => request('/admin/settings', { method: 'PUT', body: payload }),

  changePassword: (current, next) => request('/admin/password', { method: 'POST', body: { current, next } }),
  resetQueue: () => request('/admin/queue/reset', { method: 'POST' }),

  transactions: ({ period, date }) =>
    request(`/admin/transactions?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`),
  transaction: (id) => request(`/admin/transactions/${id}`),
  voidTransaction: (id) => request(`/admin/transactions/${id}/void`, { method: 'POST' }),
};
