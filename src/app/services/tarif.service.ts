import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PublicationTarif {
  id: number;
  typeName: string;
  price: number;
  /** Durée en jours ; null ou 0 = illimitée */
  durationDays?: number | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TarifService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  getTarifs(): Observable<PublicationTarif[]> {
    return this.http.get<PublicationTarif[]>(`${this.apiUrl}/tarifs`);
  }

  getAdminTarifs(page: number = 0, size: number = 20): Observable<PageResponse<PublicationTarif>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<PublicationTarif>>(`${this.apiUrl}/admin/tarifs`, { params });
  }

  updateTarif(id: number, price: number, durationDays: number | null | undefined, active?: boolean, typeName?: string): Observable<PublicationTarif> {
    const days = durationDays == null || durationDays <= 0 ? 0 : durationDays;
    let params: { [key: string]: string } = {
      price: price.toString(),
      durationDays: days.toString()
    };
    if (active !== undefined) {
      params['active'] = active.toString();
    }
    if (typeName !== undefined && typeName !== null && typeName !== '') {
      params['typeName'] = typeName;
    }
    return this.http.put<PublicationTarif>(`${this.apiUrl}/admin/tarifs/${id}`, null, { params });
  }
}
