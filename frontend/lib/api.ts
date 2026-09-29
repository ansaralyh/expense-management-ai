import { User } from '../types';

function apiBase() {
  // Same-origin in the browser so Next rewrites /api/* to Express. Avoids CORS to :5000.
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({} as { message?: string }));
}

async function browserFetch(path: string, options: RequestInit = {}) {
  try {
    return await fetch(`${apiBase()}${path}`, { cache: 'no-store', ...options });
  } catch {
    throw new ApiError(
      'Cannot reach the API. Keep the app on http://localhost:3000 and start the backend with `npm run dev` in /backend.',
      0
    );
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smartfin_token') : null;
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await browserFetch(path, {
    ...options,
    headers,
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(data.message || 'Request failed.', response.status);
  }

  return data as T;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smartfin_token') : null;
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await browserFetch(path, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(data.message || 'Upload failed.', response.status);
  }

  return data as T;
}

export async function apiDownload(path: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smartfin_token') : null;
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await browserFetch(path, { headers });

  if (!response.ok) {
    const data = await parseJson(response);
    throw new ApiError(data.message || 'Download failed.', response.status);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await parseJson(response);
    throw new ApiError(data.message || 'Download failed.', response.status);
  }

  const blob = await response.blob();
  if (blob.size < 64) {
    throw new ApiError('Download failed. The file from the server was empty or invalid.', response.status);
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type AuthResponse = {
  status: string;
  message?: string;
  token: string;
  user: User;
};

export type MeResponse = {
  status: string;
  user: User;
};
