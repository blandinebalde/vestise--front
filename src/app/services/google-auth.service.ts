import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId?: string;
}

export type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with';

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: GoogleButtonText;
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private scriptLoadPromise: Promise<void> | null = null;
  private configCache: GoogleAuthConfig | null = null;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<GoogleAuthConfig> {
    return this.http.get<GoogleAuthConfig>(`${API_URL}/auth/google-config`);
  }

  async loadConfig(): Promise<GoogleAuthConfig> {
    if (this.configCache) {
      return this.configCache;
    }
    try {
      this.configCache = await firstValueFrom(this.getConfig());
    } catch {
      this.configCache = { enabled: false };
    }
    return this.configCache;
  }

  private loadScript(): Promise<void> {
    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }
    this.scriptLoadPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.getElementById('google-gsi-client');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google script failed')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google script failed'));
      document.head.appendChild(script);
    });
    return this.scriptLoadPromise;
  }

  async renderButton(
    host: HTMLElement,
    options: {
      text: GoogleButtonText;
      onCredential: (idToken: string) => void;
      onUnavailable?: (reason: string) => void;
    }
  ): Promise<void> {
    const config = await this.loadConfig();
    if (!config.enabled || !config.clientId) {
      options.onUnavailable?.('La connexion Google n’est pas disponible pour le moment.');
      return;
    }

    await this.loadScript();
    if (!window.google?.accounts?.id) {
      options.onUnavailable?.('Impossible de charger Google Sign-In.');
      return;
    }

    host.innerHTML = '';
    const width = Math.max(280, Math.min(host.offsetWidth || host.parentElement?.clientWidth || 360, 400));

    window.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: (response) => {
        if (response?.credential) {
          options.onCredential(response.credential);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });

    window.google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: options.text,
      width,
      locale: 'fr'
    });
  }
}
