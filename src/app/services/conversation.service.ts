import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface MessageDTO {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
  readAt?: string;
}

export interface ConversationDTO {
  id: number;
  annonceId: number;
  annonceTitle: string;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  createdAt: string;
  messages: MessageDTO[];
}

export interface MessageCreateRequest {
  conversationId: number;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  /** Créer ou récupérer une conversation pour une annonce (en tant qu'acheteur) */
  getOrCreate(annonceId: number): Observable<ConversationDTO> {
    return this.http.post<ConversationDTO>(`${this.apiUrl}/conversations/annonce/${annonceId}`, {});
  }

  /** Liste de mes conversations */
  listMine(): Observable<ConversationDTO[]> {
    return this.http.get<ConversationDTO[]>(`${this.apiUrl}/conversations`);
  }

  /** Détail d'une conversation avec messages */
  get(id: number): Observable<ConversationDTO> {
    return this.http.get<ConversationDTO>(`${this.apiUrl}/conversations/${id}`);
  }

  /** Envoyer un message */
  sendMessage(request: MessageCreateRequest): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.apiUrl}/conversations/messages`, request);
  }
}
