// Pure, framework-free grid/pagination math for the Animal Soundboard. No Phaser
// or render imports — unit-tested headlessly. Maximises comfortable button density:
// pick the most columns whose cells are >= minCell, square the cells, fill the rows
// that fit, and centre the block in the content area.

export interface GridOpts {
  margin?: number;        // clear px at the left/right edges (default 24)
  gap?: number;           // px between cells (default 18)
  topReserved?: number;   // px reserved at the top (header/back) (default 120)
  bottomReserved?: number;// px reserved at the bottom (arrows/dots) (default 150)
  minCell?: number;       // smallest acceptable square cell px (default 132)
  maxCell?: number;       // largest square cell px (default 188)
}

export interface GridCell { cx: number; cy: number; }

export interface GridLayout {
  cols: number;
  rows: number;
  perPage: number;
  pages: number;
  cellSize: number;
  originX: number;            // centre x of column 0
  originY: number;            // centre y of row 0
  cellCenters: GridCell[];    // length perPage, page-independent
}

export function computeGrid(
  viewportW: number, viewportH: number, count: number, opts: GridOpts = {},
): GridLayout {
  const margin = opts.margin ?? 24;
  const gap = opts.gap ?? 18;
  const topReserved = opts.topReserved ?? 120;
  const bottomReserved = opts.bottomReserved ?? 150;
  const minCell = opts.minCell ?? 132;
  const maxCell = opts.maxCell ?? 188;

  const contentW = Math.max(1, viewportW - 2 * margin);
  const contentH = Math.max(1, viewportH - topReserved - bottomReserved);

  const cols = Math.max(1, Math.floor((contentW + gap) / (minCell + gap)));
  const cellSize = Math.min(maxCell, (contentW - (cols - 1) * gap) / cols);
  const rows = Math.max(1, Math.floor((contentH + gap) / (cellSize + gap)));
  const perPage = cols * rows;
  const pages = Math.max(1, Math.ceil(count / perPage));

  const blockW = cols * cellSize + (cols - 1) * gap;
  const blockH = rows * cellSize + (rows - 1) * gap;
  const originX = margin + (contentW - blockW) / 2 + cellSize / 2;
  const originY = topReserved + (contentH - blockH) / 2 + cellSize / 2;

  const cellCenters: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellCenters.push({ cx: originX + c * (cellSize + gap), cy: originY + r * (cellSize + gap) });
    }
  }
  return { cols, rows, perPage, pages, cellSize, originX, originY, cellCenters };
}

export function pageSlice<T>(items: readonly T[], page: number, perPage: number): T[] {
  return items.slice(page * perPage, page * perPage + perPage);
}
