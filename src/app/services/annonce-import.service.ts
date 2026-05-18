import { Injectable } from '@angular/core';
import type { Category } from './category.service';

/** Colonnes attendues (ligne 1 du modèle). Alias acceptés en en-tête. */
const COLUMN_KEYS = [
  'titre',
  'description',
  'prix_fcfa',
  'categorie',
  'type_publication',
  'etat',
  'taille',
  'marque',
  'couleur',
  'lieu',
  'tout_doit_partir',
  'prix_barre_fcfa',
  'lot',
  'paiement_livraison'
] as const;

export type ImportColumnKey = (typeof COLUMN_KEYS)[number];

const HEADER_TO_KEY: { pattern: RegExp; key: ImportColumnKey }[] = [
  { pattern: /^(titre|title|nom)$/, key: 'titre' },
  { pattern: /^(description|desc)$/, key: 'description' },
  { pattern: /^(prix(_fcfa)?|price)$/, key: 'prix_fcfa' },
  { pattern: /^(categorie|category|cat|id_categorie)$/, key: 'categorie' },
  { pattern: /^(type(_publication)?|visibilite|publication)$/, key: 'type_publication' },
  { pattern: /^(etat|condition|state)$/, key: 'etat' },
  { pattern: /^(taille|size)$/, key: 'taille' },
  { pattern: /^(marque|brand)$/, key: 'marque' },
  { pattern: /^(couleur|color)$/, key: 'couleur' },
  { pattern: /^(lieu|location|ville)$/, key: 'lieu' },
  { pattern: /^tout_doit_partir$/, key: 'tout_doit_partir' },
  { pattern: /^(prix_barre|prix_barre_fcfa|original)$/, key: 'prix_barre_fcfa' },
  { pattern: /^(lot|is_lot)$/, key: 'lot' },
  { pattern: /^(paiement(_livraison)?|livraison)$/, key: 'paiement_livraison' }
];

export interface ResolvedAnnonceImport {
  title: string;
  description: string;
  price: number;
  categoryId: number;
  publicationType: string;
  condition: string;
  size: string;
  brand: string;
  color: string;
  location: string;
  toutDoitPartir: boolean;
  originalPrice: number | null;
  isLot: boolean;
  acceptPaymentOnDelivery: boolean;
}

export interface ImportPreviewRow {
  lineNumber: number;
  resolved: ResolvedAnnonceImport | null;
  errors: string[];
  warnings: string[];
}

export interface ImportFileAnalysis {
  fileName: string;
  format: 'excel' | 'pdf' | 'unknown';
  headersFound: string[];
  previews: ImportPreviewRow[];
  /** Première ligne exploitable (index dans previews). */
  firstValidPreviewIndex: number | null;
  globalErrors: string[];
}

const MAX_IMPORT_BYTES = 3 * 1024 * 1024;

function normalizeHeaderCell(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function mapHeaderToKey(h: string): ImportColumnKey | null {
  for (const { pattern, key } of HEADER_TO_KEY) {
    if (pattern.test(h)) return key;
  }
  return null;
}

function parseBool(v: string): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return ['1', 'oui', 'vrai', 'true', 'yes', 'o'].includes(s);
}

