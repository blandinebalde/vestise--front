import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import {
  cloneConversation,
  ConversationService,
  ConversationDTO,
  MessageDTO,
  CONVERSATION_POLL_MS,
  isMessageUnread,
  samePublicId
} from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';

export type MessagesPerspective = 'seller' | 'buyer';

export interface AnnonceConversationGroup {
  annoncePublicId: string;
  annonceTitle: string;
  conversations: ConversationDTO[];
  lastActivityMs: number;
  unreadCount: number;
}

@Component({
  selector: 'app-seller-messages',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './seller-messages.component.html',
  styleUrls: ['./seller-messages.component.css']
})
export class SellerMessagesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  perspective: MessagesPerspective = 'seller';
  groups: AnnonceConversationGroup[] = [];
  selectedAnnonceId: string | null = null;
  activeConversation: ConversationDTO | null = null;
  newMessage = '';
  sending = false;
  private pollSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private conversationService: ConversationService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get isBuyerView(): boolean {
    return this.perspective === 'buyer';
  }

  get pageTitle(): string {
    return this.isBuyerView ? 'Mes discussions' : 'Messagerie par annonce';
  }

  get threadsPanelTitle(): string {
    return this.isBuyerView ? 'Vendeurs' : 'Acheteurs';
  }

  get emptyHint(): string {
    return this.isBuyerView
      ? 'Contactez un vendeur depuis la fiche d\'une annonce pour démarrer une discussion.'
      : 'Les acheteurs vous contacteront depuis la fiche produit.';
  }

  get composerPlaceholder(): string {
    return this.isBuyerView ? 'Votre message…' : 'Votre réponse…';
  }

  contactName(conv: ConversationDTO): string {
    return this.isBuyerView ? conv.sellerName : conv.buyerName;
  }

  trackMessage(_index: number, msg: MessageDTO): number {
    return msg.id;
  }

  chatWithLabel(conv: ConversationDTO): string {
    return this.contactName(conv);
  }

  ngOnInit(): void {
    const dataPerspective = this.route.snapshot.data['perspective'] as MessagesPerspective | undefined;
    if (dataPerspective === 'buyer' || dataPerspective === 'seller') {
      this.perspective = dataPerspective;
    }
    this.route.queryParamMap.subscribe((params) => {
      const annonce = params.get('annonce');
      const chat = params.get('chat');
      if (annonce) {
        this.selectedAnnonceId = annonce;
      }
      this.loadConversations(chat ?? undefined);
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  get selectedGroup(): AnnonceConversationGroup | null {
    if (!this.selectedAnnonceId) {
      return null;
    }
    return this.groups.find((g) => g.annoncePublicId === this.selectedAnnonceId) ?? null;
  }

  get totalUnread(): number {
    return this.groups.reduce((s, g) => s + g.unreadCount, 0);
  }

  loadConversations(selectChatId?: string): void {
    this.loading = true;
    this.error = '';
    this.conversationService.listMine().subscribe({
      next: (list) => {
        const me = this.authService.getCurrentUser();
        const mine = (list ?? []).filter((c) => {
          if (!me) {
            return false;
          }
          return this.isBuyerView
            ? samePublicId(c.buyerPublicId, me.publicId)
            : samePublicId(c.sellerPublicId, me.publicId);
        });
        this.groups = this.buildGroups(mine);
        this.loading = false;
        this.conversationService.refreshUnreadCounts();
        this.startPolling();
        this.cdr.markForCheck();

        if (this.groups.length === 0) {
          this.selectedAnnonceId = null;
          this.activeConversation = null;
          return;
        }

        if (
          !this.selectedAnnonceId ||
          !this.groups.some((g) => g.annoncePublicId === this.selectedAnnonceId)
        ) {
          this.selectedAnnonceId = this.groups[0].annoncePublicId;
        }

        const group = this.selectedGroup;
        if (selectChatId && group) {
          const found = group.conversations.find(
            (c) => String(c.publicId) === selectChatId
          );
          if (found) {
            this.selectConversation(found);
            return;
          }
        }
        if (group?.conversations.length) {
          this.selectConversation(group.conversations[0]);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err.error?.message || 'Impossible de charger vos conversations.';
      }
    });
  }

  selectAnnonce(annoncePublicId: string): void {
    this.selectedAnnonceId = annoncePublicId;
    const group = this.selectedGroup;
    if (group?.conversations.length) {
      this.selectConversation(group.conversations[0]);
    } else {
      this.activeConversation = null;
      this.pollSub?.unsubscribe();
    }
  }

  selectConversation(conv: ConversationDTO): void {
    const publicId = String(conv.publicId);
    this.conversationService.get(publicId).subscribe({
      next: (full) => {
        this.applyActiveConversation(full, true);
      },
      error: () => {
        this.applyActiveConversation(conv, true);
      }
    });
  }

  private applyActiveConversation(conv: ConversationDTO, scroll: boolean): void {
    const prevLen = this.activeConversation?.messages?.length ?? 0;
    this.activeConversation = cloneConversation(conv);
    this.syncConversationInGroups(conv);
    this.cdr.markForCheck();
    if (scroll || (conv.messages?.length ?? 0) > prevLen) {
      setTimeout(() => this.scrollThread(), 30);
    }
  }

  sendMessage(): void {
    if (!this.activeConversation || !this.newMessage.trim() || this.sending) {
      return;
    }
    this.sending = true;
    this.conversationService
      .sendMessage({
        conversationPublicId: String(this.activeConversation.publicId),
        content: this.newMessage.trim()
      })
      .subscribe({
        next: (msg) => {
          const msgs = this.activeConversation!.messages || [];
          if (!msgs.some((m) => m.id === msg.id)) {
            this.activeConversation = cloneConversation({
              ...this.activeConversation!,
              messages: [...msgs, msg]
            });
          }
          this.newMessage = '';
          this.sending = false;
          this.syncConversationInGroups(this.activeConversation!);
          this.cdr.markForCheck();
          this.scrollThread();
          this.conversationService.refreshUnreadCounts();
        },
        error: (err) => {
          this.sending = false;
          this.cdr.markForCheck();
          alert(err.error?.message || "Erreur lors de l'envoi.");
        }
      });
  }

  isMine(msg: MessageDTO): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && samePublicId(msg.senderPublicId, user.publicId);
  }

  lastMessagePreview(conv: ConversationDTO): string {
    const msgs = conv.messages;
    if (!msgs?.length) {
      return 'Aucun message';
    }
    const last = msgs[msgs.length - 1];
    const text = last.content?.trim() || '';
    return text.length > 60 ? text.slice(0, 60) + '…' : text;
  }

  lastMessageDate(conv: ConversationDTO): string | null {
    const msgs = conv.messages;
    if (!msgs?.length) {
      return conv.createdAt;
    }
    return msgs[msgs.length - 1].createdAt;
  }

  unreadForConversation(conv: ConversationDTO): number {
    const me = this.authService.getCurrentUser()?.publicId;
    return (conv.messages ?? []).filter((m) => isMessageUnread(m, me)).length;
  }

  private buildGroups(convs: ConversationDTO[]): AnnonceConversationGroup[] {
    const map = new Map<string, AnnonceConversationGroup>();
    for (const c of convs) {
      let g = map.get(c.annoncePublicId);
      if (!g) {
        g = {
          annoncePublicId: c.annoncePublicId,
          annonceTitle: c.annonceTitle,
          conversations: [],
          lastActivityMs: 0,
          unreadCount: 0
        };
        map.set(c.annoncePublicId, g);
      }
      g.conversations.push(c);
      g.unreadCount += this.unreadForConversation(c);
    }
    for (const g of map.values()) {
      g.conversations.sort(
        (a, b) =>
          this.conversationActivityMs(b) - this.conversationActivityMs(a)
      );
      g.lastActivityMs = Math.max(
        ...g.conversations.map((c) => this.conversationActivityMs(c))
      );
    }
    return Array.from(map.values()).sort(
      (a, b) => b.lastActivityMs - a.lastActivityMs
    );
  }

  private conversationActivityMs(conv: ConversationDTO): number {
    const msgs = conv.messages;
    if (msgs?.length) {
      return new Date(msgs[msgs.length - 1].createdAt).getTime();
    }
    return new Date(conv.createdAt).getTime();
  }

  private syncConversationInGroups(conv: ConversationDTO): void {
    for (const g of this.groups) {
      const idx = g.conversations.findIndex(
        (c) => String(c.publicId) === String(conv.publicId)
      );
      if (idx >= 0) {
        g.conversations[idx] = conv;
        g.unreadCount = g.conversations.reduce(
          (s, c) => s + this.unreadForConversation(c),
          0
        );
        g.lastActivityMs = Math.max(
          ...g.conversations.map((c) => this.conversationActivityMs(c))
        );
        break;
      }
    }
    this.groups = [...this.groups].sort(
      (a, b) => b.lastActivityMs - a.lastActivityMs
    );
  }

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = timer(0, CONVERSATION_POLL_MS).subscribe(() => {
      if (this.sending) {
        return;
      }
      this.refreshInboxList();
      const publicId = this.activeConversation?.publicId;
      if (!publicId) {
        return;
      }
      this.conversationService.get(String(publicId)).subscribe({
        next: (conv) => this.applyActiveConversation(conv, false),
        error: () => {}
      });
    });
  }

  private refreshInboxList(): void {
    const me = this.authService.getCurrentUser();
    if (!me) {
      return;
    }
    this.conversationService.listMine().subscribe({
      next: (list) => {
        const mine = (list ?? []).filter((c) =>
          this.isBuyerView
            ? samePublicId(c.buyerPublicId, me.publicId)
            : samePublicId(c.sellerPublicId, me.publicId)
        );
        const selectedId = this.activeConversation?.publicId;
        this.groups = this.buildGroups(mine);
        if (selectedId) {
          for (const g of this.groups) {
            const found = g.conversations.find(
              (c) => String(c.publicId) === String(selectedId)
            );
            if (found && this.activeConversation) {
              this.activeConversation = cloneConversation({
                ...found,
                messages: this.activeConversation.messages
              });
              break;
            }
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  private scrollThread(): void {
    const el = document.querySelector('.sm-thread__messages');
    if (el) {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    }
  }
}
