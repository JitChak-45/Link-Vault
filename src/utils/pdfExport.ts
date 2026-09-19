import { jsPDF } from 'jspdf';
import { SavedLink, Category } from '../types';

export interface ExportPdfOptions {
  vaultName?: string;
  categoryName?: string;
}

/**
 * Normalizes and cleans text so standard Helvetica fonts in jsPDF
 * never suffer from multi-byte font encoding corruption or letter-spacing glitches.
 */
function sanitizePdfText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[★⭐✨]/g, '') // remove emojis/symbols that corrupt winansi font encoding
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a hex color string to RGB numbers with fallback
 */
function hexToRgb(hex: string | undefined | null): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#') {
    return { r: 37, g: 99, b: 235 }; // default blue
  }
  const cleanHex = hex.slice(1);
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16) || 37,
      g: parseInt(cleanHex[1] + cleanHex[1], 16) || 99,
      b: parseInt(cleanHex[2] + cleanHex[2], 16) || 235,
    };
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return { r: 37, g: 99, b: 235 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Generates and downloads a clean, professional PDF backup of all saved links
 * grouped neatly by category so all links of the same category appear together.
 * Formatted strictly as: Title then URL for each link.
 */
export function exportLinksToPdf(
  links: SavedLink[],
  categories: Category[] = [],
  options: ExportPdfOptions = {}
): { success: boolean; count: number; filename?: string; error?: string } {
  if (!links || links.length === 0) {
    return { success: false, count: 0, error: 'No links available to export' };
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 18;
    const contentWidth = pageWidth - marginX * 2;
    const topMargin = 22;
    const bottomMargin = 20;

    // Map category definitions by slug and ID
    const categoryMap = new Map<string, Category>();
    categories.forEach((cat) => {
      categoryMap.set(cat.slug, cat);
      categoryMap.set(cat.id, cat);
    });

    // Group links by category
    const groupMap = new Map<string, { category?: Category; name: string; links: SavedLink[] }>();

    links.forEach((link) => {
      const rawCategoryKey = (link.categorySlug || 'uncategorized').trim();
      const catObj = categoryMap.get(rawCategoryKey);
      const key = catObj ? catObj.slug : (rawCategoryKey || 'uncategorized');
      const displayName = catObj ? catObj.name : (key === 'uncategorized' ? 'Uncategorized' : key);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          category: catObj,
          name: displayName,
          links: [],
        });
      }
      groupMap.get(key)!.links.push(link);
    });

    // Order categories: user-configured categories first, then any extra categories, then uncategorized
    const orderedGroups: { category?: Category; name: string; links: SavedLink[] }[] = [];

    categories.forEach((cat) => {
      if (groupMap.has(cat.slug)) {
        orderedGroups.push(groupMap.get(cat.slug)!);
        groupMap.delete(cat.slug);
      } else if (groupMap.has(cat.id)) {
        orderedGroups.push(groupMap.get(cat.id)!);
        groupMap.delete(cat.id);
      }
    });

    // Add remaining categories
    for (const [key, group] of groupMap.entries()) {
      if (key !== 'uncategorized') {
        orderedGroups.push(group);
      }
    }

    // Add uncategorized links at the end if present
    if (groupMap.has('uncategorized')) {
      orderedGroups.push(groupMap.get('uncategorized')!);
    }

    const dateNow = new Date();
    const formattedDate = dateNow.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = dateNow.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    let currentY = topMargin;

    // Helper: Draw Header on top of the first page
    const drawDocumentHeader = () => {
      // Top accent bar
      doc.setFillColor(37, 99, 235); // Blue #2563eb
      doc.rect(marginX, currentY, contentWidth, 1.5, 'F');
      currentY += 8;

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(sanitizePdfText(options.vaultName) || 'Link Vault — Backup', marginX, currentY);
      currentY += 6.5;

      // Subtitle / metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139); // slate-500
      const metaText = `Generated on ${formattedDate} at ${formattedTime} • ${links.length} Total Links • Grouped by Category`;
      doc.text(metaText, marginX, currentY);
      currentY += 5;

      // Divider line
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.35);
      doc.line(marginX, currentY, marginX + contentWidth, currentY);
      currentY += 9;
    };

    drawDocumentHeader();

    // Iterate through each category group
    orderedGroups.forEach((group) => {
      if (!group.links || group.links.length === 0) return;

      const groupCatName = sanitizePdfText(group.name) || 'Uncategorized';
      const catColor = hexToRgb(group.category?.color || '#2563eb');
      const countLabel = group.links.length === 1 ? '1 link' : `${group.links.length} links`;

      // Check if there is enough space on this page for the Category Header + at least one link
      if (currentY + 30 > pageHeight - bottomMargin) {
        doc.addPage();
        currentY = topMargin;
      }

      // 1. Category Section Header Banner
      const bannerHeight = 8;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(marginX, currentY, contentWidth, bannerHeight, 1.5, 1.5, 'F');

      // Left colored category accent stripe
      doc.setFillColor(catColor.r, catColor.g, catColor.b);
      doc.roundedRect(marginX, currentY, 2.5, bannerHeight, 1, 1, 'F');

      // Category Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(groupCatName, marginX + 5.5, currentY + 5.5);

      // Link count badge on right
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(countLabel, marginX + contentWidth - 3, currentY + 5.5, { align: 'right' });

      currentY += bannerHeight + 4;

      // 2. Render all links belonging to this category
      group.links.forEach((link, linkIndex) => {
        const itemNumber = `${linkIndex + 1}. `;
        const rawTitle = sanitizePdfText(link.title) || 'Untitled Link';
        const cleanUrl = (link.url || '').trim();
        const rawDescription = sanitizePdfText(link.description);

        // Calculate Title height
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        const fullTitle = `${itemNumber}${rawTitle}${link.isFavorite ? ' [Starred]' : ''}`;
        const titleLines = doc.splitTextToSize(fullTitle, contentWidth - 4);
        const titleHeight = titleLines.length * 5.0;

        // Calculate URL height
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const urlLines = doc.splitTextToSize(cleanUrl, contentWidth - 6);
        const urlHeight = urlLines.length * 4.4;

        // Calculate Notes height
        doc.setFontSize(8.5);
        const descLines = rawDescription
          ? doc.splitTextToSize(`Notes: ${rawDescription}`, contentWidth - 6)
          : [];
        const descHeight = descLines.length ? descLines.length * 4.0 : 0;

        const itemSpacing = 4;
        const totalBlockHeight = titleHeight + urlHeight + descHeight + itemSpacing + 3;

        // Page overflow check
        if (currentY + totalBlockHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentY = topMargin;
        }

        // Step 1: Render Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42); // slate-900
        titleLines.forEach((line: string) => {
          doc.text(line, marginX + 2, currentY);
          currentY += 5.0;
        });

        // Step 2: Render URL directly beneath the Title
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(29, 78, 216); // Royal Blue #1d4ed8
        urlLines.forEach((line: string) => {
          if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            doc.textWithLink(line, marginX + 4, currentY, { url: cleanUrl });
          } else {
            doc.text(line, marginX + 4, currentY);
          }
          currentY += 4.4;
        });

        // Step 3: Render Notes on its own line if present
        if (descLines.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139); // slate-500
          descLines.forEach((line: string) => {
            doc.text(line, marginX + 4, currentY);
            currentY += 4.0;
          });
        }

        // Step 4: Subtle hairline divider between entries
        currentY += 1.5;
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.25);
        doc.line(marginX + 2, currentY, marginX + contentWidth, currentY);
        currentY += itemSpacing;
      });

      // Extra breathing room between different categories
      currentY += 5;
    });

    // Add clean page numbers in footer across all pages
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Link Vault Backup • Page ${p} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Auto-generate safe filename with local date string
    const fileDate = dateNow.toISOString().slice(0, 10);
    const filename = `LinkVault_Backup_${fileDate}.pdf`;

    // Download automatically to user's local device
    doc.save(filename);

    return {
      success: true,
      count: links.length,
      filename,
    };
  } catch (err: any) {
    console.error('Failed to generate PDF backup:', err);
    return {
      success: false,
      count: 0,
      error: err?.message || 'Failed to generate PDF',
    };
  }
}
