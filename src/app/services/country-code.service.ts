import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
}

interface RestCountry {
  name: { common: string };
  cca2: string;
  idd?: { root: string; suffixes: string[] };
}

const API_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,idd';

/** Retourne l'emoji drapeau pour un code pays ISO 3166-1 alpha-2 (ex: FR → 🇫🇷). */
export function getFlagEmoji(cca2: string): string {
  if (!cca2 || cca2.length !== 2) return '';
  const base = 0x1F1E6 - 65; // 'A' = 65
  return String.fromCodePoint(base + cca2.charCodeAt(0), base + cca2.charCodeAt(1));
}

@Injectable({
  providedIn: 'root'
})
export class CountryCodeService {
  private cache: CountryCode[] | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Récupère la liste des indicatifs pays depuis l'API RestCountries.
   * Résultat mis en cache après le premier chargement.
   */
  getCountryCodes(): Observable<CountryCode[]> {
    if (this.cache) {
      return of(this.cache);
    }
    return this.http.get<RestCountry[]>(API_URL).pipe(
      map((countries) => {
        const list: CountryCode[] = [];
        const seen = new Set<string>();
        for (const c of countries) {
          if (!c.idd || !c.idd.root || c.idd.root === '') continue;
          const root = c.idd.root.replace('+', '').trim();
          const suffixes = c.idd.suffixes || [];
          const dialCode = suffixes.length === 1
            ? '+' + root + suffixes[0]
            : '+' + root;
          if (seen.has(dialCode)) continue;
          seen.add(dialCode);
          list.push({
            code: c.cca2,
            name: c.name.common,
            dialCode
          });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.cache = list;
        return list;
      }),
      catchError(() => {
        this.cache = this.getFallbackList();
        return of(this.cache);
      })
    );
  }

  private getFallbackList(): CountryCode[] {
    return [
      { code: 'SN', name: 'Sénégal', dialCode: '+221' },
      { code: 'FR', name: 'France', dialCode: '+33' },
      { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225' },
      { code: 'CM', name: 'Cameroun', dialCode: '+237' },
      { code: 'ML', name: 'Mali', dialCode: '+223' },
      { code: 'BF', name: 'Burkina Faso', dialCode: '+226' },
      { code: 'NE', name: 'Niger', dialCode: '+227' },
      { code: 'TG', name: 'Togo', dialCode: '+228' },
      { code: 'BJ', name: 'Bénin', dialCode: '+229' },
      { code: 'US', name: 'États-Unis', dialCode: '+1' },
      { code: 'GB', name: 'Royaume-Uni', dialCode: '+44' },
      { code: 'BE', name: 'Belgique', dialCode: '+32' },
      { code: 'CA', name: 'Canada', dialCode: '+1' },
      { code: 'DE', name: 'Allemagne', dialCode: '+49' },
      { code: 'MA', name: 'Maroc', dialCode: '+212' },
      { code: 'TN', name: 'Tunisie', dialCode: '+216' },
      { code: 'DZ', name: 'Algérie', dialCode: '+213' },
      { code: 'NG', name: 'Nigeria', dialCode: '+234' },
      { code: 'GH', name: 'Ghana', dialCode: '+233' },
      { code: 'CD', name: 'RD Congo', dialCode: '+243' },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }
}
