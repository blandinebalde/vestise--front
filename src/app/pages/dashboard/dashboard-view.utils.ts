import { API_BASE_URL } from '../../config/api.config';

export function getDashboardImageUrl(image: string | undefined): string {
  if (image == null || image === '') return '';
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL}/${image}`;
}

export function getPublicationTypeLabel(type: string): string {
  return type || '';
}

export function getPublicationTypeClass(type: string): string {
  return (type || '').toLowerCase().replace(/\s+/g, '-');
}

export function getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    PENDING: 'En attente',
    APPROVED: 'Approuvée',
    REJECTED: 'Rejetée',
    RESERVED: 'Réservée',
    SOLD: 'Vendue',
    EXPIRED: 'Expirée'
  };
  return labels[status] || status;
}