function parsePrice(v: string): number | null {
  const s = String(v ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .trim();
  if (s === '' || s === '-') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

const CONDITION_MAP: Record<string, string> = {
  neuf: 'NEUF',
  neuf_scelle: 'NEUF',
  occasion: 'OCCASION',
  tres_bon_etat: 'TRES_BON_ETAT',
  'tres bon etat': 'TRES_BON_ETAT',
  bon_etat: 'BON_ETAT',
  'bon etat': 'BON_ETAT'
};

function mapCondition(raw: string): string {
  const k = normalizeHeaderCell(raw).replace(/_/g, ' ');
  if (!k) return '';
  const direct = CONDITION_MAP[k.replace(/\s/g, '_')] ?? CONDITION_MAP[k];
  if (direct) return direct;
  const up = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (['NEUF', 'OCCASION', 'TRES_BON_ETAT', 'BON_ETAT'].includes(up)) return up;
  return '';
}

@Injectable({ providedIn: 'root' })
export class AnnonceImportService {
  /** Télécharge le modèle Excel (.xlsx) avec feuille « Annonce » + « Categories ». */
  async downloadExcelTemplate(categories: Category[]): Promise<void> {
    const XLSX = await import('xlsx');
    const headers = [...COLUMN_KEYS];
    const example = [
      '[EXEMPLE] Robe wax T36',
      'Très bon état, portée 2 fois. Envoi possible.',
      18500,
      categories[0]?.id ?? '',
      'Standard',
      'TRES_BON_ETAT',
      'M',
      'Maison locale',
      'bleu roi',
      'Dakar',
      0,
      '',
      0,
      0
    ];
    const notes = [
      '',
      'NOTES (ne pas modifier la ligne 1)',
      '• categorie : id (nombre) OU nom exact comme dans l’app.',
      '• type_publication : nom exact du tarif (ex. Standard, Premium…).',
      '• etat : NEUF, OCCASION, TRES_BON_ETAT, BON_ETAT ou vide.',
      '• tout_doit_partir / lot / paiement_livraison : 0 ou 1 (ou oui/non).',
      '• Une ligne = une annonce. Remplissez autant de lignes que nécessaire sous les en-têtes.',
      '• Après chargement : prévisualisation et validation avant publication.'
    ];
    const aoa = [headers, example, [], notes];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Annonce');
    const catRows = [['id', 'nom'], ...categories.filter((c) => c.active).map((c) => [c.id, stripIcon(c.name)])];
    const ws2 = XLSX.utils.aoa_to_sheet(catRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Categories');
    XLSX.writeFileXLSX(wb, 'modele-import-annonce-vendit.xlsx');
  }

  /** PDF avec tableau (modèle à remplir / imprimer). */
  downloadPdfTemplate(categories: Category[]): void {
    void import('jspdf').then(({ jsPDF }) => {
      void import('jspdf-autotable').then((autoTableMod) => {
        const autoTable = (autoTableMod as { default: (d: unknown, o: unknown) => void }).default;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(14);
        doc.text('Vendit — Modèle d’import annonce (tableau)', 14, 16);
        doc.setFontSize(9);
        doc.text(
          'Renseignez une ligne de données sous les en-têtes. Préférez le fichier Excel pour l’import automatique ; le PDF peut servir de référence ou après export « texte » depuis un tableur.',
          14,
          22,
          { maxWidth: 270 }
        );
        const head = [COLUMN_KEYS.map((k) => k.replace(/_/g, ' '))];
        const example = [
          [
            'Robe wax T36',
            'État, envoi…',
            '18500',
            String(categories[0]?.id ?? ''),
            'Standard',
            'TRES_BON_ETAT',
            'M',
            'Marque',
            'Couleur',
            'Ville',
            '0',
            '',
            '0',
            '0'
          ]
        ];
        autoTable(doc as never, {
          startY: 28,
          head: head,
          body: example,
          styles: { fontSize: 7, cellPadding: 1.2 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          theme: 'grid'
        });
        const y0 = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
        let y = y0 + 8;
        doc.setFontSize(9);
        doc.text('Catégories (id → nom)', 14, y);
        y += 4;
        const catBody = categories.filter((c) => c.active).map((c) => [String(c.id), stripIcon(c.name)]);
        autoTable(doc as never, {
          startY: y,
          head: [['id', 'nom']],
          body: catBody.slice(0, 40),
          styles: { fontSize: 8 },
          theme: 'striped'
        });
        doc.save('modele-import-annonce-vendit.pdf');
      });
    });
  }

  async analyzeImportFile(
    file: File,
    categories: Category[],
    publicationTypeNames: string[]
  ): Promise<ImportFileAnalysis> {
    const globalErrors: string[] = [];
    if (file.size > MAX_IMPORT_BYTES) {
      globalErrors.push(`Fichier trop volumineux (max ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} Mo).`);
      return emptyAnalysis(file.name, 'unknown', globalErrors);
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls'].includes(ext)) {
      return this.analyzeExcel(file, categories, publicationTypeNames);
    }
    if (ext === 'pdf') {
      return this.analyzePdf(file, categories, publicationTypeNames);
    }
    globalErrors.push('Format non pris en charge. Utilisez .xlsx, .xls ou .pdf');
    return emptyAnalysis(file.name, 'unknown', globalErrors);
  }

  private async analyzeExcel(
    file: File,
    categories: Category[],
    publicationTypeNames: string[]
  ): Promise<ImportFileAnalysis> {
    const globalErrors: string[] = [];
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      if (!aoa?.length) {
        globalErrors.push('Feuille vide.');
        return emptyAnalysis(file.name, 'excel', globalErrors);
      }
      const headerCells = (aoa[0] as unknown[]).map((c) => normalizeHeaderCell(c));
      const colIndex = new Map<ImportColumnKey, number>();
      headerCells.forEach((h, idx) => {
        const key = mapHeaderToKey(h);
        if (key != null) colIndex.set(key, idx);
      });
      const required: ImportColumnKey[] = ['titre', 'prix_fcfa', 'categorie', 'type_publication'];
      for (const r of required) {
        if (!colIndex.has(r)) {
          globalErrors.push(`Colonne manquante ou non reconnue : « ${r.replace(/_/g, ' ')} ». Utilisez le modèle fourni.`);
        }
      }
      if (globalErrors.length) {
        return {
          fileName: file.name,
          format: 'excel',
          headersFound: headerCells,
          previews: [],
          firstValidPreviewIndex: null,
          globalErrors
        };
      }
      const previews: ImportPreviewRow[] = [];
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r] as unknown[];
        if (!row || !row.some((c) => String(c ?? '').trim())) continue;
        const rec = rowToRecord(row, colIndex);
        if (!(rec['titre'] ?? '').trim() && !(rec['prix_fcfa'] ?? '').trim()) continue;
        if ((rec['titre'] ?? '').trim().toLowerCase().startsWith('[exemple]')) continue;
        const { resolved, errors, warnings } = this.resolveRow(rec, categories, publicationTypeNames);
        previews.push({ lineNumber: r + 1, resolved, errors, warnings });
      }
      if (!previews.length) {
        globalErrors.push('Aucune ligne de données sous les en-têtes.');
        return {
          fileName: file.name,
          format: 'excel',
          headersFound: headerCells,
          previews: [],
          firstValidPreviewIndex: null,
          globalErrors
        };
      }
      const firstValidPreviewIndex = previews.findIndex((p) => p.resolved && p.errors.length === 0);
      return {
        fileName: file.name,
        format: 'excel',
        headersFound: headerCells,
        previews,
        firstValidPreviewIndex: firstValidPreviewIndex >= 0 ? firstValidPreviewIndex : null,
        globalErrors: []
      };
    } catch (e) {
      globalErrors.push(`Lecture Excel impossible : ${(e as Error).message || 'erreur inconnue'}`);
      return emptyAnalysis(file.name, 'excel', globalErrors);
    }
  }

  private async analyzePdf(
    file: File,
    categories: Category[],
    publicationTypeNames: string[]
  ): Promise<ImportFileAnalysis> {
    const globalErrors: string[] = [];
    try {
      const pdfjs = await import('pdfjs-dist');
      const origin =
        typeof globalThis !== 'undefined' && globalThis.location?.origin
          ? globalThis.location.origin
          : '';
      pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdfjs/pdf.worker.min.js`;
      const buf = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: buf });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const tc = await page.getTextContent();
      const items = tc.items as { str?: string; transform?: number[] }[];
      const rows = this.clusterPdfTextLines(items);
      if (rows.length < 2) {
        globalErrors.push(
          'Impossible d’extraire un tableau lisible depuis ce PDF. Exportez depuis Excel, ou utilisez directement un fichier .xlsx.'
        );
        return {
          fileName: file.name,
          format: 'pdf',
          headersFound: rows[0] ?? [],
          previews: [],
          firstValidPreviewIndex: null,
          globalErrors
        };
      }
      const headerCells = rows[0].map((c) => normalizeHeaderCell(c));
      const colIndex = new Map<ImportColumnKey, number>();
      headerCells.forEach((h, idx) => {
        const key = mapHeaderToKey(h);
        if (key != null) colIndex.set(key, idx);
      });
      const required: ImportColumnKey[] = ['titre', 'prix_fcfa', 'categorie', 'type_publication'];
      for (const req of required) {
        if (!colIndex.has(req)) {
          globalErrors.push(
            `En-têtes PDF non reconnus. L’import PDF est limité aux PDF avec texte sélectionnable aligné en colonnes (ex. export depuis le modèle Excel).`
          );
          break;
        }
      }
      if (globalErrors.length) {
        return {
          fileName: file.name,
          format: 'pdf',
          headersFound: headerCells,
          previews: [],
          firstValidPreviewIndex: null,
          globalErrors
        };
      }
      const previews: ImportPreviewRow[] = [];
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        if (!cells.some((c) => c.trim())) continue;
        const rec = rowToRecord(cells, colIndex);
        if (!(rec['titre'] ?? '').trim() && !(rec['prix_fcfa'] ?? '').trim()) continue;
        if ((rec['titre'] ?? '').trim().toLowerCase().startsWith('[exemple]')) continue;
        const { resolved, errors, warnings } = this.resolveRow(rec, categories, publicationTypeNames);
        previews.push({ lineNumber: r + 1, resolved, errors, warnings });
      }
      if (!previews.length) {
        globalErrors.push('Aucune ligne de données détectée dans le PDF.');
        return {
          fileName: file.name,
          format: 'pdf',
          headersFound: headerCells,
          previews: [],
          firstValidPreviewIndex: null,
          globalErrors
        };
      }
      const firstValidPreviewIndex = previews.findIndex((p) => p.resolved && p.errors.length === 0);
      return {
        fileName: file.name,
        format: 'pdf',
        headersFound: headerCells,
        previews,
        firstValidPreviewIndex: firstValidPreviewIndex >= 0 ? firstValidPreviewIndex : null,
        globalErrors: []
      };
    } catch (e) {
      globalErrors.push(`Lecture PDF impossible : ${(e as Error).message || 'erreur inconnue'}`);
      return emptyAnalysis(file.name, 'pdf', globalErrors);
    }
  }

  /** Regroupe les fragments PDF en lignes puis colonnes (séparation sur grandes espaces). */
  private clusterPdfTextLines(items: { str?: string; transform?: number[] }[]): string[][] {
    type T = { str: string; x: number; y: number };
    const pts: T[] = [];
    for (const it of items) {
      const s = (it.str ?? '').trim();
      if (!s || !it.transform || it.transform.length < 6) continue;
      pts.push({ str: s, x: it.transform[4], y: it.transform[5] });
    }
    if (!pts.length) return [];
    pts.sort((a, b) => b.y - a.y || a.x - b.x);
    const lineTol = 4;
    const lines: T[][] = [];
    let cur: T[] = [];
    let y0: number | null = null;
    for (const p of pts) {
      if (y0 == null || Math.abs(p.y - y0) <= lineTol) {
        cur.push(p);
        y0 = y0 == null ? p.y : (y0 * (cur.length - 1) + p.y) / cur.length;
      } else {
        cur.sort((a, b) => a.x - b.x);
        lines.push(cur);
        cur = [p];
        y0 = p.y;
      }
    }
    if (cur.length) {
      cur.sort((a, b) => a.x - b.x);
      lines.push(cur);
    }
    return lines.map((line) => {
      const chunks: string[] = [];
      let buf = line[0]?.str ?? '';
      for (let i = 1; i < line.length; i++) {
        const dx = line[i].x - (line[i - 1].x + estimateWidth(line[i - 1].str));
        if (dx > 8) {
          chunks.push(buf);
          buf = line[i].str;
        } else {
          buf += (buf && !buf.endsWith(' ') ? ' ' : '') + line[i].str;
        }
      }
      chunks.push(buf);
      return chunks;
    });
  }

  applyToAnnonce(target: Record<string, unknown>, data: ResolvedAnnonceImport): void {
    target['title'] = data.title;
    target['description'] = data.description;
    target['price'] = data.price;
    target['categoryId'] = data.categoryId;
    target['publicationType'] = data.publicationType;
    target['condition'] = data.condition || '';
    target['size'] = data.size || '';
    target['brand'] = data.brand || '';
    target['color'] = data.color || '';
    target['location'] = data.location || '';
    target['toutDoitPartir'] = data.toutDoitPartir;
    target['originalPrice'] = data.originalPrice;
    target['isLot'] = data.isLot;
    target['acceptPaymentOnDelivery'] = data.acceptPaymentOnDelivery;
  }

  /** Payload API création d’annonce à partir d’une ligne import validée. */
  buildCreatePayload(
    data: ResolvedAnnonceImport,
    paymentMethod: 'CREDITS' | 'SUBSCRIPTION'
  ): Record<string, unknown> {
    return {
      title: data.title,
      description: data.description,
      price: data.price,
      categoryId: data.categoryId,
      publicationType: data.publicationType,
      condition: data.condition || '',
      size: data.size || '',
      brand: data.brand || '',
      color: data.color || '',
      location: data.location || '',
      toutDoitPartir: data.toutDoitPartir,
      originalPrice: data.originalPrice,
      isLot: data.isLot,
      acceptPaymentOnDelivery: data.acceptPaymentOnDelivery,
      latitude: null,
      longitude: null,
      images: [] as string[],
      paymentMethod
    };
  }

  categoryLabel(categoryId: number, categories: Category[]): string {
    const c = categories.find((x) => x.id === categoryId);
    return c ? stripIcon(c.name) : String(categoryId);
  }

  conditionLabel(condition: string): string {
    switch (condition) {
      case 'NEUF':
        return 'Neuf';
      case 'TRES_BON_ETAT':
        return 'Très bon état';
      case 'BON_ETAT':
        return 'Bon état';
      case 'OCCASION':
        return 'Occasion';
      default:
        return condition ? condition : '—';
    }
  }

  private resolveRow(
    rec: Record<string, string>,
    categories: Category[],
    publicationTypeNames: string[]
  ): { resolved: ResolvedAnnonceImport | null; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const title = (rec['titre'] ?? '').trim();
    if (!title) errors.push('Titre vide.');
    if (title.length > 200) errors.push('Titre trop long (max 200).');

    const description = (rec['description'] ?? '').trim();
    if (description.length > 2000) errors.push('Description trop longue (max 2000).');

    const price = parsePrice(rec['prix_fcfa'] ?? '');
    if (price == null || price < 1) errors.push('Prix invalide (nombre > 0 requis).');

    const catRaw = (rec['categorie'] ?? '').trim();
    const categoryId = resolveCategoryId(catRaw, categories);
    if (categoryId == null) errors.push(`Catégorie introuvable : « ${catRaw} ».`);

    const pubRaw = (rec['type_publication'] ?? '').trim();
    const publicationType = matchPublicationType(pubRaw, publicationTypeNames);
    if (!publicationType) errors.push(`Type de publication inconnu : « ${pubRaw} ».`);

    const condition = mapCondition(rec['etat'] ?? '');
    if ((rec['etat'] ?? '').trim() && !condition) warnings.push(`État non reconnu : « ${rec['etat']} » — ignoré.`);

    const size = (rec['taille'] ?? '').trim();
    const brand = (rec['marque'] ?? '').trim();
    const color = (rec['couleur'] ?? '').trim();
    const location = (rec['lieu'] ?? '').trim();

    const toutDoitPartir = parseBool(rec['tout_doit_partir'] ?? '');
    let originalPrice: number | null = parsePrice(rec['prix_barre_fcfa'] ?? '');
    if (originalPrice != null && originalPrice < 0) originalPrice = null;
    if (!toutDoitPartir) originalPrice = null;

    const isLot = parseBool(rec['lot'] ?? '');
    const acceptPaymentOnDelivery = parseBool(rec['paiement_livraison'] ?? '');

    if (errors.length) {
      return { resolved: null, errors, warnings };
    }
    return {
      resolved: {
        title,
        description,
        price: price!,
        categoryId: categoryId!,
        publicationType: publicationType!,
        condition,
        size,
        brand,
        color,
        location,
        toutDoitPartir,
        originalPrice,
        isLot,
        acceptPaymentOnDelivery
      },
      errors: [],
      warnings
    };
  }
}

function estimateWidth(s: string): number {
  return s.length * 2.2;
}

function rowToRecord(row: unknown[], colIndex: Map<ImportColumnKey, number>): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const key of COLUMN_KEYS) {
    const idx = colIndex.get(key);
    if (idx == null || idx >= row.length) rec[key] = '';
    else rec[key] = String(row[idx] ?? '').trim();
  }
  return rec;
}

function resolveCategoryId(raw: string, categories: Category[]): number | null {
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum > 0) {
    const byId = categories.find((c) => c.id === asNum);
    if (byId?.active) return byId.id;
  }
  const needle = raw.trim().toLowerCase();
  const byName = categories.find((c) => c.active && stripIcon(c.name).toLowerCase() === needle);
  if (byName) return byName.id;
  const loose = categories.find(
    (c) => c.active && stripIcon(c.name).toLowerCase().includes(needle) && needle.length >= 3
  );
  return loose?.id ?? null;
}

function matchPublicationType(raw: string, names: string[]): string | null {
  const t = raw.trim();
  if (!t) return null;
  const exact = names.find((n) => n === t);
  if (exact) return exact;
  const low = t.toLowerCase();
  return names.find((n) => n.toLowerCase() === low) ?? null;
}

function stripIcon(label: string): string {
  return label.replace(/^[^A-Za-zÀ-ÿ0-9]+/i, '').trim();
}

function emptyAnalysis(fileName: string, format: ImportFileAnalysis['format'], globalErrors: string[]): ImportFileAnalysis {
  return {
    fileName,
    format,
    headersFound: [],
    previews: [],
    firstValidPreviewIndex: null,
    globalErrors
  };
}
