import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PublicationTarif {
  id: number;
  publicationType: 'STANDARD' | 'PREMIUM' | 'TOP_PUB';
  price: number;
  durationDays: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TarifService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  getTarifs(): Observable<PublicationTarif[]> {
    return this.http.get<PublicationTarif[]>(`${this.apiUrl}/tarifs`);
  }

  getAdminTarifs(): Observable<PublicationTarif[]> {
    return this.http.get<PublicationTarif[]>(`${this.apiUrl}/admin/tarifs`);
  }

  updateTarif(id: number, price: number, durationDays: number, active?: boolean): Observable<PublicationTarif> {
    let params: any = { 
      price: price.toString(), 
      durationDays: durationDays.toString() 
    };
    if (active !== undefined) {
      params.active = active.toString();
    }
    return this.http.put<PublicationTarif>(`${this.apiUrl}/admin/tarifs/${id}`, null, { params });
  }
}
